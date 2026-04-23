import { zodToJsonSchema } from "zod-to-json-schema";
import type { ZodTypeAny } from "zod";

import type { GenerateObjectRequest, GenerateObjectResponse, LlmAdapter } from "./llm-adapter";

export interface AnthropicMessagesAdapterConfig {
  apiKey: string;
  baseUrl?: string | undefined;
  anthropicVersion?: string | undefined;
  defaultModel?: string | undefined;
  timeoutMs?: number | undefined;
  maxTokens?: number | undefined;
}

interface AnthropicTextContentBlock {
  type: "text";
  text: string;
}

interface AnthropicThinkingContentBlock {
  type: "thinking";
  thinking: string;
}

interface AnthropicRedactedThinkingContentBlock {
  type: "redacted_thinking";
  data: string;
}

interface AnthropicMessageResponse {
  id?: string;
  type?: string;
  role?: string;
  stop_reason?: string | null;
  content?: Array<
    AnthropicTextContentBlock |
    AnthropicThinkingContentBlock |
    AnthropicRedactedThinkingContentBlock |
    Record<string, unknown>
  >;
  error?: {
    type?: string;
    message?: string;
  } | null;
}

export class AnthropicMessagesAdapter implements LlmAdapter {
  readonly name = "anthropic-messages";
  private readonly config: {
    apiKey: string;
    baseUrl: string;
    anthropicVersion: string;
    defaultModel?: string | undefined;
    timeoutMs: number;
    maxTokens: number;
  };

  constructor(config: AnthropicMessagesAdapterConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl ?? "https://api.anthropic.com/v1",
      anthropicVersion: config.anthropicVersion ?? "2023-06-01",
      timeoutMs: config.timeoutMs ?? 60_000,
      maxTokens: config.maxTokens ?? 4_096,
      defaultModel: config.defaultModel,
    };
  }

  async generateObject<TSchema extends ZodTypeAny>(
    request: GenerateObjectRequest<TSchema>,
  ): Promise<GenerateObjectResponse<import("zod").output<TSchema>>> {
    const model = request.model ?? this.config.defaultModel;

    if (model == null || model.length === 0) {
      throw new Error("AnthropicMessagesAdapter requires a model on the request or via ANTHROPIC_MODEL.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${this.config.baseUrl}/messages`, {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify({
          model,
          max_tokens: this.config.maxTokens,
          system: request.systemPrompt,
          messages: [
            {
              role: "user",
              content: request.userPrompt,
            },
          ],
          output_config: {
            format: {
              type: "json_schema",
              schema: this.buildJsonSchema(request.schema),
            },
          },
        }),
        signal: controller.signal,
      });

      const bodyText = await response.text();
      let body: AnthropicMessageResponse | undefined;

      try {
        body = JSON.parse(bodyText) as AnthropicMessageResponse;
      } catch {
        body = undefined;
      }

      if (!response.ok) {
        const message = body?.error?.message ?? bodyText;
        throw new Error(`Anthropic Messages API error ${response.status}: ${message}`);
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
        throw new Error(`Anthropic Messages API request timed out after ${this.config.timeoutMs}ms.`);
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildHeaders(): Record<string, string> {
    return {
      "content-type": "application/json",
      "x-api-key": this.config.apiKey,
      "anthropic-version": this.config.anthropicVersion,
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

    return this.stripUnsupportedKeywords(jsonSchema);
  }

  private extractOutputText(body: AnthropicMessageResponse): string {
    const fragments: string[] = [];

    for (const item of body.content ?? []) {
      if (this.isTextBlock(item)) {
        fragments.push(item.text);
      }
    }

    const rawText = fragments.join("\n").trim();

    if (rawText.length === 0) {
      throw new Error("Anthropic Messages API returned no text content to parse.");
    }

    return rawText;
  }

  private isTextBlock(value: unknown): value is AnthropicTextContentBlock {
    return typeof value === "object" && value != null && (value as { type?: unknown }).type === "text";
  }

  private stripUnsupportedKeywords(value: unknown): Record<string, unknown> {
    const sanitized = this.sanitizeSchemaNode(value);

    if (typeof sanitized !== "object" || sanitized == null || Array.isArray(sanitized)) {
      throw new Error("Anthropic schema sanitation produced an invalid root schema.");
    }

    return sanitized as Record<string, unknown>;
  }

  private sanitizeSchemaNode(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((entry) => this.sanitizeSchemaNode(entry));
    }

    if (typeof value !== "object" || value == null) {
      return value;
    }

    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(input)) {
      if (
        key === "$schema" ||
        key === "definitions" ||
        key === "exclusiveMinimum" ||
        key === "exclusiveMaximum" ||
        key === "minimum" ||
        key === "maximum"
      ) {
        continue;
      }

      output[key] = this.sanitizeSchemaNode(entry);
    }

    return output;
  }
}
