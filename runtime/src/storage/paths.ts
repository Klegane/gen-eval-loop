import path from "node:path";

export interface RuntimePaths {
  repoRoot: string;
  docsGenEvalDir: string;
  stateDir: string;
}

export interface RunPaths {
  runId: string;
  docsRunDir: string;
  stateRunDir: string;
  runJsonPath: string;
  specJsonPath: string;
  specMarkdownPath: string;
  summaryJsonPath: string;
  summaryMarkdownPath: string;
}

export interface SprintPaths {
  sprint: number;
  sprintDir: string;
  contractJsonPath: string;
  contractMarkdownPath: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
  scoreJsonPath: string;
  scoreMarkdownPath: string;
  evidenceJsonPath: string;
  screenshotsDir: string;
}

export function resolveRuntimePaths(repoRoot: string): RuntimePaths {
  const absoluteRepoRoot = path.resolve(repoRoot);

  return {
    repoRoot: absoluteRepoRoot,
    docsGenEvalDir: path.join(absoluteRepoRoot, "docs", "gen-eval"),
    stateDir: path.join(absoluteRepoRoot, ".gen-eval"),
  };
}

export function getRunPaths(paths: RuntimePaths, runId: string): RunPaths {
  const docsRunDir = path.join(paths.docsGenEvalDir, runId);
  const stateRunDir = path.join(paths.stateDir, runId);

  return {
    runId,
    docsRunDir,
    stateRunDir,
    runJsonPath: path.join(stateRunDir, "run.json"),
    specJsonPath: path.join(stateRunDir, "spec.json"),
    specMarkdownPath: path.join(docsRunDir, "spec.md"),
    summaryJsonPath: path.join(stateRunDir, "summary.json"),
    summaryMarkdownPath: path.join(docsRunDir, "summary.md"),
  };
}

export function getSprintPaths(runPaths: RunPaths, sprint: number): SprintPaths {
  const sprintDir = path.join(runPaths.stateRunDir, `sprint-${sprint}`);

  return {
    sprint,
    sprintDir,
    contractJsonPath: path.join(sprintDir, "contract.json"),
    contractMarkdownPath: path.join(sprintDir, "contract.md"),
    reportJsonPath: path.join(sprintDir, "report.json"),
    reportMarkdownPath: path.join(sprintDir, "report.md"),
    scoreJsonPath: path.join(sprintDir, "score.json"),
    scoreMarkdownPath: path.join(sprintDir, "score.md"),
    evidenceJsonPath: path.join(sprintDir, "evidence.json"),
    screenshotsDir: path.join(sprintDir, "screenshots"),
  };
}
