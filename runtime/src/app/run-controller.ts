import {
  applyTransition,
  assertEvaluationContext,
  getNextEvaluationStatus,
} from "../domain/state-machine";
import type { RunStatus, SprintRecord, SprintVerdict, TransitionContext } from "../domain/run-types";
import {
  PlaywrightRunner,
  type PlaywrightRunnerInput,
  type PlaywrightRunnerResult,
  type PlaywrightStartCommand,
} from "../evidence/playwright-runner";
import { contractSchema, type ContractData, type ContractInput } from "../schemas/contract";
import { evidenceSchema, type EvidenceData, type EvidenceInput } from "../schemas/evidence";
import { preflightReportSchema, type PreflightReportInput } from "../schemas/preflight";
import { reportSchema, type ReportData, type ReportInput } from "../schemas/report";
import { runRecordSchema, type RunRecordData } from "../schemas/run";
import { scoreSchema, type ScoreData, type ScoreInput } from "../schemas/score";
import { specSchema, type SpecData, type SpecInput } from "../schemas/spec";
import { summarySchema, type SummaryData, type SummaryInput } from "../schemas/summary";
import {
  renderContractMarkdown,
  renderReportMarkdown,
  renderScoreMarkdown,
  renderSpecMarkdown,
  renderSummaryMarkdown,
} from "../render/markdown-renderer";
import { FileStore } from "../storage/file-store";
import {
  getRunPaths,
  getSprintPaths,
  resolveRuntimePaths,
  type RunPaths,
  type RuntimePaths,
} from "../storage/paths";
import { nowIso } from "../utils/timestamps";
import { initRun, type InitRunInput, type InitializedRun } from "./init-run";

export interface RunControllerContext {
  run: RunRecordData;
  runtimePaths: RuntimePaths;
  runPaths: RunPaths;
}

export interface RunPlaywrightEvidenceInput {
  runId: string;
  sprint: number;
  baseUrl?: string;
  browser?: PlaywrightRunnerInput["browser"];
  headless?: boolean;
  defaultTimeoutMs?: number;
  startCommand?: PlaywrightStartCommand;
}

export interface RunPlaywrightEvidenceResult extends RunControllerContext {
  evidence: EvidenceData;
  evidenceJsonPath: string;
  screenshotsDir: string;
  criterionFailures: Record<string, string[]>;
  startupLogs: string[];
}

export class RunController {
  private readonly runtimePaths: RuntimePaths;

  constructor(
    repoRoot: string,
    private readonly fileStore: FileStore = new FileStore(),
  ) {
    this.runtimePaths = resolveRuntimePaths(repoRoot);
  }

  async initializeRun(input: Omit<InitRunInput, "repoRoot">): Promise<InitializedRun> {
    return initRun(
      {
        repoRoot: this.runtimePaths.repoRoot,
        ...input,
      },
      this.fileStore,
    );
  }

  async loadRun(runId: string): Promise<RunControllerContext> {
    const runPaths = getRunPaths(this.runtimePaths, runId);
    const run = runRecordSchema.parse(await this.fileStore.readJson(runPaths.runJsonPath));

    return {
      run,
      runtimePaths: this.runtimePaths,
      runPaths,
    };
  }

  async transitionRun(input: {
    runId: string;
    to: RunStatus;
    context?: TransitionContext;
    updatedAt?: string;
  }): Promise<RunControllerContext> {
    const context = await this.loadRun(input.runId);
    const updatedAt = input.updatedAt ?? nowIso();
    const nextRun = runRecordSchema.parse(
      applyTransition(context.run, input.to, input.context ?? {}, updatedAt),
    );

    await this.fileStore.writeJson(context.runPaths.runJsonPath, nextRun);

    return {
      ...context,
      run: nextRun,
    };
  }

