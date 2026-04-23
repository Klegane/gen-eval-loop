import { summarizeInfraFailureMessage } from "../domain/failure-types";
import { nowIso } from "../utils/timestamps";
import { type RunController, type RunControllerContext } from "./run-controller";

type FinalVerdict = "PASS" | "FAIL" | "ABORTED" | "CAPPED" | "PLANNED";

export interface FinalizeRunInput {
  controller: RunController;
  runId: string;
  finalVerdict?: FinalVerdict | undefined;
}

export async function finalizeRun(input: FinalizeRunInput): Promise<RunControllerContext> {
  const context = await input.controller.loadRun(input.runId);
  const run = context.run;
  const spec = await input.controller.loadSpec(input.runId).catch(() => undefined);
  const latestSprint = run.sprints.at(-1);
  const latestScore =
    latestSprint == null ? undefined : await input.controller.loadScore(input.runId, latestSprint.sprint).catch(() => undefined);
  const latestEvidence =
    latestSprint == null
      ? undefined
      : await input.controller.loadEvidence(input.runId, latestSprint.sprint).catch(() => undefined);

  const finalVerdict = input.finalVerdict ?? deriveFinalVerdict(run.status);
  const strongestEvidence = latestEvidence == null ? [] : collectStrongestEvidence(latestEvidence);
  const residualRisks = [
    ...(latestScore?.blockingFindings.map((finding) => maybeSummarizeInfraFinding(finding)) ?? []),
    ...(latestScore?.unverifiedClaims ?? []),
  ].slice(0, 6);
  const finalVerdictReason =
    (latestScore?.blockingFindings[0] != null
      ? maybeSummarizeInfraFinding(latestScore.blockingFindings[0])
      : undefined) ??
    (latestEvidence?.infraFailures[0] != null
      ? summarizeInfraFailureMessage(latestEvidence.infraFailures[0])
      : undefined) ??
    deriveDefaultReason(finalVerdict);

  return input.controller.writeSummary({
    runId: input.runId,
    summary: {
      runId: run.runId,
      artifact: "summary",
      qualityProfile: run.qualityProfile,
      executionMode: run.executionMode,
      deliveryMode: run.deliveryMode,
      gitMode: run.gitMode,
      model: run.model,
      status: "completed",
      finalVerdict,
      totalSprints: run.sprints.length,
      createdAt: run.createdAt,
      updatedAt: nowIso(),
      requestSummary: spec?.request ?? run.requestPrompt,
      sprintHistory: run.sprints
        .filter((sprint) => sprint.verdict != null)
        .map((sprint) => ({
          sprint: sprint.sprint,
          decision: sprint.decision,
          verdict: sprint.verdict!,
          failedDimensions: sprint.failedCriteria,
          notes:
            sprint.verdict === "PASS"
              ? ["Sprint met contracted thresholds."]
              : sprint.verdict === "INFRA_FAIL"
                ? ["Infrastructure prevented full verification."]
                : ["Sprint did not meet one or more contracted thresholds."],
        })),
      ...(run.preflightHistory.length === 0
        ? {}
        : {
            latestPreflight: run.preflightHistory[run.preflightHistory.length - 1],
          }),
      finalVerdictReason,
      strongestEvidence,
      residualRisks,
      recommendedNextStep: deriveRecommendedNextStep(finalVerdict),
    },
  });
}

function deriveFinalVerdict(status: string): FinalVerdict {
  switch (status) {
    case "passed":
      return "PASS";
    case "aborted":
      return "ABORTED";
    case "capped":
      return "CAPPED";
    case "completed":
      return "PASS";
    default:
      return "FAIL";
  }
}

function deriveDefaultReason(finalVerdict: FinalVerdict): string {
  switch (finalVerdict) {
    case "PASS":
      return "The run met the quality bar with evidence-backed passing criteria.";
    case "ABORTED":
      return "The run was intentionally aborted before a passing verdict was reached.";
    case "CAPPED":
      return "The run hit its sprint cap before it could reach a passing verdict.";
    case "PLANNED":
      return "The run ended after planning artefacts were generated.";
    case "FAIL":
    default:
      return "The run ended without enough passing evidence to justify approval.";
  }
}

function deriveRecommendedNextStep(finalVerdict: FinalVerdict): string {
  switch (finalVerdict) {
    case "PASS":
      return "Promote the passing artefacts or implementation to the next workflow stage.";
    case "CAPPED":
      return "Review the repeated failures, narrow scope, and start a fresh run with a tighter contract.";
    case "ABORTED":
      return "Decide whether to reopen the run or archive it with its incomplete artefacts.";
    case "PLANNED":
      return "Use the spec to begin a signed sprint contract when implementation is ready.";
    case "FAIL":
    default:
      return "Inspect the latest score and evidence, then iterate with a refined sprint contract.";
  }
}

function collectStrongestEvidence(evidence: NonNullable<Awaited<ReturnType<RunController["loadEvidence"]>>>): string[] {
  return evidence.criteria
    .flatMap((criterion) =>
      criterion.evidence.map((item) => item.note || item.path || item.value || criterion.criterionId),
    )
    .slice(0, 6);
}

function maybeSummarizeInfraFinding(finding: string): string {
  if (finding.startsWith("Infrastructure failure: ")) {
    return summarizeInfraFailureMessage(finding.replace("Infrastructure failure: ", ""));
  }

  return finding;
}
