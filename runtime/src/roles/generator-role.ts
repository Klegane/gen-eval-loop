import type { SprintDecision } from "../domain/run-types";
import type { ContractData } from "../schemas/contract";
import { contractSchema } from "../schemas/contract";
import type { EvidenceData } from "../schemas/evidence";
import type { ReportData } from "../schemas/report";
import { reportSchema } from "../schemas/report";
import type { RunRecordData } from "../schemas/run";
import type { ScoreData } from "../schemas/score";
import type { SpecData } from "../schemas/spec";
import type { LlmAdapter } from "./llm-adapter";
import { PromptLoader } from "./prompt-loader";
import { buildGeneratorGuidance } from "./runtime-guidance";

export interface DraftContractInput {
  run: RunRecordData;
  spec: SpecData;
  sprint: number;
  decision: SprintDecision;
  previousScore?: ScoreData | undefined;
  previousEvidence?: EvidenceData | undefined;
}

export interface ImplementInput {
  run: RunRecordData;
  spec: SpecData;
  contract: ContractData;
}

export class GeneratorRole {
  private readonly promptLoader: PromptLoader;

  constructor(
    repoRoot: string,
    private readonly adapter: LlmAdapter,
  ) {
    this.promptLoader = new PromptLoader(repoRoot);
  }

  async draftContract(input: DraftContractInput): Promise<ContractData> {
    if (input.spec.status !== "ready") {
      throw new Error("Cannot draft a full contract from a spec that is not `ready`.");
    }

    const bundle = await this.promptLoader.loadBundle(input.run.qualityProfile);

    const response = await this.adapter.generateObject({
      schemaName: "generator_contract",
      schema: contractSchema,
      model: input.run.model,
      systemPrompt:
        "You are the Generator drafting a sprint contract in a deterministic AI quality runtime. Return only a schema-valid object.",
      userPrompt: [
        "Generator prompt template:",
        bundle.generatorTemplate,
        "",
        "Active rubric:",
        bundle.rubric,
        "",
        "Artifact schema reference:",
        bundle.artifactSchema,
        "",
        buildGeneratorGuidance(input.run),
        "",
        "Draft contract context:",
        JSON.stringify(
          {
            run: input.run,
            spec: input.spec,
            sprint: input.sprint,
            decision: input.decision,
            previousScore: input.previousScore ?? null,
            previousEvidence: input.previousEvidence ?? null,
          },
          null,
          2,
        ),
      ].join("\n"),
      metadata: {
        taskType: "generator_contract",
        run: input.run,
        spec: input.spec,
        sprint: input.sprint,
        decision: input.decision,
        previousScore: input.previousScore,
        previousEvidence: input.previousEvidence,
      },
    });

    return response.output;
  }

  async implement(input: ImplementInput): Promise<ReportData> {
    const bundle = await this.promptLoader.loadBundle(input.run.qualityProfile);

    const response = await this.adapter.generateObject({
      schemaName: "generator_report",
      schema: reportSchema,
      model: input.run.model,
      systemPrompt:
        "You are the Generator implementing a signed contract in a deterministic AI quality runtime. Return only a schema-valid object.",
      userPrompt: [
        "Generator prompt template:",
        bundle.generatorTemplate,
        "",
        "Active rubric:",
        bundle.rubric,
        "",
        "Artifact schema reference:",
        bundle.artifactSchema,
        "",
        buildGeneratorGuidance(input.run),
        "",
        "Implementation context:",
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
        taskType: "generator_report",
        run: input.run,
        spec: input.spec,
        contract: input.contract,
      },
    });

    return response.output;
  }
}
