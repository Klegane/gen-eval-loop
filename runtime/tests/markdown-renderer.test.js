"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  renderSpecMarkdown,
  renderContractMarkdown,
  renderReportMarkdown,
  renderScoreMarkdown,
  renderSummaryMarkdown,
} = require("../dist/render/markdown-renderer.js");
const { buildSpecSkeleton } = require("../dist/app/spec-skeleton.js");
const { buildContractSkeleton } = require("../dist/app/contract-skeleton.js");
const { buildReportSkeleton } = require("../dist/app/report-skeleton.js");
const { buildEvaluationSkeleton } = require("../dist/app/evaluation-skeleton.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sampleRun() {
  return {
    runId: "sample-run",
    requestPrompt: "build a thing",
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
  };
}

function sampleSummary() {
  return {
    runId: "sample-run",
    artifact: "summary",
    qualityProfile: "backend",
    executionMode: "full-loop",
    deliveryMode: "single-pass",
    gitMode: "workspace-mode",
    model: "runtime-dev",
    status: "completed",
    finalVerdict: "PASS",
    totalSprints: 1,
    createdAt: "2026-04-24T10:00:00.000Z",
    updatedAt: "2026-04-24T10:00:00.000Z",
    requestSummary: "build a thing — completed successfully.",
    sprintHistory: [
      {
        sprint: 1,
        decision: "initial",
        verdict: "PASS",
        failedDimensions: [],
        notes: [],
      },
    ],
    finalVerdictReason: "All criteria passed in sprint 1.",
    strongestEvidence: ["command output confirmed correctness"],
    residualRisks: ["edge cases not tested"],
    recommendedNextStep: "Deploy to staging.",
  };
}

// ---------------------------------------------------------------------------
// renderSpecMarkdown
// ---------------------------------------------------------------------------

test("renderSpecMarkdown: output contains YAML frontmatter delimiters", () => {
  const run = sampleRun();
  const spec = buildSpecSkeleton(run, "build a thing");
  const md = renderSpecMarkdown(spec);

  assert.ok(md.startsWith("---\n"), "should open with YAML frontmatter");
  assert.ok(md.includes("\n---\n"), "should close frontmatter block");
});

test("renderSpecMarkdown: frontmatter contains expected artifact and run fields", () => {
  const run = sampleRun();
  const spec = buildSpecSkeleton(run, "build a thing");
  const md = renderSpecMarkdown(spec);

  assert.ok(md.includes('artifact: "spec"'), "artifact field in frontmatter");
  assert.ok(md.includes('run_id: "sample-run"'), "run_id field in frontmatter");
  assert.ok(md.includes('status: "ready"'), "status field in frontmatter");
  assert.ok(md.includes('quality_profile: "backend"'), "quality_profile in frontmatter");
});

test("renderSpecMarkdown: body contains required section headings and request text", () => {
  const run = sampleRun();
  const spec = buildSpecSkeleton(run, "build a thing");
  const md = renderSpecMarkdown(spec);

  assert.ok(md.includes("# Quality Spec"), "top-level heading present");
  assert.ok(md.includes("## Request"), "Request section present");
  assert.ok(md.includes("## Vision"), "Vision section present");
  assert.ok(md.includes("## Core functionality"), "Core functionality section present");
  assert.ok(md.includes("build a thing"), "request text appears in body");
});

// ---------------------------------------------------------------------------
// renderContractMarkdown
// ---------------------------------------------------------------------------

test("renderContractMarkdown: output contains YAML frontmatter with contract artifact", () => {
  const run = sampleRun();
  const spec = buildSpecSkeleton(run, "build a thing");
  const contract = buildContractSkeleton(run, spec, 1, "initial");
  const md = renderContractMarkdown(contract);

  assert.ok(md.startsWith("---\n"), "should open with YAML frontmatter");
  assert.ok(md.includes('artifact: "contract"'), "artifact field in frontmatter");
  assert.ok(md.includes('run_id: "sample-run"'), "run_id in frontmatter");
  assert.ok(md.includes("sprint: 1"), "sprint in frontmatter");
  assert.ok(md.includes('decision: "initial"'), "decision in frontmatter");
});

