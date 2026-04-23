const test = require("node:test");
const assert = require("node:assert/strict");
const { RunController } = require("../dist/app/run-controller.js");
const { buildSpecSkeleton } = require("../dist/app/spec-skeleton.js");
const { buildContractSkeleton } = require("../dist/app/contract-skeleton.js");
const { createTempRepoRoot, cleanup } = require("./helpers/temp-repo.js");

async function init(t, overrides = {}) {
  const repoRoot = await createTempRepoRoot("run-controller-asserts");
  t.after(() => cleanup(repoRoot));
  const controller = new RunController(repoRoot);
  const initialized = await controller.initializeRun({
    prompt: "assertion test",
    model: "runtime-dev",
    qualityProfile: "backend",
    playwrightAvailable: false,
    ...overrides,
  });
  return { controller, initialized };
}

test("writeSpec rejects runId mismatch", async (t) => {
  const { controller, initialized } = await init(t);
  const spec = { ...buildSpecSkeleton(initialized.run, "mismatched"), runId: "definitely-not-the-real-run" };
  await assert.rejects(
    () => controller.writeSpec({ runId: initialized.run.runId, spec }),
    /does not match/i,
  );
});

test("writeSpec rejects qualityProfile mismatch", async (t) => {
  const { controller, initialized } = await init(t);
  const spec = { ...buildSpecSkeleton(initialized.run, "mismatched profile"), qualityProfile: "ui" };
  await assert.rejects(
    () => controller.writeSpec({ runId: initialized.run.runId, spec }),
    /does not match/i,
  );
});

test("writeContract rejects runId mismatch", async (t) => {
  const { controller, initialized } = await init(t);
  const spec = buildSpecSkeleton(initialized.run, "before contract");
  await controller.writeSpec({ runId: initialized.run.runId, spec });
  const contract = { ...buildContractSkeleton(initialized.run, spec, 1, "initial"), runId: "different-run-id" };
  await assert.rejects(
    () => controller.writeContract({ runId: initialized.run.runId, contract }),
    /does not match/i,
  );
});
