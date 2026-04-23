import type { SprintDecision } from "../domain/run-types";
import { buildContractSkeleton } from "../app/contract-skeleton";
import { buildReportSkeleton } from "../app/report-skeleton";
import { buildSpecSkeleton } from "../app/spec-skeleton";
import type { ContractData } from "../schemas/contract";
import type { ContractReviewData } from "../schemas/contract-review";
import type { EvidenceData } from "../schemas/evidence";
import type { ReportData } from "../schemas/report";
import type { RunRecordData } from "../schemas/run";
import type { ScoreData } from "../schemas/score";
import type { SpecData } from "../schemas/spec";
import { nowIso } from "../utils/timestamps";
import type { GenerateObjectRequest, GenerateObjectResponse, LlmAdapter } from "./llm-adapter";

interface PlannerSpecMetadata {
  taskType: "planner_spec";
  run: RunRecordData;
  request: string;
}

interface GeneratorContractMetadata {
  taskType: "generator_contract";
  run: RunRecordData;
  spec: SpecData;
  sprint: number;
  decision: SprintDecision;
}

interface GeneratorReportMetadata {
  taskType: "generator_report";
  contract: ContractData;
}

interface EvaluatorContractReviewMetadata {
  taskType: "evaluator_contract_review";
  run: RunRecordData;
  contract: ContractData;
}

interface EvaluatorScoreMetadata {
  taskType: "evaluator_score";
  contract: ContractData;
  evidence: EvidenceData;
}

interface HealthPingMetadata {
  taskType: "health_ping";
  provider: string;
}

type DevelopmentMetadata =
  | PlannerSpecMetadata
  | GeneratorContractMetadata
  | GeneratorReportMetadata
  | EvaluatorContractReviewMetadata
  | EvaluatorScoreMetadata
  | HealthPingMetadata;

export class DevelopmentLlmAdapter implements LlmAdapter {
  readonly name = "development";

  async generateObject<TSchema extends import("zod").ZodTypeAny>(
    request: GenerateObjectRequest<TSchema>,
  ): Promise<GenerateObjectResponse<import("zod").output<TSchema>>> {
    const metadata = this.assertMetadata(request.metadata);
    const payload = this.resolvePayload(metadata);

    return {
      adapterName: this.name,
      output: request.schema.parse(payload),
    };
  }

  private assertMetadata(metadata: Record<string, unknown> | undefined): DevelopmentMetadata {
    if (metadata == null || typeof metadata.taskType !== "string") {
      throw new Error("DevelopmentLlmAdapter requires metadata.taskType.");
    }

    return metadata as unknown as DevelopmentMetadata;
  }

  private resolvePayload(metadata: DevelopmentMetadata): unknown {
    switch (metadata.taskType) {
      case "planner_spec":
        return buildSpecSkeleton(metadata.run, metadata.request);
      case "generator_contract":
        return buildContractSkeleton(
          metadata.run,
          metadata.spec,
          metadata.sprint,
          metadata.decision,
        );
      case "generator_report":
        return buildReportSkeleton(metadata.contract);
      case "evaluator_contract_review":
        return this.reviewContract(metadata.run, metadata.contract);
      case "evaluator_score":
        return this.scoreContract(metadata.contract, metadata.evidence);
      case "health_ping":
        return {
          status: "ok",
          providerEcho: metadata.provider,
          message: "Development adapter structured output is working.",
        };
    }
  }

  private reviewContract(run: RunRecordData, contract: ContractData): ContractReviewData {
    const requestedChanges: string[] = [];
    const allowedDimensions = this.getAllowedDimensions(run.qualityProfile);

    if (contract.scope.length === 0) {
      requestedChanges.push("Populate scope with at least one concrete deliverable.");
    }

    if (contract.outOfScope.length === 0) {
      requestedChanges.push("Populate outOfScope with at least one explicit deferred item.");
    }

    if (contract.verificationChecklist.length === 0) {
      requestedChanges.push("Provide a replayable verification checklist.");
    }

    for (const criterion of contract.criteria) {
      if (!allowedDimensions.has(criterion.dimension)) {
        requestedChanges.push(
          `Criterion ${criterion.id} uses invalid dimension "${criterion.dimension}" for profile ${run.qualityProfile}.`,
        );
      }

      if (criterion.threshold < 7) {
        requestedChanges.push(`Criterion ${criterion.id} threshold must be at least 7 in development adapter.`);
      }

      if (criterion.verificationSteps.length === 0) {
        requestedChanges.push(`Criterion ${criterion.id} must declare verification steps.`);
      }
    }

    const approved = requestedChanges.length === 0;

    return {
      status: approved ? "SIGNED" : "CHANGES_REQUESTED",
      approved,
      updatedAt: nowIso(),
      summary: approved
        ? `Contract is coherent and uses valid ${run.qualityProfile} dimensions.`
        : "Contract needs changes before evaluation can sign it.",
      requestedChanges,
    };
  }

  private scoreContract(contract: ContractData, evidence: EvidenceData): ScoreData {
    const criteria = contract.criteria.map((criterion) => {
      const evidenceCriterion = evidence.criteria.find((entry) => entry.criterionId === criterion.id);
      const status = evidenceCriterion?.status ?? "UNVERIFIED";
      const score =
        status === "PASS" ? Math.max(criterion.threshold, 8) : status === "FAIL" ? Math.max(0, criterion.threshold - 2) : 0;

      return {
        criterionId: criterion.id,
        dimension: criterion.dimension,
        score,
        threshold: criterion.threshold,
        status,
        evidenceRefs:
          evidenceCriterion?.evidence.map(
            (item, index) => item.path ?? item.value ?? `${criterion.id}:${item.type}:${index + 1}`,
          ) ?? [],
      };
    });

    const everyCriterionPassed = criteria.every((criterion) => criterion.status === "PASS");
    const verdict = everyCriterionPassed && evidence.infraFailures.length === 0 ? "PASS" : "FAIL";
    const blockingFindings = [
      ...evidence.infraFailures.map((failure) => `Infrastructure failure: ${failure}`),
      ...criteria
        .filter((criterion) => criterion.status === "FAIL")
        .map((criterion) => `Criterion ${criterion.criterionId} did not meet threshold ${criterion.threshold}.`),
      ...criteria
        .filter((criterion) => criterion.status === "UNVERIFIED")
        .map((criterion) => `Criterion ${criterion.criterionId} remained unverified.`),
    ];

    return {
      runId: contract.runId,
      artifact: "score",
      sprint: contract.sprint,
      evaluationMode: evidence.evaluationMode,
      verdict,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      criteria,
      blockingFindings,
      nonBlockingObservations:
        verdict === "PASS"
          ? ["All contracted criteria met or exceeded their thresholds in the development adapter."]
          : [],
      unverifiedClaims: criteria
        .filter((criterion) => criterion.status === "UNVERIFIED")
        .map((criterion) => `No live evidence confirmed ${criterion.criterionId}.`),
    };
  }

  private getAllowedDimensions(profile: RunRecordData["qualityProfile"]): Set<string> {
    switch (profile) {
      case "ui":
        return new Set(["Design Quality", "Originality", "Craft", "Functionality"]);
      case "backend":
        return new Set(["Correctness", "Reliability", "Observability", "Operability"]);
      case "agentic":
        return new Set(["Task Success", "Robustness", "Tool Discipline", "Recovery Behavior"]);
      case "content":
        return new Set(["Accuracy", "Structure", "Specificity", "Grounding"]);
    }
  }
}
