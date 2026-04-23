import type { ContractData } from "../schemas/contract";
import type { ContractReviewData } from "../schemas/contract-review";
import type { RunRecordData } from "../schemas/run";
import type { SpecData } from "../schemas/spec";
import { nowIso } from "../utils/timestamps";

const BROWSER_ONLY_EVIDENCE = new Set(["screenshot", "console_check", "selector_assertion"]);

export function reviewContractDeterministically(
  run: RunRecordData,
  spec: SpecData,
  contract: ContractData,
): ContractReviewData | undefined {
  const requestedChanges: string[] = [];
  const hasFileUrl = contract.criteria.some((criterion) =>
    criterion.playwright?.steps.some(
      (step) => step.type === "goto" && step.url.toLowerCase().startsWith("file://"),
    ) ?? false,
  );

  if (run.executionMode === "full-loop" && spec.status !== "ready") {
    requestedChanges.push("Spec status must be `ready` before drafting a full-loop implementation contract.");
  }

  if (contract.generatorSigned !== true) {
    requestedChanges.push("Generator must sign the drafted contract before review.");
  }

  if (contract.evaluatorSigned) {
    requestedChanges.push("Evaluator signature must remain false until the contract is approved.");
  }

  if (contract.decision !== "initial" && contract.sprint === 1) {
    requestedChanges.push("Sprint 1 contracts should use decision `initial`.");
  }

  if (run.playwrightAvailable === false) {
    for (const criterion of contract.criteria) {
      const browserOnlyEvidence = criterion.evidenceTypes.filter((type) => BROWSER_ONLY_EVIDENCE.has(type));
      if (browserOnlyEvidence.length > 0) {
        requestedChanges.push(
          `Criterion ${criterion.id} uses browser-only evidence types (${browserOnlyEvidence.join(", ")}) but playwrightAvailable is false.`,
        );
      }
    }

    for (const step of contract.verificationChecklist) {
      const lowered = step.toLowerCase();
      if (lowered.includes("console") || lowered.includes("screenshot") || lowered.includes("selector")) {
        requestedChanges.push(
          `Verification checklist step "${step}" depends on browser tooling that is unavailable in this run.`,
        );
      }
    }
  }

  if (hasFileUrl) {
    requestedChanges.push(
      "Playwright `goto` steps must use relative HTTP paths like `/` or `/index.html`, not `file://` URLs.",
    );
  }

  if (
    hasFileUrl &&
    contract.verificationChecklist.some((step) => step.toLowerCase().includes("http 200"))
  ) {
    requestedChanges.push(
      "Do not require HTTP 200 verification when the contract uses `file://` navigation. Serve the target over local HTTP or remove the HTTP status check.",
    );
  }

  if (requestedChanges.length === 0) {
    return undefined;
  }

  return {
    status: "CHANGES_REQUESTED",
    approved: false,
    updatedAt: nowIso(),
    summary: "Contract failed deterministic runtime checks before model review.",
    requestedChanges,
  };
}
