import { access } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

import type {
  QualityProfile,
  RuntimeHealthCheck,
  RuntimeHealthReport,
  RuntimeHealthStatus,
} from "../domain/run-types";
import { createLlmAdapter, resolveAdapterProvider, type AdapterProvider } from "../roles/adapter-factory";
import { nowIso } from "../utils/timestamps";

export interface CheckRuntimeHealthInput {
  runtimeRoot: string;
  provider?: AdapterProvider | undefined;
  profile?: QualityProfile | undefined;
  model?: string | undefined;
  playwrightAvailable?: boolean | undefined;
  verifyBrowserLaunch?: boolean | undefined;
  env?: NodeJS.ProcessEnv | undefined;
}

export async function checkRuntimeHealth(input: CheckRuntimeHealthInput): Promise<RuntimeHealthReport> {
  const env = input.env ?? process.env;
  const provider = input.provider ?? resolveAdapterProvider(env);
  const profile = input.profile ?? "ui";
  const playwrightAvailable = input.playwrightAvailable ?? profile === "ui";
  const verifyBrowserLaunch = input.verifyBrowserLaunch ?? (profile === "ui" && playwrightAvailable);
  const checks: RuntimeHealthCheck[] = [];

  checks.push(await checkEnvFile(input.runtimeRoot));
  checks.push(checkProviderConfiguration(provider, env, input.model));
  checks.push(checkAdapterInstantiation(provider, env));

  if (profile === "ui" && !playwrightAvailable) {
    checks.push({
      id: "playwright-disabled",
      status: "WARN",
      summary: "Playwright checks skipped because this run is configured for static fallback.",
      details: [],
      remediation: ["Set --playwright-available true when you want live browser evidence and launch checks."],
    });
  } else if (profile === "ui") {
    checks.push(await checkPlaywrightBinary());

    if (verifyBrowserLaunch) {
      checks.push(await checkChromiumLaunch());
    } else {
      checks.push({
        id: "playwright-launch",
        status: "WARN",
        summary: "Chromium launch check skipped by configuration.",
        details: [],
        remediation: ["Re-run without --skip-browser-launch to verify live browser launch."],
      });
    }
  } else {
    checks.push({
      id: "playwright-skip",
      status: "WARN",
      summary: `Playwright checks skipped because profile is ${profile}.`,
      details: [],
      remediation: ["Use --profile ui if you want to validate the browser runtime too."],
    });
  }

  return {
    generatedAt: nowIso(),
    provider,
    profile,
    overallStatus: computeOverallStatus(checks),
    checks,
  };
}

async function checkEnvFile(runtimeRoot: string): Promise<RuntimeHealthCheck> {
  const envPath = path.join(runtimeRoot, ".env");

  try {
    await access(envPath);
    return {
      id: "env-file",
      status: "PASS",
      summary: ".env file found in runtime root.",
      details: [envPath],
      remediation: [],
    };
  } catch {
    return {
      id: "env-file",
      status: "WARN",
      summary: ".env file not found in runtime root.",
      details: [envPath],
      remediation: ["Copy .env.example to .env if you want the CLI to auto-load provider credentials."],
    };
  }
}