test("renderContractMarkdown: body contains sprint heading, criteria table, and signature section", () => {
  const run = sampleRun();
  const spec = buildSpecSkeleton(run, "build a thing");
  const contract = buildContractSkeleton(run, spec, 1, "initial");
  const md = renderContractMarkdown(contract);

  assert.ok(md.includes("# Sprint 1 Contract"), "sprint contract heading");
  assert.ok(md.includes("## Criteria"), "Criteria section present");
  assert.ok(md.includes("## Signatures"), "Signatures section present");
  assert.ok(md.includes("## Verification checklist"), "Verification checklist section present");
  // generatorSigned is true in skeleton, evaluatorSigned is false
  assert.ok(md.includes("Generator: signed"), "generator signed status");
  assert.ok(md.includes("Evaluator: pending"), "evaluator pending status");
});

// ---------------------------------------------------------------------------
// renderReportMarkdown
// ---------------------------------------------------------------------------

test("renderReportMarkdown: output contains YAML frontmatter with report artifact", () => {
  const run = sampleRun();
  const spec = buildSpecSkeleton(run, "build a thing");
  const contract = buildContractSkeleton(run, spec, 1, "initial");
  const report = buildReportSkeleton(contract);
  const md = renderReportMarkdown(report);

  assert.ok(md.startsWith("---\n"), "should open with YAML frontmatter");
  assert.ok(md.includes('artifact: "report"'), "artifact field in frontmatter");
  assert.ok(md.includes('run_id: "sample-run"'), "run_id in frontmatter");
  assert.ok(md.includes("sprint: 1"), "sprint in frontmatter");
});

test("renderReportMarkdown: body contains sprint heading, self-check table, and key sections", () => {
  const run = sampleRun();
  const spec = buildSpecSkeleton(run, "build a thing");
  const contract = buildContractSkeleton(run, spec, 1, "initial");
  const report = buildReportSkeleton(contract);
  const md = renderReportMarkdown(report);

  assert.ok(md.includes("# Sprint 1 Report"), "sprint report heading");
  assert.ok(md.includes("## What I built"), "What I built section present");
  assert.ok(md.includes("## Self-check against contract"), "Self-check section present");
  assert.ok(md.includes("## Change log"), "Change log section present");
  // Skeleton defaults selfCheck items to passed: false
  assert.ok(md.includes("FAIL"), "self-check table has FAIL entry from skeleton defaults");
});

// ---------------------------------------------------------------------------
// renderScoreMarkdown
// ---------------------------------------------------------------------------

test("renderScoreMarkdown: output contains YAML frontmatter with score artifact and verdict", () => {
  const run = sampleRun();
  const spec = buildSpecSkeleton(run, "build a thing");
  const contract = buildContractSkeleton(run, spec, 1, "initial");
  const { score } = buildEvaluationSkeleton(contract, "PASS");
  const md = renderScoreMarkdown(score);

  assert.ok(md.startsWith("---\n"), "should open with YAML frontmatter");
  assert.ok(md.includes('artifact: "score"'), "artifact field in frontmatter");
  assert.ok(md.includes('run_id: "sample-run"'), "run_id in frontmatter");
  assert.ok(md.includes('verdict: "PASS"'), "verdict in frontmatter");
  assert.ok(md.includes("sprint: 1"), "sprint in frontmatter");
});

