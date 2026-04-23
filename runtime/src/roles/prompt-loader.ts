import path from "node:path";

import type { QualityProfile } from "../domain/run-types";
import { FileStore } from "../storage/file-store";

export interface PromptBundle {
  plannerTemplate: string;
  generatorTemplate: string;
  evaluatorTemplate: string;
  artifactSchema: string;
  rubric: string;
}

export class PromptLoader {
  constructor(
    private readonly repoRoot: string,
    private readonly fileStore: FileStore = new FileStore(),
  ) {}

  async loadBundle(profile: QualityProfile): Promise<PromptBundle> {
    const skillRoot = path.join(this.repoRoot, "skills", "gen-eval-loop");

    const [
      plannerTemplate,
      generatorTemplate,
      evaluatorTemplate,
      artifactSchema,
      rubric,
    ] = await Promise.all([
      this.fileStore.readText(path.join(skillRoot, "planner-prompt.md")),
      this.fileStore.readText(path.join(skillRoot, "generator-prompt.md")),
      this.fileStore.readText(path.join(skillRoot, "evaluator-prompt.md")),
      this.fileStore.readText(path.join(skillRoot, "artifact-schema.md")),
      this.fileStore.readText(path.join(skillRoot, "profiles", profile, "rubric.md")),
    ]);

    return {
      plannerTemplate,
      generatorTemplate,
      evaluatorTemplate,
      artifactSchema,
      rubric,
    };
  }
}