  async recordPreflight(input: { runId: string; preflight: PreflightReportInput }): Promise<RunControllerContext> {
    const context = await this.loadRun(input.runId);
    const preflight = preflightReportSchema.parse(input.preflight);
    const nextRun = runRecordSchema.parse({
      ...context.run,
      updatedAt: preflight.runtimeHealth.generatedAt,
      preflightHistory: [...context.run.preflightHistory, preflight],
    });

    await this.fileStore.writeJson(context.runPaths.runJsonPath, nextRun);

    return {
      ...context,
      run: nextRun,
    };
  }

  async writeSpec(input: { runId: string; spec: SpecInput }): Promise<RunControllerContext> {
    const context = await this.loadRun(input.runId);
    const spec = specSchema.parse(input.spec);

    this.assertSpecMatchesRun(spec, context.run);

    const nextRun =
      context.run.status === "initialized"
        ? runRecordSchema.parse(
            applyTransition(context.run, "spec_ready", { hasSpec: true }, spec.updatedAt),
          )
        : runRecordSchema.parse({
            ...context.run,
            updatedAt: spec.updatedAt,
          });

    await Promise.all([
      this.fileStore.writeJson(context.runPaths.specJsonPath, spec),
      this.fileStore.writeText(context.runPaths.specMarkdownPath, renderSpecMarkdown(spec)),
      this.fileStore.writeJson(context.runPaths.runJsonPath, nextRun),
    ]);

    return {
      ...context,
      run: nextRun,
    };
  }

  async writeSummary(input: { runId: string; summary: SummaryInput }): Promise<RunControllerContext> {
    const context = await this.loadRun(input.runId);
    const summary = summarySchema.parse(input.summary);

    this.assertSummaryMatchesRun(summary, context.run);

    const nextRun =
      context.run.status === "completed"
        ? runRecordSchema.parse({
            ...context.run,
            updatedAt: summary.updatedAt,
          })
        : runRecordSchema.parse(applyTransition(context.run, "completed", {}, summary.updatedAt));

    await Promise.all([
      this.fileStore.writeJson(context.runPaths.summaryJsonPath, summary),
      this.fileStore.writeText(context.runPaths.summaryMarkdownPath, renderSummaryMarkdown(summary)),
      this.fileStore.writeJson(context.runPaths.runJsonPath, nextRun),
    ]);

    return {
      ...context,
      run: nextRun,
    };
  }

  async loadSpec(runId: string): Promise<SpecData> {
    const context = await this.loadRun(runId);
    return specSchema.parse(await this.fileStore.readJson(context.runPaths.specJsonPath));
  }

  async loadContract(runId: string, sprint: number): Promise<ContractData> {
    const context = await this.loadRun(runId);
    const sprintPaths = getSprintPaths(context.runPaths, sprint);
    return contractSchema.parse(await this.fileStore.readJson(sprintPaths.contractJsonPath));
  }

  async loadReport(runId: string, sprint: number): Promise<ReportData> {
    const context = await this.loadRun(runId);
    const sprintPaths = getSprintPaths(context.runPaths, sprint);
    return reportSchema.parse(await this.fileStore.readJson(sprintPaths.reportJsonPath));
  }

  async loadEvidence(runId: string, sprint: number): Promise<EvidenceData> {
    const context = await this.loadRun(runId);
    const sprintPaths = getSprintPaths(context.runPaths, sprint);
    return evidenceSchema.parse(await this.fileStore.readJson(sprintPaths.evidenceJsonPath));
  }

  async loadScore(runId: string, sprint: number): Promise<ScoreData> {
    const context = await this.loadRun(runId);
    const sprintPaths = getSprintPaths(context.runPaths, sprint);
    return scoreSchema.parse(await this.fileStore.readJson(sprintPaths.scoreJsonPath));
  }