test("renderScoreMarkdown: body contains sprint heading, criteria table, and verdict section", () => {
  const run = sampleRun();
  const spec = buildSpecSkeleton(run, "build a thing");
  const contract = buildContractSkeleton(run, spec, 1, "initial");
  const { score } = buildEvaluationSkeleton(contract, "PASS");
  const md = renderScoreMarkdown(score);

  assert.ok(md.includes("# Sprint 1 Score"), "sprint score heading");
  assert.ok(md.includes("## Verdict summary"), "Verdict summary section present");
  assert.ok(md.includes("## Criteria table"), "Criteria table section present");
  assert.ok(md.includes("## Blocking findings"), "Blocking findings section present");
  // PASS skeleton: score=8, threshold=7, status=PASS
  assert.ok(md.includes("PASS"), "PASS status present in criteria table");
  // Non-blocking observations for PASS
  assert.ok(md.includes("## Non-blocking observations"), "Non-blocking observations section present");
});

test("renderScoreMarkdown: FAIL evaluation marks criteria as FAIL", () => {
  const run = sampleRun();
  const spec = buildSpecSkeleton(run, "build a thing");
  const contract = buildContractSkeleton(run, spec, 1, "initial");
  const { score } = buildEvaluationSkeleton(contract, "FAIL");
  const md = renderScoreMarkdown(score);

  assert.ok(md.includes('verdict: "FAIL"'), "verdict is FAIL in frontmatter");
  assert.ok(md.includes("FAIL"), "FAIL status in criteria table");
});

// ---------------------------------------------------------------------------
// renderSummaryMarkdown
// ---------------------------------------------------------------------------

test("renderSummaryMarkdown: output contains YAML frontmatter with summary artifact and final_verdict", () => {
  const summary = sampleSummary();
  const md = renderSummaryMarkdown(summary);

  assert.ok(md.startsWith("---\n"), "should open with YAML frontmatter");
  assert.ok(md.includes('artifact: "summary"'), "artifact field in frontmatter");
  assert.ok(md.includes('run_id: "sample-run"'), "run_id in frontmatter");
  assert.ok(md.includes('final_verdict: "PASS"'), "final_verdict in frontmatter");
  assert.ok(md.includes("total_sprints: 1"), "total_sprints in frontmatter");
});

test("renderSummaryMarkdown: body contains run summary heading, sprint history table, and final verdict", () => {
  const summary = sampleSummary();
  const md = renderSummaryMarkdown(summary);

  assert.ok(md.includes("# Run Summary"), "top-level heading present");
  assert.ok(md.includes("## Request summary"), "Request summary section present");
  assert.ok(md.includes("## Sprint history"), "Sprint history section present");
  assert.ok(md.includes("## Final verdict"), "Final verdict section present");
  assert.ok(md.includes("build a thing"), "requestSummary text appears in body");
  // finalVerdict and finalVerdictReason both appear in body
  assert.ok(md.includes("PASS: All criteria passed in sprint 1."), "final verdict with reason");
  // sprint history table row
  assert.ok(md.includes("| 1 |"), "sprint history row for sprint 1");
});

test("renderSummaryMarkdown: optional latestPreflight section is omitted when null", () => {
  const summary = sampleSummary(); // no latestPreflight
  const md = renderSummaryMarkdown(summary);

  assert.ok(!md.includes("## Latest preflight"), "latestPreflight section absent when not provided");
});

test("renderSummaryMarkdown: optional latestPreflight section is rendered when provided", () => {
  const summary = {
    ...sampleSummary(),
    latestPreflight: {
      status: "ok",
      provider: "anthropic",
      profile: "backend",
      model: "runtime-dev",
      runtimeHealth: { overallStatus: "ok", checks: [] },
      providerHealth: { status: "ok" },
      blockingReasons: [],
      remediation: [],
    },
  };
  const md = renderSummaryMarkdown(summary);

  assert.ok(md.includes("## Latest preflight"), "latestPreflight section rendered when provided");
  assert.ok(md.includes("status: `ok`"), "preflight status rendered");
  assert.ok(md.includes("provider: `anthropic`"), "preflight provider rendered");
});
