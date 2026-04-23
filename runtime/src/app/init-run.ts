import type {
  DeliveryMode,
  ExecutionMode,
  GitMode,
  QualityProfile,
  RunRecord,
} from "../domain/run-types";
import { runRecordSchema, type RunRecordData } from "../schemas/run";
import { FileStore } from "../storage/file-store";
import { getRunPaths, resolveRuntimePaths, type RunPaths, type RuntimePaths } from "../storage/paths";
import { createRunIdFromPrompt } from "../utils/slugify";
import { nowIso } from "../utils/timestamps";

export interface InitRunInput {
  repoRoot: string;
  prompt: string;
  model: string;
  playwrightAvailable: boolean;
  qualityProfile?: QualityProfile;
  executionMode?: ExecutionMode;
  deliveryMode?: DeliveryMode;
  gitMode?: GitMode;
  sprintCap?: number;
  now?: Date;
}

export interface InitializedRun {
  run: RunRecordData;
  runtimePaths: RuntimePaths;
  runPaths: RunPaths;
}

function getDefaultSprintCap(deliveryMode: DeliveryMode): number {
  return deliveryMode === "single-pass" ? 5 : 15;
}

export function createInitialRunRecord(input: InitRunInput): RunRecord {
  const timestamp = input.now ?? new Date();
  const qualityProfile = input.qualityProfile ?? "ui";
  const executionMode = input.executionMode ?? "full-loop";
  const deliveryMode = input.deliveryMode ?? "single-pass";
  const gitMode = input.gitMode ?? "workspace-mode";
  const sprintCap = input.sprintCap ?? getDefaultSprintCap(deliveryMode);
  const isoTimestamp = nowIso(timestamp);

  return {
    runId: createRunIdFromPrompt(input.prompt, timestamp),
    requestPrompt: input.prompt,
    status: "initialized",
    qualityProfile,
    executionMode,
    deliveryMode,
    gitMode,
    model: input.model,
    playwrightAvailable: input.playwrightAvailable,
    currentSprint: 0,
    sprintCap,
    lastCompletedState: "initialized",
    createdAt: isoTimestamp,
    updatedAt: isoTimestamp,
    preflightHistory: [],
    sprints: [],
  };
}

export async function initRun(
  input: InitRunInput,
  fileStore: FileStore = new FileStore(),
): Promise<InitializedRun> {
  const runtimePaths = resolveRuntimePaths(input.repoRoot);
  const candidateRun = createInitialRunRecord(input);
  const run = runRecordSchema.parse(candidateRun);
  const runPaths = getRunPaths(runtimePaths, run.runId);

  await Promise.all([
    fileStore.ensureDirectory(runtimePaths.docsGenEvalDir),
    fileStore.ensureDirectory(runtimePaths.stateDir),
    fileStore.ensureDirectory(runPaths.docsRunDir),
    fileStore.ensureDirectory(runPaths.stateRunDir),
  ]);

  await fileStore.writeJson(runPaths.runJsonPath, run);

  return {
    run,
    runtimePaths,
    runPaths,
  };
}
