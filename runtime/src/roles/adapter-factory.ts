import { AnthropicMessagesAdapter } from "./anthropic-messages-adapter";
import { ClaudeCliAdapter } from "./claude-cli-adapter";
import { DevelopmentLlmAdapter } from "./development-llm-adapter";
import type { LlmAdapter } from "./llm-adapter";
import { OpenAiResponsesAdapter } from "./openai-responses-adapter";

export const ADAPTER_PROVIDERS = ["development", "openai", "anthropic", "claude-cli"] as const;

export type AdapterProvider = (typeof ADAPTER_PROVIDERS)[number];

export interface CreateAdapterOptions {
  provider?: AdapterProvider | undefined;
  env?: NodeJS.ProcessEnv | undefined;
}

export function createLlmAdapter(options: CreateAdapterOptions = {}): LlmAdapter {
  const env = options.env ?? process.env;
  const provider = options.provider ?? resolveAdapterProvider(env);

  switch (provider) {
    case "development":
      return new DevelopmentLlmAdapter();
    case "anthropic": {
      const apiKey = env.ANTHROPIC_API_KEY;

      if (apiKey == null || apiKey.length === 0) {
        throw new Error("ANTHROPIC_API_KEY is required when GEN_EVAL_LLM_PROVIDER=anthropic.");
      }

      return new AnthropicMessagesAdapter({
        apiKey,
        baseUrl: env.ANTHROPIC_BASE_URL,
        anthropicVersion: env.ANTHROPIC_VERSION,
        defaultModel: env.ANTHROPIC_MODEL,
        timeoutMs: parseTimeout(env.ANTHROPIC_TIMEOUT_MS),
        maxTokens: parseTimeout(env.ANTHROPIC_MAX_TOKENS),
      });
    }
    case "openai": {
      const apiKey = env.OPENAI_API_KEY;

      if (apiKey == null || apiKey.length === 0) {
        throw new Error("OPENAI_API_KEY is required when GEN_EVAL_LLM_PROVIDER=openai.");
      }

      return new OpenAiResponsesAdapter({
        apiKey,
        baseUrl: env.OPENAI_BASE_URL,
        defaultModel: env.OPENAI_MODEL,
        organization: env.OPENAI_ORGANIZATION,
        project: env.OPENAI_PROJECT,
        timeoutMs: parseTimeout(env.OPENAI_TIMEOUT_MS),
      });
    }
    case "claude-cli": {
      return new ClaudeCliAdapter({
        cliPath: env.CLAUDE_CLI_PATH,
        defaultModel: env.CLAUDE_CLI_MODEL,
        timeoutMs: parseTimeout(env.CLAUDE_CLI_TIMEOUT_MS),
      });
    }
  }
}

export function resolveAdapterProvider(env: NodeJS.ProcessEnv = process.env): AdapterProvider {
  const provider = env.GEN_EVAL_LLM_PROVIDER;
  if (provider === "openai" || provider === "anthropic" || provider === "claude-cli") {
    return provider;
  }

  return "development";
}

function parseTimeout(raw: string | undefined): number | undefined {
  if (raw == null || raw.length === 0) {
    return undefined;
  }

  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}
