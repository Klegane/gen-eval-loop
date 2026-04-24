"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { RunController } = require("../dist/app/run-controller.js");
const { createLlmAdapter } = require("../dist/roles/adapter-factory.js");
const { PlannerRole } = require("../dist/roles/planner-role.js");
const { GeneratorRole } = require("../dist/roles/generator-role.js");
const { EvaluatorRole } = require("../dist/roles/evaluator-role.js");
const { specSchema } = require("../dist/schemas/spec.js");
const { contractSchema } = require("../dist/schemas/contract.js");
const { reportSchema } = require("../dist/schemas/report.js");
const { scoreSchema } = require("../dist/schemas/score.js");
const { contractReviewSchema } = require("../dist/schemas/contract-review.js");
const { buildEvaluationSkeleton } = require("../dist/app/evaluation-skeleton.js");
const { createTempRepoRoot, cleanup } = require("./helpers/temp-repo.js");

// ---------------------------------------------------------------------------
// Shared setup helper
//
// The RunController only needs a writable repoRoot for its state store.
// The Roles' PromptLoader resolves prompts relative to repoRoot — so we
// pass the real repo root (which has skills/gen-eval-loop/) to the roles,
// while using a temp dir for the RunController's file store.
// ---------------------------------------------------------------------------

// Path to the real repo so PromptLoader can find skills/gen-eval-loop/
const REAL_REPO_ROOT = require("node:path").resolve(__dirname, "../..");

async function setup(t, prefix) {
  // Temp dir used only for RunController state (run.json, etc.)
  const stateRoot = await createTempRepoRoot(prefix ?? "roles");
  t.after(() => cleanup(stateRoot));

  const controller = new RunController(stateRoot);
  const initialized = await controller.initializeRun({
    prompt: "roles test: build a REST API",
    model: "runtime-dev",
    qualityProfile: "backend",
    playwrightAvailable: false,
  });

  const adapter = createLlmAdapter({ provider: "development" });

  return {
    stateRoot,
    controller,
    initialized,
    adapter,
    // Roles use the real repo root so PromptLoader finds the prompt files
    plannerRole: new PlannerRole(REAL_REPO_ROOT, adapter),
    generatorRole: new GeneratorRole(REAL_REPO_ROOT, adapter),
    evaluatorRole: new EvaluatorRole(REAL_REPO_ROOT, adapter),
  };
}

// ---------------------------------------------------------------------------
// PlannerRole
// ---------------------------------------------------------------------------

test("PlannerRole.run returns a valid SpecData that parses with specSchema", async (t) => {
  const { plannerRole, initialized } = await setup(t, "planner-run");

  const spec = await plannerRole.run({
    run: initialized.run,
    request: "build a REST API",
  });

  assert.doesNotThrow(() => specSchema.parse(spec));
  assert.equal(spec.artifact, "spec");
  assert.equal(spec.runId, initialized.run.runId);
  assert.equal(spec.qualityProfile, "backend");
  assert.ok(Array.isArray(spec.coreFunctionality) && spec.coreFunctionality.length > 0);
  assert.ok(Array.isArray(spec.successCriteria) && spec.successCriteria.length > 0);
  assert.equal(spec.status, "ready");
});

// ---------------------------------------------------------------------------
// GeneratorRole
// ---------------------------------------------------------------------------

test("GeneratorRole.draftContract returns a valid ContractData that parses with contractSchema", async (t) => {
  const { plannerRole, generatorRole, initialized } = await setup(t, "gen-contract");

  // First obtain a spec from the planner to feed into the generator
  const spec = await plannerRole.run({
    run: initialized.run,
    request: "build a REST API",
  });

  const contract = await generatorRole.draftContract({
    run: initialized.run,
    spec,
    sprint: 1,
    decision: "initial",
  });

  assert.doesNotThrow(() => contractSchema.parse(contract));
  assert.equal(contract.artifact, "contract");
  assert.equal(contract.runId, initialized.run.runId);
  assert.equal(contract.sprint, 1);
  assert.ok(Array.isArray(contract.scope) && contract.scope.length > 0);
  assert.ok(Array.isArray(contract.criteria) && contract.criteria.length > 0);
});

