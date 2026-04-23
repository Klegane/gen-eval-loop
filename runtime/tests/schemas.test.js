"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { runRecordSchema } = require("../dist/schemas/run.js");
const { specSchema } = require("../dist/schemas/spec.js");
const { contractSchema } = require("../dist/schemas/contract.js");
const { reportSchema } = require("../dist/schemas/report.js");
const { scoreSchema } = require("../dist/schemas/score.js");
const { evidenceSchema } = require("../dist/schemas/evidence.js");
const { summarySchema } = require("../dist/schemas/summary.js");

const { buildSpecSkeleton } = require("../dist/app/spec-skeleton.js");
const { buildContractSkeleton } = require("../dist/app/contract-skeleton.js");
const { buildEvaluationSkeleton } = require("../dist/app/evaluation-skeleton.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseRun(overrides = {}) {
  return {
    runId: "sample-run-20260424-1000",
    requestPrompt: "build X",
    status: "initialized",
    qualityProfile: "backend",
    executionMode: "full-loop",
    deliveryMode: "single-pass",
    gitMode: "workspace-mode",
    model: "runtime-dev",
    playwrightAvailable: false,
    currentSprint: 0,
    sprintCap: 5,
    lastCompletedState: "initialized",
    createdAt: "2026-04-24T10:00:00.000Z",
    updatedAt: "2026-04-24T10:00:00.000Z",
    preflightHistory: [],
    sprints: [],
    ...overrides,
  };
}