  async writeContract(input: { runId: string; contract: ContractInput }): Promise<RunControllerContext> {
    const context = await this.loadRun(input.runId);
    const contract = contractSchema.parse(input.contract);

    this.assertContractMatchesRun(contract, context.run);

    const sprintPaths = getSprintPaths(context.runPaths, contract.sprint);
    const sprintRecord = this.buildSprintRecord(context.run, contract.sprint, contract.decision, {
      state: contract.status === "signed" ? "contract_signed" : "contract_drafted",
      artifactPaths: {
        contractJson: sprintPaths.contractJsonPath,
        contractMarkdown: sprintPaths.contractMarkdownPath,
      },
    });

    let nextRun = this.upsertSprint(context.run, sprintRecord, contract.updatedAt);

    if (nextRun.status === "spec_ready" || nextRun.status === "failed") {
      nextRun = runRecordSchema.parse(
        applyTransition(nextRun, "contract_drafted", { hasContract: true }, contract.updatedAt),
      );
    }

    if (contract.status === "signed" && nextRun.status === "contract_drafted") {
      nextRun = runRecordSchema.parse(
        applyTransition(nextRun, "contract_signed", { hasSignedContract: true }, contract.updatedAt),
      );
    }

    if (nextRun.status !== "contract_drafted" && nextRun.status !== "contract_signed") {
      nextRun = runRecordSchema.parse({
        ...nextRun,
        updatedAt: contract.updatedAt,
      });
    }

    await Promise.all([
      this.fileStore.ensureDirectory(sprintPaths.sprintDir),
      this.fileStore.writeJson(sprintPaths.contractJsonPath, contract),
      this.fileStore.writeText(sprintPaths.contractMarkdownPath, renderContractMarkdown(contract)),
      this.fileStore.writeJson(context.runPaths.runJsonPath, nextRun),
    ]);

    return {
      ...context,
      run: nextRun,
    };
  }

  async signContract(input: { runId: string; sprint: number; updatedAt?: string }): Promise<RunControllerContext> {
    const contract = await this.loadContract(input.runId, input.sprint);
    const updatedAt = input.updatedAt ?? contract.updatedAt;

    return this.writeContract({
      runId: input.runId,
      contract: {
        ...contract,
        status: "signed",
        generatorSigned: true,
        evaluatorSigned: true,
        updatedAt,
      },
    });
  }

  async writeReport(input: { runId: string; report: ReportInput }): Promise<RunControllerContext> {
    const context = await this.loadRun(input.runId);
    const report = reportSchema.parse(input.report);

    this.assertReportMatchesRun(report, context.run);

    const sprintRecord = this.getExistingSprint(context.run, report.sprint);
    if (sprintRecord == null) {
      throw new Error(`Cannot write report for sprint ${report.sprint} before a contract exists.`);
    }

    if (sprintRecord.state !== "contract_signed" && sprintRecord.state !== "implemented") {
      throw new Error(
        `Cannot write report for sprint ${report.sprint} before the contract is signed.`,
      );
    }

    const sprintPaths = getSprintPaths(context.runPaths, report.sprint);
    const nextRunBase = this.upsertSprint(
      context.run,
      {
        ...sprintRecord,
        state: "implemented",
        artifactPaths: {
          ...sprintRecord.artifactPaths,
          reportJson: sprintPaths.reportJsonPath,
          reportMarkdown: sprintPaths.reportMarkdownPath,
        },
      },
      report.updatedAt,
    );

    const nextRun =
      nextRunBase.status === "contract_signed"
        ? runRecordSchema.parse(
            applyTransition(nextRunBase, "implemented", { hasReport: true }, report.updatedAt),
          )
        : runRecordSchema.parse({
            ...nextRunBase,
            updatedAt: report.updatedAt,
          });

    await Promise.all([
      this.fileStore.ensureDirectory(sprintPaths.sprintDir),
      this.fileStore.writeJson(sprintPaths.reportJsonPath, report),
      this.fileStore.writeText(sprintPaths.reportMarkdownPath, renderReportMarkdown(report)),
      this.fileStore.writeJson(context.runPaths.runJsonPath, nextRun),
    ]);

    return {
      ...context,
      run: nextRun,
    };
  }

