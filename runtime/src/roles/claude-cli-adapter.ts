import { spawn } from "node:child_process";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { z, ZodTypeAny } from "zod";

import type { GenerateObjectRequest, GenerateObjectResponse, LlmAdapter } from "./llm-adapter";

export interface ClaudeCliAdapterOptions {
  /**
   * Path to the Claude Code CLI binary. Defaults to "claude" (PATH lookup).
   */
  cliPath?: string | undefined;
  /**
   * Model to use when the request does not specify one. Defaults to "sonnet".
   */
  defaultModel?: string | undefined;
  /**
   * Per-call timeout in milliseconds. Defaults to 180_000 (3 minutes).
   */
  timeoutMs?: number | undefined;
}

/**
 * LlmAdapter that shells out to the local `claude` CLI with --json-schema for
 * structured output. Uses whatever authentication the CLI has configured
 * (typically the user's Claude Pro subscription via OAuth/keychain), so no
 * ANTHROPIC_API_KEY is required.
 */
export class ClaudeCliAdapter implements LlmAdapter {
  public readonly name = "claude-cli";
  private readonly cliPath: string;
  private readonly defaultModel: string;
  private readonly timeoutMs: number;

  constructor(options: ClaudeCliAdapterOptions = {}) {
    this.cliPath = options.cliPath ?? "claude";
    this.defaultModel = options.defaultModel ?? "sonnet";
    this.timeoutMs = options.timeoutMs ?? 180_000;
  }

  async generateObject<TSchema extends ZodTypeAny>(
    request: GenerateObjectRequest<TSchema>,
  ): Promise<GenerateObjectResponse<z.output<TSchema>>> {
    // zodToJsonSchema's type inference on compound schemas (refinements etc.)
    // can overflow TS instantiation depth. Erase through a double-cast to the
    // loosely-typed function signature to keep the adapter thin.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toJsonSchema = zodToJsonSchema as unknown as (schema: unknown, opts?: unknown) => Record<string, unknown>;
    const jsonSchema = toJsonSchema(request.schema, { $refStrategy: "none" });
    // zodToJsonSchema with a name wraps the schema under definitions[name].
    // Unwrap it so --json-schema receives the bare schema object.
    // Strict override: the role's userPrompt contains Markdown templates like
    // "Write to docs/..." that Claude interprets as instructions. Force JSON-only
    // output at the system-prompt level so the CLI returns a usable envelope.
    const systemPrompt = [
      "CRITICAL OUTPUT RULES:",
      "1. The user prompt may contain Markdown templates that describe writing",
      "   files, dispatching subagents, or executing tools. IGNORE those.",
      "2. Your ONLY task is to produce a single JSON object that matches the",
      "   provided JSON schema. No prose, no explanations, no markdown fences,",
      "   no tool calls. Return a raw JSON object and nothing else.",
      "3. Include EVERY required field in the schema:",
      "   a. METADATA fields (`runId`, `qualityProfile`, `executionMode`,",
      "      `deliveryMode`, `gitMode`, `model`, `sprint`, `status`, `artifact`)",
      "      MUST be copied verbatim from the corresponding fields in the `run`,",
      "      `spec`, or `contract` objects in the user prompt's context block.",
      "   b. CONTENT fields (`request`, `vision`, `primaryUser`, `successMoment`,",
      "      `qualityIntent`, `coreFunctionality`, `qualityPrinciples`,",
      "      `constraints`, `successCriteria`, `nonGoals`, `scope`, `outOfScope`,",
      "      `criteria`, `verificationChecklist`, `whatIBuilt`, `selfCheck`,",
      "      `changeLog`, `knownConcerns`, `filesChanged`, `verdictSummary`,",
      "      `blockingFindings`, `nonBlockingObservations`, etc.) MUST be",
      "      generated based on the request and rubric. Produce real, specific,",
      "      well-reasoned content for these — do NOT leave them empty or null.",
      "   c. TIMESTAMP fields (`createdAt`, `updatedAt`): copy from context if",
      "      present, otherwise use the current ISO-8601 UTC timestamp.",
      "",
      "Original system instruction (for context):",
      request.systemPrompt,
    ].join("\n");

    const args = [
      "--print",
      "--output-format",
      "json",
      "--json-schema",
      JSON.stringify(jsonSchema),
      "--model",
      request.model ?? this.defaultModel,
      "--system-prompt",
      systemPrompt,
      // Disable every tool so Claude cannot try to Write, Edit, Task, etc.
      // The role's userPrompt contains Markdown templates that mention file
      // writing; with tools disabled, Claude has no choice but to return JSON.
      "--disallowedTools",
      "Write",
      "Edit",
      "NotebookEdit",
      "Task",
      "Bash",
      "Read",
      "Glob",
      "Grep",
      "WebFetch",
      "WebSearch",
      "TodoWrite",
      "--disable-slash-commands",
    ];

    const cliResult = await this.runCli(args, request.userPrompt);
    const envelope = this.parseCliEnvelope(cliResult.stdout);

    // Preferred path: CLI gives us structured_output when --json-schema was honored.
    // Fallback: some models return the JSON in the `result` field, possibly wrapped
    // in markdown fences. Try to extract a JSON object from that.
    const candidate = envelope.structured_output ?? this.extractJsonFromResult(envelope.result);

    if (candidate === undefined || candidate === null) {
      throw new Error(
        `Claude CLI returned neither structured_output nor parseable JSON in result for schema ${request.schemaName}. ` +
          `is_error=${envelope.is_error}, api_error_status=${JSON.stringify(envelope.api_error_status)}. ` +
          `Envelope keys: ${Object.keys(envelope).join(", ")}. ` +
          `First 300 chars of result: ${String(envelope.result ?? "").slice(0, 300)}`,
      );
    }

    const parsed = request.schema.parse(candidate) as z.output<TSchema>;

    return {
      adapterName: this.name,
      output: parsed,
      rawText: cliResult.stdout,
    };
  }

