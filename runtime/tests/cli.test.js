const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { createTempRepoRoot, readJson, cleanup } = require("./helpers/temp-repo.js");

const runtimeDir = path.resolve(__dirname, "..");
const cliPath = path.join(runtimeDir, "dist", "cli.js");

function runCli(args, options = {}) {
  return spawnSync(
    process.execPath,
    [cliPath, ...args],
    {
      cwd: runtimeDir,
      encoding: "utf8",
      ...options,
    },
  );
}

test("CLI init-run creates a valid run.json for backend profile", async (t) => {
  const repoRoot = await createTempRepoRoot("cli-init-run");
  t.after(() => cleanup(repoRoot));

  const result = runCli([
    "init-run",
    "--prompt", "init smoke",
    "--model", "runtime-dev",
    "--profile", "backend",
    "--repo-root", repoRoot,
  ]);

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.status, "initialized");
  assert.match(output.runId, /^init-smoke-/);

  const run = await readJson(output.runJsonPath);
  assert.equal(run.status, "initialized");
  assert.equal(run.qualityProfile, "backend");
});

test("CLI check-provider-health with development provider returns PASS", () => {
  const result = runCli([
    "check-provider-health",
    "--provider", "development",
    "--model", "runtime-dev",
  ]);

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.status, "PASS");
  assert.equal(output.provider, "development");
});

test("CLI chained skeleton flow drives a backend run to evaluation terminal state", async (t) => {
  const repoRoot = await createTempRepoRoot("cli-skeleton-flow");
  t.after(() => cleanup(repoRoot));

  // init-run
  const init = runCli([
    "init-run",
    "--prompt", "skeleton flow test",
    "--model", "runtime-dev",
    "--profile", "backend",
    "--repo-root", repoRoot,
  ]);
  assert.equal(init.status, 0, init.stderr);
  const initOutput = JSON.parse(init.stdout);
  const { runId } = initOutput;
  assert.ok(runId, "runId must be present in init-run output");

  // write-spec-skeleton
  const spec = runCli([
    "write-spec-skeleton",
    "--run-id", runId,
    "--request", "skeleton flow test",
    "--repo-root", repoRoot,
  ]);
  assert.equal(spec.status, 0, spec.stderr);
  const specOutput = JSON.parse(spec.stdout);
  assert.equal(specOutput.runId, runId);
  assert.equal(specOutput.status, "spec_ready");

  // write-contract-skeleton
  const contract = runCli([
    "write-contract-skeleton",
    "--run-id", runId,
    "--decision", "initial",
    "--sprint", "1",
    "--repo-root", repoRoot,
  ]);
  assert.equal(contract.status, 0, contract.stderr);
  const contractOutput = JSON.parse(contract.stdout);
  assert.equal(contractOutput.runId, runId);
  assert.equal(contractOutput.sprint, 1);

  // sign-contract
  const signed = runCli([
    "sign-contract",
    "--run-id", runId,
    "--sprint", "1",
    "--repo-root", repoRoot,
  ]);
  assert.equal(signed.status, 0, signed.stderr);
  const signedOutput = JSON.parse(signed.stdout);
  assert.equal(signedOutput.runId, runId);
  assert.equal(signedOutput.status, "contract_signed");

  // write-report-skeleton
  const report = runCli([
    "write-report-skeleton",
    "--run-id", runId,
    "--sprint", "1",
    "--repo-root", repoRoot,
  ]);
  assert.equal(report.status, 0, report.stderr);
  const reportOutput = JSON.parse(report.stdout);
  assert.equal(reportOutput.runId, runId);
  assert.equal(reportOutput.status, "implemented");

  // write-evaluation-skeleton
  const evalCmd = runCli([
    "write-evaluation-skeleton",
    "--run-id", runId,
    "--sprint", "1",
    "--result", "PASS",
    "--repo-root", repoRoot,
  ]);
  assert.equal(evalCmd.status, 0, evalCmd.stderr);
  const finalOutput = JSON.parse(evalCmd.stdout);
  assert.equal(finalOutput.runId, runId);
  assert.equal(finalOutput.verdict, "PASS");
  assert.match(finalOutput.status, /^(evaluated|passed)$/);
});