  async runPlaywrightEvidence(
    input: RunPlaywrightEvidenceInput,
  ): Promise<RunPlaywrightEvidenceResult> {
    const context = await this.loadRun(input.runId);

    if (context.run.qualityProfile !== "ui") {
      throw new Error("Playwright evidence collection is currently only supported for the ui profile.");
    }

    const contract = await this.loadContract(input.runId, input.sprint);
    const sprintRecord = this.getExistingSprint(context.run, input.sprint);

    if (sprintRecord == null) {
      throw new Error(`Cannot collect evidence for sprint ${input.sprint} before a contract exists.`);
    }

    const canEvaluateFromSignedContract =
      context.run.executionMode === "evaluate-only" && sprintRecord.state === "contract_signed";
    const canEvaluateFromImplementedSprint =
      sprintRecord.state === "implemented" || sprintRecord.state === "evaluated";

    if (!canEvaluateFromSignedContract && !canEvaluateFromImplementedSprint) {
      throw new Error(
        `Cannot collect Playwright evidence for sprint ${input.sprint} before the implementation stage is complete.`,
      );
    }

    const runnableCriteria = contract.criteria
      .filter((criterion) => criterion.playwright != null)
      .map((criterion) => ({
        criterionId: criterion.id,
        steps: criterion.playwright?.steps ?? [],
        ...(criterion.playwright?.stopOnFailure == null
          ? {}
          : { stopOnFailure: criterion.playwright.stopOnFailure }),
      }));

    if (runnableCriteria.length === 0) {
      throw new Error(
        `Contract for sprint ${input.sprint} does not define any Playwright plans on its criteria.`,
      );
    }

    const sprintPaths = getSprintPaths(context.runPaths, input.sprint);
    const runner = new PlaywrightRunner();
    const runnerResult: PlaywrightRunnerResult = await runner.run({
      runId: input.runId,
      sprint: input.sprint,
      criteria: runnableCriteria,
      outputDir: sprintPaths.screenshotsDir,
      ...(input.baseUrl == null ? {} : { baseUrl: input.baseUrl }),
      ...(input.browser == null ? {} : { browser: input.browser }),
      ...(input.headless == null ? {} : { headless: input.headless }),
      ...(input.defaultTimeoutMs == null ? {} : { defaultTimeoutMs: input.defaultTimeoutMs }),
      ...(input.startCommand == null ? {} : { startCommand: input.startCommand }),
    });
    const evidence = evidenceSchema.parse(runnerResult.evidence);
    const updatedAt = nowIso();
    const nextRun = this.upsertSprint(
      context.run,
      {
        ...sprintRecord,
        artifactPaths: {
          ...sprintRecord.artifactPaths,
          evidenceJson: sprintPaths.evidenceJsonPath,
          screenshotsDir: sprintPaths.screenshotsDir,
        },
      },
      updatedAt,
    );

    await Promise.all([
      this.fileStore.ensureDirectory(sprintPaths.sprintDir),
      this.fileStore.writeJson(sprintPaths.evidenceJsonPath, evidence),
      this.fileStore.writeJson(context.runPaths.runJsonPath, nextRun),
    ]);

    return {
      ...context,
      run: nextRun,
      evidence,
      evidenceJsonPath: sprintPaths.evidenceJsonPath,
      screenshotsDir: sprintPaths.screenshotsDir,
      criterionFailures: runnerResult.criterionFailures,
      startupLogs: runnerResult.startupLogs,
    };
  }

