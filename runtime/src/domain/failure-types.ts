import type { EvidenceData } from "../schemas/evidence";

export const INFRA_FAILURE_TYPES = [
  "missing_playwright_browser",
  "playwright_unavailable",
  "permission_denied",
  "start_command_failed",
  "network_unavailable",
  "unknown_infra",
] as const;

export type InfraFailureType = (typeof INFRA_FAILURE_TYPES)[number];

export interface ClassifiedInfraFailure {
  type: InfraFailureType;
  message: string;
  summary: string;
}

export function classifyInfraFailureMessage(message: string): ClassifiedInfraFailure {
  const normalized = normalizeInfraMessage(message);
  const lower = normalized.toLowerCase();

  if (lower.includes("npx playwright install") || lower.includes("executable doesn't exist at")) {
    return {
      type: "missing_playwright_browser",
      message: normalized,
      summary: "Playwright browser binaries are not installed.",
    };
  }

  if (lower.includes("spawn eperm") || lower.includes("eacces") || lower.includes("permission denied")) {
    return {
      type: "permission_denied",
      message: normalized,
      summary: "The runtime hit a permission or sandbox restriction while starting infrastructure.",
    };
  }

  if (lower.includes("timed out waiting for ready url") || lower.includes("ready url responded")) {
    return {
      type: "start_command_failed",
      message: normalized,
      summary: "The verification target did not become ready in time.",
    };
  }

  if (lower.includes("net::") || lower.includes("failed to fetch") || lower.includes("econnrefused")) {
    return {
      type: "network_unavailable",
      message: normalized,
      summary: "The runtime could not reach the verification target over the network.",
    };
  }

  if (lower.includes("playwright")) {
    return {
      type: "playwright_unavailable",
      message: normalized,
      summary: "Playwright could not run successfully in the current environment.",
    };
  }

  return {
    type: "unknown_infra",
    message: normalized,
    summary: "Infrastructure prevented the run from completing live verification.",
  };
}

export function classifyEvidenceInfraFailures(evidence: EvidenceData): ClassifiedInfraFailure[] {
  return evidence.infraFailures.map((failure) => classifyInfraFailureMessage(failure));
}

export function shouldAbortRunForInfraFailure(evidence: EvidenceData): boolean {
  const failures = classifyEvidenceInfraFailures(evidence);

  return failures.some((failure) =>
    failure.type === "missing_playwright_browser" ||
    failure.type === "permission_denied" ||
    failure.type === "playwright_unavailable",
  );
}

export function summarizeInfraFailureMessage(message: string): string {
  const classified = classifyInfraFailureMessage(message);
  return `${classified.summary} ${extractActionHint(classified.message)}`.trim();
}

function extractActionHint(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("npx playwright install")) {
    return "Run `npx playwright install` before retrying.";
  }

  if (lower.includes("spawn eperm")) {
    return "Retry with the required permissions or run the target service outside the sandbox.";
  }

  if (lower.includes("timed out waiting for ready url")) {
    return "Verify the target app starts and responds before running evaluation again.";
  }

  return "";
}

function normalizeInfraMessage(message: string): string {
  return message
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
