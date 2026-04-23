import type { ContractData } from "../schemas/contract";
import { reviewContractDeterministically } from "./contract-capability-checks";
import { contractReviewSchema, type ContractReviewData } from "../schemas/contract-review";
import type { EvidenceData } from "../schemas/evidence";
import type { ReportData } from "../schemas/report";
import type { RunRecordData } from "../schemas/run";
import { scoreSchema, type ScoreData } from "../schemas/score";
import type { SpecData } from "../schemas/spec";
import type { LlmAdapter } from "./llm-adapter";
import { PromptLoader } from "./prompt-loader";
import { buildEvaluatorGuidance } from "./runtime-guidance";

export interface ReviewContractInput {
  run: RunRecordData;
  spec: SpecData;
  contract: ContractData;
}

export interface ScoreSprintInput {
  run: RunRecordData;
  spec: SpecData;
  contract: ContractData;
  report?: ReportData | undefined;
  evidence: EvidenceData;
}

export class EvaluatorRole {
  private readonly promptLoader: PromptLoader;

  constructor(
    repoRoot: string,
    private readonly adapter: LlmAdapter,
  ) {
    this.promptLoader = new PromptLoader(repoRoot);
  }

  async reviewContract(input: ReviewContractInput): Promise<ContractReviewData> {
    const deterministicReview = reviewContractDeterministically(input.run, input.spec, input.contract);
    if (deterministicReview != null) {
      return deterministicReview;
    }

    const bundle = await this.promptLoader.loadBundle(input.run.qualityProfile);

    const response = await this.adapter.generateObject({
      schemaName: "evaluator_contract_review",
      schema: contractReviewSchema,
      model: input.run.model,
      systemPrompt:
        "You are the Evaluator reviewing a sprint contract in a deterministic AI quality runtime. Return only a schema-valid object.",
      userPrompt: [
        "Evaluator prompt template:",
        bundle.evaluatorTemplate,
        "",
        "Active rubric:",
        bundle.rubric,
        "",
        "Artifact schema reference:",
        bundle.artifactSchema,
        "",
        buildEvaluatorGuidance(input.run),
        "",
        "Contract review context:",
        JSON.stringify(
          {
            run: input.run,
            spec: input.spec,
            contract: input.contract,
          },
          null,
          2,
        ),
      ].join("\n"),
      metadata: {
        taskType: "evaluator_contract_review",
        run: input.run,
        spec: input.spec,
        contract: input.contract,
      },
    });

    return response.output;
  }

  async score(input: ScoreSprintInput): Promise<ScoreData> {
    const bundle = await this.promptLoader.loadBundle(input.run.qualityProfile);

    const response = await this.adapter.generateObject({
      schemaName: "evaluator_score",
      schema: scoreSchema,
      model: input.run.model,
      systemPrompt:
        "You are the Evaluator scoring a sprint in a deterministic AI quality runtime. Return only a schema-valid object.",
      userPrompt: [
        "Evaluator prompt template:",
        bundle.evaluatorTemplate,
        "",
        "Active rubric:",
        bundle.rubric,
        "",
        "Artifact schema reference:",
        bundle.artifactSchema,
        "",
        buildEvaluatorGuidance(input.run),
        "",
        "Score context:",
        JSON.stringify(
          {
            run: input.run,
            spec: input.spec,
            contract: input.contract,
            report: input.report ?? null,
            evidence: input.evidence,
          },
          null,
          2,
        ),
      ].join("\n"),
      metadata: {
        taskType: "evaluator_score",
        run: input.run,
        spec: input.spec,
        contract: input.contract,
        report: input.report,
        evidence: input.evidence,
      },
    });

    return response.output;
  }
}
