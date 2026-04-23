const test = require("node:test");
const assert = require("node:assert/strict");

const {
  canTransition,
  assertTransition,
  applyTransition,
  getNextEvaluationStatus,
  assertEvaluationContext,
  getRequiredContextFor,
  isRunStatus,
  isActiveRunStatus,
  InvalidRunTransitionError,
  VALID_TRANSITIONS,
} = require("../dist/domain/state-machine.js");

test("canTransition allows every transition listed in VALID_TRANSITIONS", () => {
  for (const [from, targets] of Object.entries(VALID_TRANSITIONS)) {
    for (const to of targets) {
      assert.equal(canTransition(from, to), true, `${from} -> ${to}`);
    }
  }
});

test("canTransition rejects completed -> anything", () => {
  assert.equal(canTransition("completed", "initialized"), false);
  assert.equal(canTransition("completed", "aborted"), false);
});

test("assertTransition throws on invalid transition", () => {
  assert.throws(
    () => assertTransition({ from: "initialized", to: "evaluated" }),
    InvalidRunTransitionError,
  );
});

test("assertTransition requires context fields for gated targets", () => {
  assert.throws(
    () => assertTransition({ from: "initialized", to: "spec_ready", context: {} }),
    /hasSpec/,
  );
  assert.doesNotThrow(() =>
    assertTransition({ from: "initialized", to: "spec_ready", context: { hasSpec: true } }),
  );
});

test("assertTransition blocks passed when criteria are unverified", () => {
  assert.throws(
    () =>
      assertTransition({
        from: "evaluated",
        to: "passed",
        context: { everyCriterionPassed: true, hasUnverifiedCriteria: true },
      }),
    /unverified/i,
  );
});

test("assertTransition blocks failed when every criterion passed", () => {
  assert.throws(
    () =>
      assertTransition({
        from: "evaluated",
        to: "failed",
        context: { everyCriterionPassed: true, hasUnverifiedCriteria: false },
      }),
    /cannot move to failed/i,
  );
});

test("assertTransition blocks capped without capReached", () => {
  assert.throws(
    () => assertTransition({ from: "initialized", to: "capped", context: {} }),
    /sprint cap/i,
  );
  assert.doesNotThrow(() =>
    assertTransition({ from: "initialized", to: "capped", context: { capReached: true } }),
  );
});

test("applyTransition returns a new run with updated status and timestamp", () => {
  const run = {
    status: "initialized",
    lastCompletedState: "initialized",
    updatedAt: "2026-04-22T10:00:00.000Z",
    runId: "sample",
  };

  const result = applyTransition(run, "spec_ready", { hasSpec: true }, "2026-04-22T11:00:00.000Z");

  assert.equal(result.status, "spec_ready");
  assert.equal(result.lastCompletedState, "spec_ready");
  assert.equal(result.updatedAt, "2026-04-22T11:00:00.000Z");
  assert.equal(run.status, "initialized", "input run must not be mutated");
});

test("getNextEvaluationStatus returns failed when any criterion is unverified", () => {
  assert.equal(
    getNextEvaluationStatus({ everyCriterionPassed: true, hasUnverifiedCriteria: true }),
    "failed",
  );
});

test("getNextEvaluationStatus returns passed only when all criteria pass", () => {
  assert.equal(
    getNextEvaluationStatus({ everyCriterionPassed: true, hasUnverifiedCriteria: false }),
    "passed",
  );
  assert.equal(
    getNextEvaluationStatus({ everyCriterionPassed: false, hasUnverifiedCriteria: false }),
    "failed",
  );
});

test("assertEvaluationContext requires both hasScore and hasEvidence", () => {
  assert.throws(
    () => assertEvaluationContext({ hasScore: true, hasEvidence: false }),
    InvalidRunTransitionError,
  );
  assert.throws(
    () => assertEvaluationContext({ hasScore: false, hasEvidence: true }),
    InvalidRunTransitionError,
  );
  assert.doesNotThrow(() =>
    assertEvaluationContext({ hasScore: true, hasEvidence: true }),
  );
});

test("isRunStatus only accepts known statuses", () => {
  assert.equal(isRunStatus("initialized"), true);
  assert.equal(isRunStatus("passed"), true);
  assert.equal(isRunStatus("not-a-status"), false);
});

test("isActiveRunStatus recognizes active statuses and excludes terminal ones", () => {
  assert.equal(isActiveRunStatus("contract_drafted"), true);
  assert.equal(isActiveRunStatus("completed"), false);
  assert.equal(isActiveRunStatus("passed"), false);
});

test("getRequiredContextFor returns the expected context keys per target", () => {
  assert.deepEqual(getRequiredContextFor("spec_ready"), ["hasSpec"]);
  assert.deepEqual(getRequiredContextFor("evaluated"), ["hasScore", "hasEvidence"]);
  assert.deepEqual(getRequiredContextFor("completed"), []);
});