  async writeEvaluation(input: {
    runId: string;
    score: ScoreInput;
    evidence: EvidenceInput;
  }): Promise<RunControllerContext> {
    const context = await this.loadRun(input.runId);
    const score = scoreSchema.parse(input.score);
    const evidence = evidenceSchema.parse(input.evidence);

    this.assertScoreMatchesRun(score, context.run);
    this.assertEvidenceMatchesRun(evidence, context.run);

    if (score.runId !== evidence.runId || score.sprint !== evidence.sprint) {
      throw new Error("Score and evidence must belong to the same run and sprint.");
    }

    const sprintRecord = this.getExistingSprint(context.run, score.sprint);
    if (sprintRecord == null) {
      throw new Error(`Cannot evaluate sprint ${score.sprint} before a contract exists.`);
    }

    const canEvaluateFromSignedContract =
      context.run.executionMode === "evaluate-only" && sprintRecord.state === "contract_signed";
    const canEvaluateFromImplementedSprint = sprintRecord.state === "implemented" || sprintRecord.state === "evaluated";

    if (!canEvaluateFromSignedContract && !canEvaluateFromImplementedSprint) {
      throw new Error(
        `Cannot evaluate sprint ${score.sprint} before the implementation stage is complete.`,
      );
    }

    const sprintPaths = getSprintPaths(context.runPaths, score.sprint);
    const failedCriteria = score.criteria
      .filter((criterion) => criterion.status !== "PASS")
      .map((criterion) => criterion.criterionId);
    const sprintVerdict = this.resolveSprintVerdict(score, evidence);
    const nextRunBase = this.upsertSprint(
      context.run,
      {
        ...sprintRecord,
        state: "evaluated",
        verdict: sprintVerdict,
        failedCriteria,
        artifactPaths: {
          ...sprintRecord.artifactPaths,
          scoreJson: sprintPaths.scoreJsonPath,
          evidenceJson: sprintPaths.evidenceJsonPath,
          scoreMarkdown: sprintPaths.scoreMarkdownPath,
        },
      },
      score.updatedAt,
    );

    let nextRun =
      nextRunBase.status === "implemented" || nextRunBase.status === "contract_signed"
        ? runRecordSchema.parse(
            applyTransition(
              nextRunBase,
              "evaluated",
              { hasScore: true, hasEvidence: true },
              score.updatedAt,
            ),
          )
        : runRecordSchema.parse({
            ...nextRunBase,
            updatedAt: score.updatedAt,
          });

    assertEvaluationContext({ hasScore: true, hasEvidence: true });

    const hasUnverifiedCriteria = score.criteria.some((criterion) => criterion.status === "UNVERIFIED");
    const everyCriterionPassed = score.criteria.every((criterion) => criterion.status === "PASS");
    const verdictStatus = getNextEvaluationStatus({
      hasScore: true,
      hasEvidence: true,
      everyCriterionPassed,
      hasUnverifiedCriteria,
    });

    if (nextRun.status === "evaluated") {
      nextRun = runRecordSchema.parse(
        applyTransition(
          nextRun,
          verdictStatus,
          {
            hasScore: true,
            hasEvidence: true,
            everyCriterionPassed,
            hasUnverifiedCriteria,
          },
          score.updatedAt,
        ),
      );
    } else if (nextRun.status === "passed" || nextRun.status === "failed") {
      if (nextRun.status !== verdictStatus) {
        throw new Error(
          `Evaluation rewrite attempted to change run verdict from ${nextRun.status} to ${verdictStatus}.`,
        );
      }

      nextRun = runRecordSchema.parse({
        ...nextRun,
        updatedAt: score.updatedAt,
      });
    } else {
      throw new Error(`Run must be in evaluated state before resolving verdict, got ${nextRun.status}.`);
    }

    await Promise.all([
      this.fileStore.ensureDirectory(sprintPaths.sprintDir),
      this.fileStore.writeJson(sprintPaths.scoreJsonPath, score),
      this.fileStore.writeJson(sprintPaths.evidenceJsonPath, evidence),
      this.fileStore.writeText(sprintPaths.scoreMarkdownPath, renderScoreMarkdown(score)),
      this.fileStore.writeJson(context.runPaths.runJsonPath, nextRun),
    ]);

    return {
      ...context,
      run: nextRun,
    };
  }

