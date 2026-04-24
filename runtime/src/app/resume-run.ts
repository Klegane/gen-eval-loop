import { shouldAbortRunForInfraFailure } from "../domain/failure-types";
import { finalizeRun } from "./finalize-run";
import type { RunControllerContext, RunPlaywrightEvidenceInput, RunPlaywrightEvidenceResult } from "./run-controller";
import type { RunController } from "./run-controller";
import { EvaluatorRole } from "../roles/evaluator-role";
import { GeneratorRole } from "../roles/generator-role";
import { PlannerRole } from "../roles/planner-role";
import type { ContractData } from "../schemas/contract";
import type { EvidenceData } from "../schemas/evidence";

export interface ResumeRunInput {
  controller: RunController;
  plannerRole: PlannerRole;
  generatorRole: GeneratorRole;
  evaluatorRole: EvaluatorRole;
  runId: string;
  playwright?: Omit<RunPlaywrightEvidenceInput, "runId" | "sprint"> | undefined;
}

export interface ResumeRunResult extends RunControllerContext {
  completed: boolean;
  lastAction: string;
}

export async function resumeRun(input: ResumeRunInput): Promise<ResumeRunResult> {
  let context = await input.controller.loadRun(input.runId);

  if (context.run.executionMode !== "full-loop") {
    throw new Error("resumeRun currently supports executionMode=full-loop only.");
  }

  // ui profile uses Playwright for live browser evidence.
  // Other profiles (backend/agentic/content) synthesize evidence from the contract criteria
  // and let the Evaluator role score against the spec/contract/report.

  while (true) {
    switch (context.run.status) {
      case "initialized": {
        const spec = await input.plannerRole.run({
          run: context.run,
          request: context.run.requestPrompt,
        });
        context = await input.controller.writeSpec({
          runId: input.runId,
          spec,
        });
        break;
      }

      case "spec_ready":
      case "failed": {
        if (context.run.status === "failed" && context.run.currentSprint >= context.run.sprintCap) {
          context = await input.controller.transitionRun({
            runId: input.runId,
            to: "capped",
            context: { capReached: true },
          });
          const finalized = await finalizeRun({
            controller: input.controller,
            runId: input.runId,
            finalVerdict: "CAPPED",
          });

          return {
            ...finalized,
            completed: true,
            lastAction: "capped",
          };
        }

        const nextSprint = context.run.currentSprint + 1;
        const spec = await input.controller.loadSpec(input.runId);
        const previousScore =
          nextSprint > 1 ? await input.controller.loadScore(input.runId, nextSprint - 1).catch(() => undefined) : undefined;
        const previousEvidence =
          nextSprint > 1
            ? await input.controller.loadEvidence(input.runId, nextSprint - 1).catch(() => undefined)
            : undefined;
        const contract = await input.generatorRole.draftContract({
          run: context.run,
          spec,
          sprint: nextSprint,
          decision: nextSprint === 1 ? "initial" : "refine",
          previousScore,
          previousEvidence,
        });

        context = await input.controller.writeContract({
          runId: input.runId,
          contract,
        });
        break;
      }

      case "contract_drafted": {
        const spec = await input.controller.loadSpec(input.runId);
        const contract = await input.controller.loadContract(input.runId, context.run.currentSprint);
        const review = await input.evaluatorRole.reviewContract({
          run: context.run,
          spec,
          contract,
        });

        if (!review.approved) {
          return {
            ...context,
            completed: false,
            lastAction: "contract_review_changes_requested",
          };
        }

        context = await input.controller.signContract({
          runId: input.runId,
          sprint: context.run.currentSprint,
          updatedAt: review.updatedAt,
        });
        break;
      }

      case "contract_signed": {
        const spec = await input.controller.loadSpec(input.runId);
        const contract = await input.controller.loadContract(input.runId, context.run.currentSprint);
        const report = await input.generatorRole.implement({
          run: context.run,
          spec,
          contract,
        });

        context = await input.controller.writeReport({
          runId: input.runId,
          report,
        });
        break;
      }

      case "implemented": {
        const spec = await input.controller.loadSpec(input.runId);
        const contract = await input.controller.loadContract(input.runId, context.run.currentSprint);
        const report = await input.controller.loadReport(input.runId, context.run.currentSprint);

        let evidence: EvidenceData;
        if (context.run.qualityProfile === "ui") {
          const playResult: RunPlaywrightEvidenceResult = await input.controller.runPlaywrightEvidence({
            runId: input.runId,
            sprint: context.run.currentSprint,
            ...(input.playwright ?? {}),
          });

          context = {
            run: playResult.run,
            runtimePaths: playResult.runtimePaths,
            runPaths: playResult.runPaths,
          };

          evidence = await input.controller.loadEvidence(input.runId, context.run.currentSprint);
        } else {
          // Non-ui profiles have no browser step. Synthesize evidence from contract criteria
          // so the Evaluator can score the spec/contract/report together.
          evidence = buildSyntheticEvidence(contract, context.run.qualityProfile);
        }

        const score = await input.evaluatorRole.score({
          run: context.run,
          spec,
          contract,
          report,
          evidence,
        });

        context = await input.controller.writeEvaluation({
          runId: input.runId,
          score,
          evidence,
        });

        if (shouldAbortRunForInfraFailure(evidence)) {
          context = await input.controller.transitionRun({
            runId: input.runId,
            to: "aborted",
          });

          const finalized = await finalizeRun({
            controller: input.controller,
            runId: input.runId,
            finalVerdict: "ABORTED",
          });

          return {
            ...finalized,
            completed: true,
            lastAction: "aborted_infra",
          };
        }

        break;
      }

      case "passed": {
        const finalized = await finalizeRun({
          controller: input.controller,
          runId: input.runId,
          finalVerdict: "PASS",
        });

        return {
          ...finalized,
          completed: true,
          lastAction: "passed",
        };
      }

      case "capped":
      case "aborted": {
        const finalized = await finalizeRun({
          controller: input.controller,
          runId: input.runId,
          finalVerdict: context.run.status === "capped" ? "CAPPED" : "ABORTED",
        });

        return {
          ...finalized,
          completed: true,
          lastAction: context.run.status,
        };
      }

      case "completed":
        return {
          ...context,
          completed: true,
          lastAction: "completed",
        };

      case "evaluated":
        throw new Error("Run persisted in evaluated state unexpectedly; verdict resolution should already be complete.");
    }
  }
}

/**
 * Builds evidence for non-ui profiles where there is no browser step.
 * Each contract criterion gets a `command_output`-typed evidence item so the
 * Evaluator role has the right shape to score against. The Evaluator still
 * determines the real per-criterion verdict from spec/contract/report content.
 */
function buildSyntheticEvidence(contract: ContractData, profile: string): EvidenceData {
  return {
    runId: contract.runId,
    sprint: contract.sprint,
    evaluationMode: "command-only",
    infraFailures: [],
    criteria: contract.criteria.map((criterion) => ({
      criterionId: criterion.id,
      status: "PASS",
      evidence: [
        {
          type: "command_output",
          value: `${criterion.id}:pending-evaluator-review`,
          note: `Synthetic evidence for ${profile} profile; Evaluator role re-scores against report.`,
        },
      ],
    })),
  };
}
