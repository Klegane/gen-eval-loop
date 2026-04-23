import type { RunRecordData } from "../schemas/run";
import type { SpecData } from "../schemas/spec";
import { nowIso } from "../utils/timestamps";

export function buildSpecSkeleton(
  run: RunRecordData,
  request: string,
  timestamp: Date = new Date(),
): SpecData {
  const isoTimestamp = nowIso(timestamp);

  return {
    runId: run.runId,
    artifact: "spec",
    qualityProfile: run.qualityProfile,
    executionMode: run.executionMode,
    deliveryMode: run.deliveryMode,
    gitMode: run.gitMode,
    model: run.model,
    status: "ready",
    createdAt: isoTimestamp,
    updatedAt: isoTimestamp,
    request,
    vision: `Deliver a quality-gated outcome for: ${request}`,
    primaryUser: "Primary end user defined by the original request",
    successMoment: "The user can accomplish the requested goal without obvious friction or ambiguity.",
    qualityIntent:
      "Create a first-pass quality spec that is specific enough to negotiate a contract and strict enough to prevent vague self-approval.",
    coreFunctionality: [`Satisfy the primary request: ${request}`],
    qualityPrinciples: [
      "Prefer explicit, auditable outcomes over vague aspirations.",
      "Keep scope coherent enough for a single sprint contract.",
      "Every important claim should be verifiable by an evaluator.",
    ],
    constraints: [
      "Only constraints implied by the request or environment should be treated as mandatory.",
    ],
    successCriteria: [
      "A sprint contract can be drafted from this spec without inventing hidden requirements.",
      "The evaluator can derive concrete checks from the spec's quality intent and scope.",
    ],
    nonGoals: [
      "Any requirement not implied by the request, active profile, or repository environment.",
    ],
  };
}