  private assertSpecMatchesRun(spec: SpecData, run: RunRecordData): void {
    if (spec.runId !== run.runId) {
      throw new Error("Spec runId does not match run.json.");
    }

    if (spec.qualityProfile !== run.qualityProfile) {
      throw new Error("Spec qualityProfile does not match run.json.");
    }

    if (spec.executionMode !== run.executionMode) {
      throw new Error("Spec executionMode does not match run.json.");
    }

    if (spec.deliveryMode !== run.deliveryMode) {
      throw new Error("Spec deliveryMode does not match run.json.");
    }

    if (spec.gitMode !== run.gitMode) {
      throw new Error("Spec gitMode does not match run.json.");
    }

    if (spec.model !== run.model) {
      throw new Error("Spec model does not match run.json.");
    }
  }

  private assertSummaryMatchesRun(summary: SummaryData, run: RunRecordData): void {
    if (summary.runId !== run.runId) {
      throw new Error("Summary runId does not match run.json.");
    }

    if (summary.qualityProfile !== run.qualityProfile) {
      throw new Error("Summary qualityProfile does not match run.json.");
    }

    if (summary.executionMode !== run.executionMode) {
      throw new Error("Summary executionMode does not match run.json.");
    }

    if (summary.deliveryMode !== run.deliveryMode) {
      throw new Error("Summary deliveryMode does not match run.json.");
    }

    if (summary.gitMode !== run.gitMode) {
      throw new Error("Summary gitMode does not match run.json.");
    }

    if (summary.model !== run.model) {
      throw new Error("Summary model does not match run.json.");
    }
  }

  private assertContractMatchesRun(contract: ContractData, run: RunRecordData): void {
    if (contract.runId !== run.runId) {
      throw new Error("Contract runId does not match run.json.");
    }

    if (contract.qualityProfile !== run.qualityProfile) {
      throw new Error("Contract qualityProfile does not match run.json.");
    }

    if (contract.executionMode !== run.executionMode) {
      throw new Error("Contract executionMode does not match run.json.");
    }

    if (contract.deliveryMode !== run.deliveryMode) {
      throw new Error("Contract deliveryMode does not match run.json.");
    }

    if (contract.gitMode !== run.gitMode) {
      throw new Error("Contract gitMode does not match run.json.");
    }
  }

  private assertReportMatchesRun(report: ReportData, run: RunRecordData): void {
    if (report.runId !== run.runId) {
      throw new Error("Report runId does not match run.json.");
    }
  }

  private assertScoreMatchesRun(score: ScoreData, run: RunRecordData): void {
    if (score.runId !== run.runId) {
      throw new Error("Score runId does not match run.json.");
    }
  }

  private assertEvidenceMatchesRun(evidence: EvidenceData, run: RunRecordData): void {
    if (evidence.runId !== run.runId) {
      throw new Error("Evidence runId does not match run.json.");
    }
  }

  private buildSprintRecord(
    run: RunRecordData,
    sprint: number,
    decision: SprintRecord["decision"],
    overrides: Partial<SprintRecord>,
  ): SprintRecord {
    return {
      sprint,
      decision,
      state: "contract_drafted",
      failedCriteria: [],
      artifactPaths: {},
      ...overrides,
    };
  }

  private getExistingSprint(run: RunRecordData, sprint: number): SprintRecord | undefined {
    return run.sprints.find((entry) => entry.sprint === sprint);
  }

  private upsertSprint(run: RunRecordData, sprintRecord: SprintRecord, updatedAt: string): RunRecordData {
    const existingIndex = run.sprints.findIndex((entry) => entry.sprint === sprintRecord.sprint);
    const sprints =
      existingIndex === -1
        ? [...run.sprints, sprintRecord]
        : run.sprints.map((entry, index) => (index === existingIndex ? sprintRecord : entry));

    return runRecordSchema.parse({
      ...run,
      currentSprint: Math.max(run.currentSprint, sprintRecord.sprint),
      updatedAt,
      sprints,
    });
  }

  private resolveSprintVerdict(score: ScoreData, evidence: EvidenceData): SprintVerdict {
    if (evidence.infraFailures.length > 0 || score.criteria.some((criterion) => criterion.status === "UNVERIFIED")) {
      return "INFRA_FAIL";
    }

    return score.verdict === "PASS" ? "PASS" : "FAIL";
  }
}