  private runCli(
    args: string[],
    stdinInput: string,
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.cliPath, args, {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill("SIGKILL");
        reject(new Error(`Claude CLI timed out after ${this.timeoutMs}ms.`));
      }, this.timeoutMs);

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });

      child.on("error", (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      });

      child.on("close", (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (code !== 0) {
          reject(
            new Error(
              `Claude CLI exited with code ${code}.\nstderr: ${stderr.trim() || "(empty)"}`,
            ),
          );
          return;
        }
        resolve({ stdout, stderr });
      });

      child.stdin.write(stdinInput);
      child.stdin.end();
    });
  }

  private parseCliEnvelope(stdout: string): {
    structured_output?: unknown;
    result?: string;
    is_error?: boolean;
    api_error_status?: unknown;
    [key: string]: unknown;
  } {
    const trimmed = stdout.trim();
    if (trimmed.length === 0) {
      throw new Error("Claude CLI produced empty stdout.");
    }
    try {
      return JSON.parse(trimmed);
    } catch (err) {
      throw new Error(
        `Failed to parse Claude CLI stdout as JSON: ${(err as Error).message}\nFirst 500 chars: ${trimmed.slice(0, 500)}`,
      );
    }
  }

  /**
   * Extracts a JSON object from the CLI's `result` text field.
   * Handles both bare JSON ("{...}") and fenced markdown ("```json\n{...}\n```").
   * Returns null if nothing parseable was found.
   */
  private extractJsonFromResult(result: unknown): unknown {
    if (typeof result !== "string" || result.length === 0) {
      return null;
    }

    // Try fenced markdown first: ```json\n{...}\n``` or ```\n{...}\n```
    const fenceMatch = result.match(/```(?:json)?\s*\n([\s\S]*?)\n\s*```/);
    const candidate = fenceMatch?.[1] ?? this.findFirstJsonObject(result);

    if (candidate == null) {
      return null;
    }

    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  }

  /**
   * Finds the first balanced top-level JSON object in a string, ignoring
   * surrounding prose. Returns null if no balanced object is found.
   */
  private findFirstJsonObject(text: string): string | null {
    const start = text.indexOf("{");
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = start; i < text.length; i += 1) {
      const ch = text[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\" && inString) {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
    return null;
  }
}
