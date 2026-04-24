import type { RunRecordData } from "../schemas/run";
import type { ContractData } from "../schemas/contract";
import type { SpecData } from "../schemas/spec";
import { nowIso } from "../utils/timestamps";

const DIMENSIONS_PER_PROFILE: Record<RunRecordData["qualityProfile"], readonly [string, string]> = {
  ui: ["Design Quality", "Functionality"],
  backend: ["Correctness", "Reliability"],
  agentic: ["Task Success", "Robustness"],
  content: ["Accuracy", "Structure"],
};

export function buildContractSkeleton(
  run: RunRecordData,
  spec: SpecData,
  sprint: number,
  decision: "initial" | "refine" | "pivot",
  timestamp: Date = new Date(),
): ContractData {
  const isoTimestamp = nowIso(timestamp);
  const dimensions = DIMENSIONS_PER_PROFILE[run.qualityProfile];

  return {
    runId: run.runId,
    artifact: "contract",
    sprint,
    qualityProfile: run.qualityProfile,
    executionMode: run.executionMode,
    deliveryMode: run.deliveryMode,
    gitMode: run.gitMode,
    status: "drafted",
    decision,
    negotiationRound: 1,
    generatorSigned: true,
    evaluatorSigned: false,
    createdAt: isoTimestamp,
    updatedAt: isoTimestamp,
    scope: spec.coreFunctionality.slice(0, 3),
    outOfScope: spec.nonGoals.slice(0, 2),
    criteria: spec.successCriteria.slice(0, 2).map((criterion, index) => ({
      id: `criterion-${index + 1}`,
      label: criterion,
      dimension: dimensions[index] ?? dimensions[0],
      threshold: 7,
      evidenceTypes:
        run.qualityProfile === "ui"
          ? index === 0
            ? ["screenshot", "console_check"]
            : ["selector_assertion", "console_check"]
          : ["command_output"],
      verificationSteps: [`Verify criterion ${index + 1}: ${criterion}`],
      ...(run.qualityProfile !== "ui"
        ? {}
        : {
            playwright: {
              steps: [
                { type: "goto", url: "/" as const, waitUntil: "load" as const },
                { type: "waitForSelector", selector: "body", state: "visible" as const, timeoutMs: 10_000 },
                ...(index === 0
                  ? [
                      {
                        type: "screenshot" as const,
                        name: `criterion-${index + 1}.png`,
                        fullPage: true,
                      },
                    ]
                  : [
                      {
                        type: "assertSelector" as const,
                        selector: "body",
                        minCount: 1,
                      },
                    ]),
                { type: "checkConsole", level: "error" as const },
              ],
            },
          }),
    })),
    verificationChecklist: [
      "Confirm the implementation is reachable in the local environment.",
      "Validate every criterion with at least one evidence source.",
    ],
    knownConstraints: spec.constraints,
  };
}