function checkProviderConfiguration(
  provider: AdapterProvider,
  env: NodeJS.ProcessEnv,
  modelOverride: string | undefined,
): RuntimeHealthCheck {
  switch (provider) {
    case "development":
      return {
        id: "provider-config",
        status: "PASS",
        summary: "Development adapter requires no external credentials.",
        details: [],
        remediation: [],
      };
    case "openai": {
      const missing: string[] = [];
      if (isMissing(env.OPENAI_API_KEY)) {
        missing.push("OPENAI_API_KEY");
      }

      const resolvedModel = modelOverride ?? env.OPENAI_MODEL;
      const status: RuntimeHealthStatus = missing.length > 0 ? "FAIL" : resolvedModel == null ? "WARN" : "PASS";

      return {
        id: "provider-config",
        status,
        summary:
          missing.length > 0
            ? "OpenAI provider configuration is incomplete."
            : resolvedModel == null
              ? "OpenAI credentials are present but no default model is configured."
              : `OpenAI provider configuration looks complete for model ${resolvedModel}.`,
        details: [
          `OPENAI_API_KEY=${maskPresence(env.OPENAI_API_KEY)}`,
          `OPENAI_MODEL=${resolvedModel ?? "<unset>"}`,
          `OPENAI_BASE_URL=${env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"}`,
        ],
        remediation:
          missing.length > 0
            ? missing.map((name) => `Set ${name} in runtime/.env or in the current shell.`)
            : resolvedModel == null
              ? ["Set OPENAI_MODEL in runtime/.env or pass --model on each run."]
              : [],
      };
    }
    case "anthropic": {
      const missing: string[] = [];
      if (isMissing(env.ANTHROPIC_API_KEY)) {
        missing.push("ANTHROPIC_API_KEY");
      }

      const resolvedModel = modelOverride ?? env.ANTHROPIC_MODEL;
      const status: RuntimeHealthStatus = missing.length > 0 ? "FAIL" : resolvedModel == null ? "WARN" : "PASS";

      return {
        id: "provider-config",
        status,
        summary:
          missing.length > 0
            ? "Anthropic provider configuration is incomplete."
            : resolvedModel == null
              ? "Anthropic credentials are present but no default model is configured."
              : `Anthropic provider configuration looks complete for model ${resolvedModel}.`,
        details: [
          `ANTHROPIC_API_KEY=${maskPresence(env.ANTHROPIC_API_KEY)}`,
          `ANTHROPIC_MODEL=${resolvedModel ?? "<unset>"}`,
          `ANTHROPIC_BASE_URL=${env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com/v1"}`,
          `ANTHROPIC_VERSION=${env.ANTHROPIC_VERSION ?? "2023-06-01"}`,
        ],
        remediation:
          missing.length > 0
            ? missing.map((name) => `Set ${name} in runtime/.env or in the current shell.`)
            : resolvedModel == null
              ? ["Set ANTHROPIC_MODEL in runtime/.env or pass --model on each run."]
              : [],
      };
    }
  }
}

function checkAdapterInstantiation(provider: AdapterProvider, env: NodeJS.ProcessEnv): RuntimeHealthCheck {
  try {
    const adapter = createLlmAdapter({ provider, env });
    return {
      id: "adapter-instantiation",
      status: "PASS",
      summary: `Adapter ${adapter.name} instantiated successfully.`,
      details: [],
      remediation: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      id: "adapter-instantiation",
      status: "FAIL",
      summary: "Adapter instantiation failed.",
      details: [message],
      remediation: ["Fix the provider environment variables and rerun check-runtime-health."],
    };
  }
}

async function checkPlaywrightBinary(): Promise<RuntimeHealthCheck> {
  try {
    const executablePath = chromium.executablePath();
    await access(executablePath);

    return {
      id: "playwright-binary",
      status: "PASS",
      summary: "Playwright Chromium executable is present.",
      details: [executablePath],
      remediation: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      id: "playwright-binary",
      status: "FAIL",
      summary: "Playwright Chromium executable is missing or inaccessible.",
      details: [message],
      remediation: ["Run `npx playwright install chromium` before attempting a live ui score run."],
    };
  }
}

async function checkChromiumLaunch(): Promise<RuntimeHealthCheck> {
  try {
    const browser = await chromium.launch({ headless: true });
    await browser.close();

    return {
      id: "chromium-launch",
      status: "PASS",
      summary: "Chromium launched successfully.",
      details: [],
      remediation: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      id: "chromium-launch",
      status: "FAIL",
      summary: "Chromium launch failed.",
      details: [message],
      remediation: buildChromiumRemediation(message),
    };
  }
}

function buildChromiumRemediation(message: string): string[] {
  const lower = message.toLowerCase();

  if (lower.includes("spawn eperm") || lower.includes("permission denied")) {
    return [
      "Run the health check or Playwright evidence command with the required permissions outside the sandbox.",
      "If needed, start the target service outside the sandbox and rerun the browser check.",
    ];
  }

  if (lower.includes("executable doesn't exist") || lower.includes("playwright install")) {
    return ["Run `npx playwright install chromium` and rerun the health check."];
  }

  return ["Inspect the launch error details and verify that Playwright can open Chromium in this environment."];
}

function computeOverallStatus(checks: RuntimeHealthCheck[]): RuntimeHealthStatus {
  if (checks.some((check) => check.status === "FAIL")) {
    return "FAIL";
  }

  if (checks.some((check) => check.status === "WARN")) {
    return "WARN";
  }

  return "PASS";
}

function isMissing(value: string | undefined): boolean {
  return value == null || value.trim().length === 0;
}

function maskPresence(value: string | undefined): string {
  return isMissing(value) ? "<unset>" : "<set>";
}
