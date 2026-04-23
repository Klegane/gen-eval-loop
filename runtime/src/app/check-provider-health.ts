import { z } from "zod";

import type {
  ProviderHealthError,
  ProviderHealthErrorCategory,
  ProviderHealthOutput,
  ProviderHealthReport,
  ProviderHealthStatus,
} from "../domain/run-types";
import { createLlmAdapter, resolveAdapterProvider, type AdapterProvider } from "../roles/adapter-factory";
import { nowIso } from "../utils/timestamps";

export interface CheckProviderHealthInput {
  provider?: AdapterProvider | undefined;
  model?: string | undefined;
  env?: NodeJS.ProcessEnv | undefined;
}

export async function checkProviderHealth(
  input: CheckProviderHealthInput = {},
): Promise<ProviderHealthReport> {
  const env = input.env ?? process.env;
  const provider = input.provider ?? resolveAdapterProvider(env);
  const model = resolveModel(provider, env, input.model);
  const startedAt = Date.now();

  try {
    const adapter = createLlmAdapter({ provider, env });
    const response = await adapter.generateObject({
      schemaName: "provider_health_check",
      schema: buildProviderHealthSchema(provider),
      systemPrompt:
        "You are a provider health-check probe. Return only JSON that matches the schema exactly.",
      userPrompt: [
        "Return a minimal success payload for a runtime provider health check.",
        "Use status='ok'.",
        `Set providerEcho to the exact literal '${provider}'.`,
        "Set message to one short sentence confirming structured output works.",
      ].join("\n"),
      ...(model == null ? {} : { model }),
      metadata: {
        taskType: "health_ping",
        provider,
      },
    });

    return {
      generatedAt: nowIso(),
      provider,
      model: model ?? null,
      adapterName: response.adapterName,
      status: "PASS",
      roundTripMs: Date.now() - startedAt,
      output: response.output,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      generatedAt: nowIso(),
      provider,
      model: model ?? null,
      adapterName: deriveFallbackAdapterName(provider),
      status: "FAIL",
      roundTripMs: Date.now() - startedAt,
      error: classifyProviderError(message, provider),
    };
  }
}

function resolveModel(
  provider: AdapterProvider,
  env: NodeJS.ProcessEnv,
  modelOverride: string | undefined,
): string | undefined {
  if (modelOverride != null && modelOverride.length > 0) {
    return modelOverride;
  }

  switch (provider) {
    case "development":
      return "runtime-dev";
    case "anthropic":
      return env.ANTHROPIC_MODEL;
    case "openai":
      return env.OPENAI_MODEL;
  }
}

function classifyProviderError(message: string, provider: AdapterProvider): ProviderHealthError {
  const lower = message.toLowerCase();

  if (
    lower.includes("credit balance is too low") ||
    lower.includes("insufficient_quota") ||
    lower.includes("billing")
  ) {
    return {
      category: "BILLING",
      message,
      remediation: [`Check billing and credits for the ${provider} account or workspace tied to this API key.`],
    };
  }

  if (
    lower.includes("api key") ||
    lower.includes("unauthorized") ||
    lower.includes("authentication") ||
    lower.includes("invalid_api_key") ||
    lower.includes("401")
  ) {
    return {
      category: "AUTH",
      message,
      remediation: [`Verify the ${provider} API key in runtime/.env and confirm it belongs to the intended account.`],
    };
  }

  if (lower.includes("timed out") || lower.includes("aborterror")) {
    return {
      category: "TIMEOUT",
      message,
      remediation: [
        `Increase the ${provider} timeout environment variable or retry when the provider is less loaded.`,
      ],
    };
  }

  if (
    lower.includes("enotfound") ||
    lower.includes("econnreset") ||
    lower.includes("fetch failed") ||
    lower.includes("network") ||
    lower.includes("socket")
  ) {
    return {
      category: "NETWORK",
      message,
      remediation: ["Verify outbound network access from this runtime and retry the provider health check."],
    };
  }

  if (
    lower.includes("requires a model") ||
    lower.includes("required when gen_eval_llm_provider") ||
    lower.includes("required when gen-eval_llm_provider") ||
    lower.includes("required when")
  ) {
    return {
      category: "CONFIG",
      message,
      remediation: [
        "Set the required provider environment variables in runtime/.env or pass --model/--provider explicitly.",
      ],
    };
  }

  return {
    category: "UNKNOWN",
    message,
    remediation: ["Inspect the raw error message and provider configuration, then retry the health check."],
  };
}

function buildProviderHealthSchema(provider: AdapterProvider) {
  return z
    .object({
      status: z.literal("ok"),
      providerEcho: z.literal(provider),
      message: z.string(),
    })
    .strict();
}

function deriveFallbackAdapterName(provider: AdapterProvider): string {
  switch (provider) {
    case "anthropic":
      return "anthropic-messages";
    case "openai":
      return "openai-responses";
    case "development":
      return "development";
  }
}
