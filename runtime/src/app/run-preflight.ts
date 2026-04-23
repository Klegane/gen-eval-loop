import type { PreflightReport, PreflightStatus, QualityProfile, RunStatus } from "../domain/run-types";
import { resolveAdapterProvider, type AdapterProvider } from "../roles/adapter-factory";
import { checkProviderHealth } from "./check-provider-health";
import { checkRuntimeHealth } from "./check-runtime-health";

export interface RunPreflightInput {
  runtimeRoot: string;
  provider?: AdapterProvider | undefined;
  profile?: QualityProfile | undefined;
  model?: string | undefined;
  playwrightAvailable?: boolean | undefined;
  skipBrowserLaunch?: boolean | undefined;
  env?: NodeJS.ProcessEnv | undefined;
}

const PRECHECK_BYPASS_STATUSES = new Set<RunStatus>(["passed", "capped", "aborted", "completed"]);

export async function runPreflight(input: RunPreflightInput): Promise<PreflightReport> {
  const env = input.env ?? process.env;
  const provider = input.provider ?? resolveAdapterProvider(env);
  const profile = input.profile ?? "ui";
  const model = input.model ?? null;
  const playwrightAvailable = input.playwrightAvailable ?? profile === "ui";
  const skipBrowserLaunch = input.skipBrowserLaunch ?? false;

  const runtimeHealth = await checkRuntimeHealth({
    runtimeRoot: input.runtimeRoot,
    provider,
    profile,
    ...(model == null ? {} : { model }),
    playwrightAvailable,
    verifyBrowserLaunch: profile === "ui" && playwrightAvailable && !skipBrowserLaunch,
    env,
  });

  const providerHealth =
    provider === "development"
      ? undefined
      : await checkProviderHealth({
          provider,
          ...(model == null ? {} : { model }),
          env,
        });

  const blockingReasons = [
    ...runtimeHealth.checks
      .filter((check) => check.status === "FAIL")
      .map((check) => `${check.id}: ${check.summary}`),
    ...(providerHealth?.status === "FAIL"
      ? [`provider-health: ${providerHealth.error?.message ?? "Provider health check failed."}`]
      : []),
  ];

  const remediation = dedupe([
    ...runtimeHealth.checks
      .filter((check) => check.status === "FAIL")
      .flatMap((check) => check.remediation),
    ...(providerHealth?.status === "FAIL" ? providerHealth.error?.remediation ?? [] : []),
  ]);

  return {
    status: blockingReasons.length === 0 ? "PASS" : "FAIL",
    provider,
    profile,
    model,
    runtimeHealth,
    ...(providerHealth == null ? {} : { providerHealth }),
    blockingReasons,
    remediation,
  };
}

export function shouldRunPreflightForStatus(status: RunStatus): boolean {
  return !PRECHECK_BYPASS_STATUSES.has(status);
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}
