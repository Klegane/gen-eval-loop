import type { ContractData } from "../schemas/contract";
import type { EvidenceData } from "../schemas/evidence";
import type { ScoreData } from "../schemas/score";
import { nowIso } from "../utils/timestamps";

export interface EvaluationSkeletonResult {
  score: ScoreData;
  evidence: EvidenceData;
}

export function buildEvaluationSkeleton(
  contract: ContractData,
  result: "PASS" | "FAIL" | "INFRA_FAIL",
  timestamp: Date = new Date(),
): EvaluationSkeletonResult {
  const isoTimestamp = nowIso(timestamp);
  const criterionStatus = result === "PASS" ? "PASS" : result === "FAIL" ? "FAIL" : "UNVERIFIED";

  return {
    score: {
      runId: contract.runId,
      artifact: "score",
      sprint: contract.sprint,
      evaluationMode: result === "INFRA_FAIL" ? "static-fallback" : "command-only",
      verdict: result === "PASS" ? "PASS" : "FAIL",
      createdAt: isoTimestamp,
      updatedAt: isoTimestamp,
      criteria: contract.criteria.map((criterion) => ({
        criterionId: criterion.id,
        dimension: criterion.dimension,
        score: result === "PASS" ? 8 : 5,
        threshold: criterion.threshold,
        status: criterionStatus,
        evidenceRefs:
          result === "INFRA_FAIL" ? [] : [`${contract.sprint}:${criterion.id}:${criterionStatus.toLowerCase()}`],
      })),
      blockingFindings:
        result === "PASS" ? [] : ["Skeleton evaluation: failing outcome recorded for runtime flow testing."],
      nonBlockingObservations: result === "PASS" ? ["Skeleton evaluation: all criteria exceeded threshold."] : [],
      unverifiedClaims:
        result === "INFRA_FAIL" ? ["Infrastructure prevented live verification of one or more criteria."] : [],
    },
    evidence: {
      runId: contract.runId,
      sprint: contract.sprint,
      evaluationMode: result === "INFRA_FAIL" ? "static-fallback" : "command-only",
      criteria: contract.criteria.map((criterion) => ({
        criterionId: criterion.id,
        status: criterionStatus,
        evidence:
          result === "INFRA_FAIL"
            ? []
            : [
                {
                  type: "command_output",
                  value: `${criterion.id}:${criterionStatus}`,
                  note: "Skeleton evidence generated for runtime flow testing.",
                },
              ],
      })),
      infraFailures:
        result === "INFRA_FAIL" ? ["Playwright or local infrastructure was unavailable during evaluation."] : [],
    },
  };
}
