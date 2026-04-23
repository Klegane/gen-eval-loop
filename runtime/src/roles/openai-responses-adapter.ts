import { zodToJsonSchema } from "zod-to-json-schema";
import type { ZodTypeAny } from "zod";

import type { GenerateObjectRequest, GenerateObjectResponse, LlmAdapter } from "./llm-adapter";

export interface OpenAiResponsesAdapterConfig {
  apiKey: string;
  baseUrl?: string | undefined;
  defaultModel?: string | undefined;
  organization?: string | undefined;
  project?: string | undefined;
  timeoutMs?: number | undefined;
}

interface OpenAiResponseContentText {
  type: "output_text";
  text: string;
}

interface OpenAiResponseContentRefusal {
  type: "refusal";
  refusal: string;
}

interface OpenAiResponseMessage {
  type: "message";
  role: string;
  content: Array<OpenAiResponseContentText | OpenAiResponseContentRefusal | Record<string, unknown>>;
}

interface OpenAiResponseBody {
  id?: string;
  status?: string;
  output?: Array<OpenAiResponseMessage | Record<string, unknown>>;
  error?: {
    message?: string;
  } | null;
}

export class OpenAiResponsesAdapter implements LlmAdapter {
  readonly name = "openai-responses";
  private readonly config: Required<Pick<OpenAiResponsesAdapterConfig, "apiKey" | "baseUrl" | "timeoutMs">> &
    Omit<OpenAiResponsesAdapterConfig, "apiKey" | "baseUrl" | "timeoutMs">;

  constructor(config: OpenAiResponsesAdapterConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl ?? "https://api.openai.com/v1",
      timeoutMs: config.timeoutMs ?? 60_000,
      defaultModel: config.defaultModel,
      organization: config.organization,
      project: config.project,
    };
  }

  async generateObject<TSchema extends ZodTypeAny>(
    request: GenerateObjectRequest<TSchema>,
  ): Promise<GenerateObjectResponse<import("zod").output<TSchema>>> {
    const model = request.model ?? this.config.defaultModel;

    if (model == null || model.length === 0) {
      throw new Error("OpenAiResponsesAdapter requires a model on the request or via OPENAI_MODEL.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${this.config.baseUrl}/responses`, {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify({
          model,
          input: [
            {
              role: "developer",
              content: [{ type: "input_text", text: request.systemPrompt }],
            },
            {
              role: "user",
              content: [{ type: "input_text", text: request.userPrompt }],
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: this.sanitizeSchemaName(request.schemaName),
              strict: true,
              schema: this.buildJsonSchema(request.schema),
            },
          },
        }),
        signal: controller.signal,
      });

      const bodyText = await response.text();
      let body: OpenAiResponseBody | undefined;

      try {
        body = JSON.parse(bodyText) as OpenAiResponseBody;
      } catch {
        body = undefined;
      }

      if (!response.ok) {
        const message = body?.error?.message ?? bodyText;
        throw new Error(`OpenAI Responses API error ${response.status}: ${message}`);
      }

      const rawText = this.extractOutputText(body ?? {});
      const parsedJson = JSON.parse(rawText);
      const output = request.schema.parse(parsedJson);

      return {
        adapterName: this.name,
        output,
        rawText,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`OpenAI Responses API request timed out after ${this.config.timeoutMs}ms.`);
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.apiKey}`,
      ...(this.config.organization == null ? {} : { "OpenAI-Organization": this.config.organization }),
      ...(this.config.project == null ? {} : { "OpenAI-Project": this.config.project }),
    };
  }

  private buildJsonSchema(schema: ZodTypeAny): Record<string, unknown> {
    const jsonSchema = zodToJsonSchema(schema as never, {
      $refStrategy: "none",
      target: "jsonSchema7",
    }) as Record<string, unknown> & {
      $schema?: string;
      definitions?: Record<string, unknown>;
    };

    if ("$schema" in jsonSchema) {
      delete jsonSchema.$schema;
    }

    if ("definitions" in jsonSchema && Object.keys(jsonSchema.definitions ?? {}).length === 0) {
      delete jsonSchema.definitions;
    }

    return jsonSchema;
  }

  private sanitizeSchemaName(schemaName: string): string {
    const sanitized = schemaName.replace(/[^a-zA-Z0-9_-]/g, "_");
    return sanitized.length === 0 ? "schema" : sanitized.slice(0, 64);
  }

  private extractOutputText(body: OpenAiResponseBody): string {
    const fragments: string[] = [];

    for (const item of body.output ?? []) {
      if (!this.isMessage(item)) {
        continue;
      }

      for (const contentItem of item.content) {
        if (this.isRefusal(contentItem)) {
          throw new Error(`OpenAI model refusal: ${contentItem.refusal}`);
        }

        if (this.isOutputText(contentItem)) {
          fragments.push(contentItem.text);
        }
      }
    }

    const rawText = fragments.join("\n").trim();

    if (rawText.length === 0) {
      throw new Error("OpenAI Responses API returned no output_text content to parse.");
    }

    return rawText;
  }

  private isMessage(value: unknown): value is OpenAiResponseMessage {
    return typeof value === "object" && value != null && (value as { type?: unknown }).type === "message";
  }

  private isOutputText(value: unknown): value is OpenAiResponseContentText {
    return typeof value === "object" && value != null && (value as { type?: unknown }).type === "output_text";
  }

  private isRefusal(value: unknown): value is OpenAiResponseContentRefusal {
    return typeof value === "object" && value != null && (value as { type?: unknown }).type === "refusal";
  }
}
