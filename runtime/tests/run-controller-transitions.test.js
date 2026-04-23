const test = require("node:test");
const assert = require("node:assert/strict");
const { RunController } = require("../dist/app/run-controller.js");
const { buildSpecSkeleton } = require("../dist/app/spec-skeleton.js");
const { buildContractSkeleton } = require("../dist/app/contract-skeleton.js");
const { buildReportSkeleton } = require("../dist/app/report-skeleton.js");
const { buildEvaluationSkeleton } = require("../dist/app/evaluation-skeleton.js");
const { createTempRepoRoot, cleanup } = require("./helpers/temp-repo.js");

async function initializeBackendRun(t) {
  const repoRoot = await createTempRepoRoot("run-controller-tx");
  t.after(() => cleanup(repoRoot));

  const controller = new RunController(repoRoot);
  const initialized = await controller.initializeRun({
    prompt: "run controller transition test",
    model: "runtime-dev",
    qualityProfile: "backend",
    playwrightAvailable: false,
  });

  return { repoRoot, controller, initialized };
}

test("writeSpec transitions initialized -> spec_ready", async (t) => {
  const { controller, initialized } = await initializeBackendRun(t);
  const spec = buildSpecSkeleton(initialized.run, "run controller transition test");
  const ctx = await controller.writeSpec({ runId: initialized.run.runId, spec });
  assert.equal(ctx.run.status, "spec_ready");
});

test("writeContract transitions spec_ready -> contract_drafted", async (t) => {
  const { controller, initialized } = await initializeBackendRun(t);
  const spec = buildSpecSkeleton(initialized.run, "run controller transition test");
  const afterSpec = await controller.writeSpec({ runId: initialized.run.runId, spec });
  const contract = buildContractSkeleton(afterSpec.run, spec, 1, "initial");
  const afterContract = await controller.writeContract({ runId: initialized.run.runId, contract });
  assert.equal(afterContract.run.status, "contract_drafted");
  assert.equal(afterContract.run.currentSprint, 1);
});

test("signContract transitions contract_drafted -> contract_signed", async (t) => {
  const { controller, initialized } = await initializeBackendRun(t);
  const spec = buildSpecSkeleton(initialized.run, "sign contract test");
  const afterSpec = await controller.writeSpec({ runId: initialized.run.runId, spec });
  const contract = buildContractSkeleton(afterSpec.run, spec, 1, "initial");
  await controller.writeContract({ runId: initialized.run.runId, contract });
  const signed = await controller.signContract({ runId: initialized.run.runId, sprint: 1 });
  assert.equal(signed.run.status, "contract_signed");
});

test("writeReport transitions contract_signed -> implemented", async (t) => {
  const { controller, initialized } = await initializeBackendRun(t);
  const spec = buildSpecSkeleton(initialized.run, "write report test");
  const afterSpec = await controller.writeSpec({ runId: initialized.run.runId, spec });
  const contract = buildContractSkeleton(afterSpec.run, spec, 1, "initial");
  await controller.writeContract({ runId: initialized.run.runId, contract });
  await controller.signContract({ runId: initialized.run.runId, sprint: 1 });
  const signedContract = await controller.loadContract(initialized.run.runId, 1);
  const report = buildReportSkeleton(signedContract);
  const afterReport = await controller.writeReport({ runId: initialized.run.runId, report });
  assert.equal(afterReport.run.status, "implemented");
});

test("writeEvaluation with all PASS criteria transitions implemented -> passed", async (t) => {
  const { controller, initialized } = await initializeBackendRun(t);
  const spec = buildSpecSkeleton(initialized.run, "evaluate pass test");
  const afterSpec = await controller.writeSpec({ runId: initialized.run.runId, spec });
  const contract = buildContractSkeleton(afterSpec.run, spec, 1, "initial");
  await controller.writeContract({ runId: initialized.run.runId, contract });
  await controller.signContract({ runId: initialized.run.runId, sprint: 1 });
  const signedContract = await controller.loadContract(initialized.run.runId, 1);
  const report = buildReportSkeleton(signedContract);
  await controller.writeReport({ runId: initialized.run.runId, report });
  const evaluation = buildEvaluationSkeleton(signedContract, "PASS");
  const afterEval = await controller.writeEvaluation({
    runId: initialized.run.runId,
    score: evaluation.score,
    evidence: evaluation.evidence,
  });
  assert.equal(afterEval.run.status, "passed");
});

test("writeEvaluation with FAIL verdict transitions implemented -> failed", async (t) => {
  const { controller, initialized } = await initializeBackendRun(t);
  const spec = buildSpecSkeleton(initialized.run, "evaluate fail test");
  const afterSpec = await controller.writeSpec({ runId: initialized.run.runId, spec });
  const contract = buildContractSkeleton(afterSpec.run, spec, 1, "initial");
  await controller.writeContract({ runId: initialized.run.runId, contract });
  await controller.signContract({ runId: initialized.run.runId, sprint: 1 });
  const signedContract = await controller.loadContract(initialized.run.runId, 1);
  const report = buildReportSkeleton(signedContract);
  await controller.writeReport({ runId: initialized.run.runId, report });
  const evaluation = buildEvaluationSkeleton(signedContract, "FAIL");
  const afterEval = await controller.writeEvaluation({
    runId: initialized.run.runId,
    score: evaluation.score,
    evidence: evaluation.evidence,
  });
  assert.equal(afterEval.run.status, "failed");
});

test("transitionRun to aborted works from any active state", async (t) => {
  const { controller, initialized } = await initializeBackendRun(t);
  const aborted = await controller.transitionRun({
    runId: initialized.run.runId,
    to: "aborted",
  });
  assert.equal(aborted.run.status, "aborted");
});