/** A minimal valid sprint record for sprint #1. */
function baseSprint(overrides = {}) {
  return {
    sprint: 1,
    decision: "initial",
    state: "evaluated",
    verdict: "PASS",
    failedCriteria: [],
    artifactPaths: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// runRecordSchema — happy path
// ---------------------------------------------------------------------------

test("runRecordSchema: accepts a valid initialized run with no sprints", () => {
  assert.doesNotThrow(() => runRecordSchema.parse(baseRun()));
});

// ---------------------------------------------------------------------------
// runRecordSchema — superRefine rejections
// ---------------------------------------------------------------------------

test("runRecordSchema: rejects duplicate sprint numbers", () => {
  const run = baseRun({
    status: "evaluated",
    lastCompletedState: "evaluated",
    currentSprint: 1,
    sprints: [
      baseSprint({ sprint: 1, verdict: "PASS" }),
      baseSprint({ sprint: 1, verdict: "FAIL" }),
    ],
  });
  assert.throws(() => runRecordSchema.parse(run), /unique/i);
});

test("runRecordSchema: rejects non-contiguous sprint numbers", () => {
  const run = baseRun({
    status: "evaluated",
    lastCompletedState: "evaluated",
    currentSprint: 3,
    sprints: [
      baseSprint({ sprint: 1, verdict: "PASS" }),
      baseSprint({ sprint: 3, verdict: "PASS" }),
    ],
  });
  assert.throws(() => runRecordSchema.parse(run), /contiguous/i);
});

test("runRecordSchema: rejects currentSprint > sprintCap", () => {
  const run = baseRun({
    status: "initialized",
    lastCompletedState: "initialized",
    currentSprint: 6,
    sprintCap: 5,
    sprints: [],
  });
  // currentSprint is 6 but sprints is empty — the zero-sprint check fires first,
  // but currentSprint > sprintCap also fires. Both are schema errors, so parse throws.
  assert.throws(() => runRecordSchema.parse(run));
});

test("runRecordSchema: rejects lastCompletedState different from status", () => {
  const run = baseRun({
    status: "spec_ready",
    lastCompletedState: "initialized",
  });
  assert.throws(() => runRecordSchema.parse(run), /lastCompletedState/i);
});

test("runRecordSchema: rejects an evaluated sprint without a verdict", () => {
  const run = baseRun({
    status: "evaluated",
    lastCompletedState: "evaluated",
    currentSprint: 1,
    sprints: [
      baseSprint({ sprint: 1, state: "evaluated", verdict: undefined }),
    ],
  });
  assert.throws(() => runRecordSchema.parse(run), /verdict/i);
});

test("runRecordSchema: rejects a PASS sprint with failedCriteria entries", () => {
  const run = baseRun({
    status: "evaluated",
    lastCompletedState: "evaluated",
    currentSprint: 1,
    sprints: [
      baseSprint({ sprint: 1, verdict: "PASS", failedCriteria: ["criterion-1"] }),
    ],
  });
  assert.throws(() => runRecordSchema.parse(run), /failed criteria/i);
});

// ---------------------------------------------------------------------------
// specSchema
// ---------------------------------------------------------------------------

test("specSchema: accepts a valid minimal spec (via skeleton builder)", () => {
  const run = runRecordSchema.parse(baseRun());
  const spec = buildSpecSkeleton(run, "build a CLI tool");
  assert.doesNotThrow(() => specSchema.parse(spec));
});

test("specSchema: rejects when required field 'vision' is missing", () => {
  const run = runRecordSchema.parse(baseRun());
  const spec = buildSpecSkeleton(run, "build a CLI tool");
  const { vision: _omitted, ...specWithoutVision } = spec;
  assert.throws(() => specSchema.parse(specWithoutVision));
});

// ---------------------------------------------------------------------------
// contractSchema
// ---------------------------------------------------------------------------

test("contractSchema: accepts a valid minimal drafted contract (via skeleton builder)", () => {
  const run = runRecordSchema.parse(baseRun());
  const spec = buildSpecSkeleton(run, "build a CLI tool");
  const contract = buildContractSkeleton(run, spec, 1, "initial");
  assert.doesNotThrow(() => contractSchema.parse(contract));
});

test("contractSchema: rejects an invalid decision value", () => {
  const run = runRecordSchema.parse(baseRun());
  const spec = buildSpecSkeleton(run, "build a CLI tool");
  const contract = buildContractSkeleton(run, spec, 1, "initial");
  const invalid = { ...contract, decision: "reboot" };
  assert.throws(() => contractSchema.parse(invalid));
});

// ---------------------------------------------------------------------------
// reportSchema
// ---------------------------------------------------------------------------

test("reportSchema: accepts a valid minimal report", () => {
  const report = {
    runId: "sample-run-20260424-1000",
    artifact: "report",
    sprint: 1,
    status: "done",
    createdAt: "2026-04-24T10:00:00.000Z",
    updatedAt: "2026-04-24T10:00:00.000Z",
    whatIBuilt: ["Implemented the main CLI entry point."],
    selfCheck: [{ label: "Does it start?", passed: true, note: "Yes, exits 0." }],
    changeLog: ["Added cli.ts"],
    knownConcerns: [],
    filesChanged: ["src/cli.ts"],
  };
  assert.doesNotThrow(() => reportSchema.parse(report));
});

// ---------------------------------------------------------------------------
// scoreSchema
// ---------------------------------------------------------------------------

test("scoreSchema: accepts a valid minimal score (via skeleton builder)", () => {
  const run = runRecordSchema.parse(baseRun());
  const spec = buildSpecSkeleton(run, "build a CLI tool");
  const contract = buildContractSkeleton(run, spec, 1, "initial");
  const { score } = buildEvaluationSkeleton(contract, "PASS");
  assert.doesNotThrow(() => scoreSchema.parse(score));
});

test("scoreSchema: rejects an invalid verdict value", () => {
  const run = runRecordSchema.parse(baseRun());
  const spec = buildSpecSkeleton(run, "build a CLI tool");
  const contract = buildContractSkeleton(run, spec, 1, "initial");
  const { score } = buildEvaluationSkeleton(contract, "PASS");
  const invalid = { ...score, verdict: "MAYBE" };
  assert.throws(() => scoreSchema.parse(invalid));
});

// ---------------------------------------------------------------------------
// evidenceSchema
// ---------------------------------------------------------------------------

test("evidenceSchema: accepts a valid minimal evidence object (via skeleton builder)", () => {
  const run = runRecordSchema.parse(baseRun());
  const spec = buildSpecSkeleton(run, "build a CLI tool");
  const contract = buildContractSkeleton(run, spec, 1, "initial");
  const { evidence } = buildEvaluationSkeleton(contract, "PASS");
  assert.doesNotThrow(() => evidenceSchema.parse(evidence));
});

// ---------------------------------------------------------------------------
// summarySchema
// ---------------------------------------------------------------------------

test("summarySchema: accepts a valid minimal summary", () => {
  const summary = {
    runId: "sample-run-20260424-1000",
    artifact: "summary",
    qualityProfile: "backend",
    executionMode: "full-loop",
    deliveryMode: "single-pass",
    gitMode: "workspace-mode",
    model: "runtime-dev",
    status: "completed",
    finalVerdict: "ABORTED",
    totalSprints: 0,
    createdAt: "2026-04-24T10:00:00.000Z",
    updatedAt: "2026-04-24T10:00:00.000Z",
    requestSummary: "Build a CLI tool — aborted by user.",
    sprintHistory: [],
    finalVerdictReason: "User requested abort before any sprint began.",
    strongestEvidence: [],
    residualRisks: [],
    recommendedNextStep: "Review the spec and restart.",
  };
  assert.doesNotThrow(() => summarySchema.parse(summary));
});
