const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const { mkdtemp, readFile, rm } = require("node:fs/promises");
const { spawnSync } = require("node:child_process");

const runtimeDir = path.resolve(__dirname, "..");
const cliPath = path.join(runtimeDir, "dist", "cli.js");

const { checkProviderHealth } = require("../dist/app/check-provider-health.js");
const { finalizeRun } = require("../dist/app/finalize-run.js");
const { runPreflight } = require("../dist/app/run-preflight.js");
const { RunController } = require("../dist/app/run-controller.js");

async function createTempRepoRoot(prefix) {
  return mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

test("runPreflight passes for development backend runs without browser requirements", async (t) => {
  const repoRoot = await createTempRepoRoot("gen-eval-preflight-pass");
  t.after(async () => {
    await rm(repoRoot, { recursive: true, force: true });
  });

  const report = await runPreflight({
    runtimeRoot: repoRoot,
    provider: "development",
    profile: "backend",
    model: "runtime-dev",
    playwrightAvailable: false,
    env: {
      ...process.env,
      GEN_EVAL_LLM_PROVIDER: "development",
    },
  });

  assert.equal(report.status, "PASS");
  assert.equal(report.provider, "development");
  assert.equal(report.profile, "backend");
  assert.equal(report.blockingReasons.length, 0);
  assert.equal(report.providerHealth, undefined);
});

test("checkProviderHealth returns a structured CONFIG failure when OpenAI credentials are missing", async () => {
  const report = await checkProviderHealth({
    provider: "openai",
    model: "gpt-test",
    env: {
      ...process.env,
      OPENAI_API_KEY: "",
    },
  });

  assert.equal(report.status, "FAIL");
  assert.equal(report.adapterName, "openai-responses");
  assert.equal(report.error.category, "CONFIG");
  assert.match(report.error.message, /OPENAI_API_KEY/i);
});

test("recordPreflight persists the report into run.json", async (t) => {
  const repoRoot = await createTempRepoRoot("gen-eval-record-preflight");
  t.after(async () => {
    await rm(repoRoot, { recursive: true, force: true });
  });

  const controller = new RunController(repoRoot);
  const initialized = await controller.initializeRun({
    prompt: "persist preflight",
    model: "runtime-dev",
    qualityProfile: "backend",
    playwrightAvailable: false,
  });

  const preflight = await runPreflight({
    runtimeRoot: repoRoot,
    provider: "development",
    profile: "backend",
    model: "runtime-dev",
    playwrightAvailable: false,
    env: {
      ...process.env,
      GEN_EVAL_LLM_PROVIDER: "development",
    },
  });

  await controller.recordPreflight({
    runId: initialized.run.runId,
    preflight,
  });

  const persisted = await readJson(initialized.runPaths.runJsonPath);
  assert.equal(persisted.preflightHistory.length, 1);
  assert.equal(persisted.preflightHistory[0].status, "PASS");
  assert.equal(persisted.preflightHistory[0].provider, "development");
});

test("run-full-loop persists preflight history before returning PRECHECK_FAILED", async (t) => {
  const repoRoot = await createTempRepoRoot("gen-eval-cli-precheck-fail");
  t.after(async () => {
    await rm(repoRoot, { recursive: true, force: true });
  });

  const result = spawnSync(
    process.execPath,
    [
      cliPath,
      "run-full-loop",
      "--prompt",
      "cli precheck fail",
      "--model",
      "gpt-test",
      "--provider",
      "openai",
      "--profile",
      "backend",
      "--repo-root",
      repoRoot,
    ],
    {
      cwd: runtimeDir,
      encoding: "utf8",
      env: {
        ...process.env,
        GEN_EVAL_LLM_PROVIDER: "openai",
        OPENAI_API_KEY: "",
      },
    },
  );

  assert.equal(result.status, 1, result.stderr);

  const output = JSON.parse(result.stdout);
  assert.equal(output.status, "PRECHECK_FAILED");
  assert.match(output.runId, /^cli-precheck-fail-/);

  const runJson = await readJson(output.runJsonPath);
  assert.equal(runJson.status, "initialized");
  assert.equal(runJson.preflightHistory.length, 1);
  assert.equal(runJson.preflightHistory[0].status, "FAIL");
  assert.equal(runJson.preflightHistory[0].provider, "openai");
});

test("finalizeRun includes the latest preflight snapshot in summary.json", async (t) => {
  const repoRoot = await createTempRepoRoot("gen-eval-summary-preflight");
  t.after(async () => {
    await rm(repoRoot, { recursive: true, force: true });
  });

  const controller = new RunController(repoRoot);
  const initialized = await controller.initializeRun({
    prompt: "summary preflight",
    model: "runtime-dev",
    qualityProfile: "backend",
    playwrightAvailable: false,
  });

  const preflight = await runPreflight({
    runtimeRoot: repoRoot,
    provider: "development",
    profile: "backend",
    model: "runtime-dev",
    playwrightAvailable: false,
    env: {
      ...process.env,
      GEN_EVAL_LLM_PROVIDER: "development",
    },
  });

  await controller.recordPreflight({
    runId: initialized.run.runId,
    preflight,
  });
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
  assert.equal(summary.latestPreflight.status, "PASS");
  assert.equal(summary.latestPreflight.provider, "development");
});