test("GeneratorRole.implement returns a valid ReportData that parses with reportSchema", async (t) => {
  const { plannerRole, generatorRole, initialized } = await setup(t, "gen-implement");

  const spec = await plannerRole.run({
    run: initialized.run,
    request: "build a REST API",
  });

  const contract = await generatorRole.draftContract({
    run: initialized.run,
    spec,
    sprint: 1,
    decision: "initial",
  });

  const report = await generatorRole.implement({
    run: initialized.run,
    spec,
    contract,
  });

  assert.doesNotThrow(() => reportSchema.parse(report));
  assert.equal(report.artifact, "report");
  assert.equal(report.runId, initialized.run.runId);
  assert.ok(Array.isArray(report.whatIBuilt) && report.whatIBuilt.length > 0);
  assert.ok(Array.isArray(report.selfCheck) && report.selfCheck.length > 0);
});

// ---------------------------------------------------------------------------
// EvaluatorRole
// ---------------------------------------------------------------------------

test("EvaluatorRole.reviewContract returns an object with approved and status fields that parses with contractReviewSchema", async (t) => {
  const { plannerRole, generatorRole, evaluatorRole, initialized } = await setup(t, "eval-review");

  const spec = await plannerRole.run({
    run: initialized.run,
    request: "build a REST API",
  });

  const contract = await generatorRole.draftContract({
    run: initialized.run,
    spec,
    sprint: 1,
    decision: "initial",
  });

  const review = await evaluatorRole.reviewContract({
    run: initialized.run,
    spec,
    contract,
  });

  assert.doesNotThrow(() => contractReviewSchema.parse(review));
  assert.equal(typeof review.approved, "boolean");
  assert.ok(["SIGNED", "CHANGES_REQUESTED"].includes(review.status));
  // A freshly drafted contract from the dev adapter should be SIGNED
  assert.equal(review.approved, true);
  assert.equal(review.status, "SIGNED");
});

test("EvaluatorRole.score returns a valid ScoreData that parses with scoreSchema", async (t) => {
  const { plannerRole, generatorRole, evaluatorRole, initialized } = await setup(t, "eval-score");

  const spec = await plannerRole.run({
    run: initialized.run,
    request: "build a REST API",
  });

  const contract = await generatorRole.draftContract({
    run: initialized.run,
    spec,
    sprint: 1,
    decision: "initial",
  });

  // Use the evaluation skeleton to build schema-valid evidence without running live commands
  const { evidence } = buildEvaluationSkeleton(contract, "PASS");

  const score = await evaluatorRole.score({
    run: initialized.run,
    spec,
    contract,
    evidence,
  });

  assert.doesNotThrow(() => scoreSchema.parse(score));
  assert.equal(score.artifact, "score");
  assert.equal(score.runId, initialized.run.runId);
  assert.equal(score.sprint, 1);
  assert.ok(Array.isArray(score.criteria) && score.criteria.length > 0);
  assert.ok(["PASS", "FAIL"].includes(score.verdict));
});

// ---------------------------------------------------------------------------
// Additional: draftContract on a spec that is not ready throws
// ---------------------------------------------------------------------------

test("GeneratorRole.draftContract throws when spec.status is not ready", async (t) => {
  const { plannerRole, generatorRole, initialized } = await setup(t, "gen-not-ready");

  const spec = await plannerRole.run({
    run: initialized.run,
    request: "build a REST API",
  });

  // Override the status to simulate a non-ready spec
  const nonReadySpec = { ...spec, status: "draft" };

  await assert.rejects(
    () =>
      generatorRole.draftContract({
        run: initialized.run,
        spec: nonReadySpec,
        sprint: 1,
        decision: "initial",
      }),
    /ready/,
    "draftContract must reject a spec that is not ready",
  );
});

// ---------------------------------------------------------------------------
// Additional: EvaluatorRole.score verdict is FAIL when evidence contains failures
// ---------------------------------------------------------------------------

test("EvaluatorRole.score returns FAIL verdict when evaluation skeleton records a FAIL outcome", async (t) => {
  const { plannerRole, generatorRole, evaluatorRole, initialized } = await setup(t, "eval-score-fail");

  const spec = await plannerRole.run({
    run: initialized.run,
    request: "build a REST API",
  });

  const contract = await generatorRole.draftContract({
    run: initialized.run,
    spec,
    sprint: 1,
    decision: "initial",
  });

  const { evidence } = buildEvaluationSkeleton(contract, "FAIL");

  const score = await evaluatorRole.score({
    run: initialized.run,
    spec,
    contract,
    evidence,
  });

  assert.doesNotThrow(() => scoreSchema.parse(score));
  assert.equal(score.verdict, "FAIL");
  assert.ok(score.blockingFindings.length > 0, "FAIL score must have blockingFindings");
});
