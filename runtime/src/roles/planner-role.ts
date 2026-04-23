import type { RunRecordData } from "../schemas/run";
import { specSchema, type SpecData } from "../schemas/spec";
import type { LlmAdapter } from "./llm-adapter";
import { PromptLoader } from "./prompt-loader";
import { buildPlannerGuidance } from "./runtime-guidance";

export interface PlannerRoleInput {
  run: RunRecordData;
  request: string;
}

export class PlannerRole {
  private readonly promptLoader: PromptLoader;

  constructor(
    repoRoot: string,
    private readonly adapter: LlmAdapter,
  ) {
    this.promptLoader = new PromptLoader(repoRoot);
  }

  async run(input: PlannerRoleInput): Promise<SpecData> {
    const bundle = await this.promptLoader.loadBundle(input.run.qualityProfile);

    const response = await this.adapter.generateObject({
      schemaName: "planner_spec",
      schema: specSchema,
      model: input.run.model,
      systemPrompt:
        "You are the Planner in a deterministic AI quality runtime. Return only a schema-valid object.",
      userPrompt: [
        "Planner prompt template:",
        bundle.plannerTemplate,
        "",
        "Active rubric:",
        bundle.rubric,
        "",
        "Artifact schema reference:",
        bundle.artifactSchema,
        "",
        buildPlannerGuidance(input.run),
        "",
        "Run context:",
        JSON.stringify(
          {
            runId: input.run.runId,
            qualityProfile: input.run.qualityProfile,
            executionMode: input.run.executionMode,
            deliveryMode: input.run.deliveryMode,
            gitMode: input.run.gitMode,
            model: input.run.model,
            request: input.request,
          },
          null,
          2,
        ),
      ].join("\n"),
      metadata: {
        taskType: "planner_spec",
        run: input.run,
        request: input.request,
      },
    });

    return response.output;
  }
}
