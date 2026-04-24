"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { writeFile, mkdir, rm } = require("node:fs/promises");

const { RunController } = require("../dist/app/run-controller.js");
const { resumeRun } = require("../dist/app/resume-run.js");
const { finalizeRun } = require("../dist/app/finalize-run.js");
const { createLlmAdapter } = require("../dist/roles/adapter-factory.js");
const { PlannerRole } = require("../dist/roles/planner-role.js");
const { GeneratorRole } = require("../dist/roles/generator-role.js");
const { EvaluatorRole } = require("../dist/roles/evaluator-role.js");
const { buildEvaluationSkeleton } = require("../dist/app/evaluation-skeleton.js");
const { getSprintPaths } = require("../dist/storage/paths.js");
const { readJson } = require("./helpers/temp-repo.js");

// Resolve real repo root so PromptLoader finds skills/gen-eval-loop/*.md and
// so RunController writes to an isolated .gen-eval/<runId>/ sub-directory.
const REPO_ROOT = path.resolve(__dirname, "..", "..");

async function cleanupRunDir(runId) {
  await rm(path.join(REPO_ROOT, ".gen-eval", runId), { recursive: true, force: true });
  await rm(path.join(REPO_ROOT, "docs", "gen-eval", runId), { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Stub for controller.runPlaywrightEvidence
//
// resumeRun calls this when the run reaches "implemented" status. The real
// implementation launches Playwright which requires a browser and a running
// server. We replace it with a deterministic stub that:
//   1. Loads the current run context and the active contract.
//   2. Builds PASS evidence via buildEvaluationSkeleton.
//   3. Writes the evidence JSON to the expected sprint path on disk
//      (because the very next line in resumeRun is controller.loadEvidence).
//   4. Returns a RunPlaywrightEvidenceResult-shaped object so the caller can
//      continue without any real network or browser activity.
// ---------------------------------------------------------------------------
async function stubRunPlaywrightEvidence(controller, input) {
  const context = await controller.loadRun(input.runId);
  const contract = await controller.loadContract(input.runId, input.sprint);
  const { evidence } = buildEvaluationSkeleton(contract, "PASS");

  const sprintPaths = getSprintPaths(context.runPaths, input.sprint);
  await mkdir(sprintPaths.sprintDir, { recursive: true });
  await writeFile(sprintPaths.evidenceJsonPath, JSON.stringify(evidence), "utf8");

  return {
    run: context.run,
    runtimePaths: context.runtimePaths,
    runPaths: context.runPaths,
    evidence,
    evidenceJsonPath: sprintPaths.evidenceJsonPath,
    screenshotsDir: sprintPaths.screenshotsDir,
    criterionFailures: {},
    startupLogs: [],
  };
}

// ---------------------------------------------------------------------------
// Test 1: resumeRun drives a ui run to completion using the development adapter
// ---------------------------------------------------------------------------
test("resumeRun drives a ui run to completion using the development adapter", async (t) => {
  const controller = new RunController(REPO_ROOT);

  const initialized = await controller.initializeRun({
    prompt: "resume-test-ui-smoke",
    model: "runtime-dev",
    qualityProfile: "ui",
    executionMode: "full-loop",
    // Must be true so the deterministic contract-capability check allows
    // browser-only evidence types (screenshot, selector_assertion, etc.)
    // that the ui-profile skeleton generates. Playwright itself is patched
    // out via controller.runPlaywrightEvidence below.
    playwrightAvailable: true,
  });

  t.after(() => cleanupRunDir(initialized.run.runId));

  // Patch out real Playwright; inject deterministic evidence.
  controller.runPlaywrightEvidence = (input) =>
    stubRunPlaywrightEvidence(controller, input);

  const adapter = createLlmAdapter({ provider: "development" });
  const plannerRole = new PlannerRole(REPO_ROOT, adapter);
  const generatorRole = new GeneratorRole(REPO_ROOT, adapter);
  const evaluatorRole = new EvaluatorRole(REPO_ROOT, adapter);

  const result = await resumeRun({
    controller,
    plannerRole,
    generatorRole,
    evaluatorRole,
    runId: initialized.run.runId,
    playwright: { headless: true },
  });

  assert.equal(result.completed, true, "run must reach a completed state");
  assert.match(
    result.run.status,
    /^(passed|failed|completed|capped|aborted)$/,
    `unexpected terminal status: ${result.run.status}`,
  );
});

// ---------------------------------------------------------------------------
// Test 2: resumeRun drives a content run to completion without Playwright
// ---------------------------------------------------------------------------
test("resumeRun drives a content run to completion using synthetic evidence", async (t) => {
  const controller = new RunController(REPO_ROOT);

  const initialized = await controller.initializeRun({
    prompt: "resume-test-content-smoke",
    model: "runtime-dev",
    qualityProfile: "content",
    executionMode: "full-loop",
    playwrightAvailable: false,
  });

  t.after(() => cleanupRunDir(initialized.run.runId));

  const adapter = createLlmAdapter({ provider: "development" });
  const plannerRole = new PlannerRole(REPO_ROOT, adapter);
  const generatorRole = new GeneratorRole(REPO_ROOT, adapter);
  const evaluatorRole = new EvaluatorRole(REPO_ROOT, adapter);

  const result = await resumeRun({
    controller,
    plannerRole,
    generatorRole,
    evaluatorRole,
    runId: initialized.run.runId,
  });

  assert.equal(result.completed, true, "run must reach a completed state");
  assert.match(
    result.run.status,
    /^(passed|failed|completed|capped|aborted)$/,
    `unexpected terminal status: ${result.run.status}`,
  );
});

// ---------------------------------------------------------------------------
// Test 3: finalizeRun writes summary.json with the given verdict
// ---------------------------------------------------------------------------
test("finalizeRun writes summary.json and summary.md with the given verdict", async (t) => {
  const controller = new RunController(REPO_ROOT);

  const initialized = await controller.initializeRun({
    prompt: "finalize-test-smoke",
    model: "runtime-dev",
    qualityProfile: "backend",
    playwrightAvailable: false,
  });

  t.after(() => cleanupRunDir(initialized.run.runId));

  await controller.transitionRun({
    runId: initialized.run.runId,
    to: "aborted",
  });

  await finalizeRun({
    controller,
    runId: initialized.run.runId,
    finalVerdict: "ABORTED",
  });

  const summary = await readJson(initialized.runPaths.summaryJsonPath);
  assert.equal(summary.finalVerdict, "ABORTED");
});
