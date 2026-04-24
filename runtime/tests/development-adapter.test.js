"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { createLlmAdapter } = require("../dist/roles/adapter-factory.js");
const { specSchema } = require("../dist/schemas/spec.js");
const { contractSchema } = require("../dist/schemas/contract.js");
const { reportSchema } = require("../dist/schemas/report.js");
const { scoreSchema } = require("../dist/schemas/score.js");
const { contractReviewSchema } = require("../dist/schemas/contract-review.js");

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const ISO_TS = "2026-04-22T10:00:00.000Z";

function baseRun(overrides = {}) {
  return {
    runId: "dev-adapter-test-001",
    requestPrompt: "build a REST API",
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
    createdAt: ISO_TS,
    updatedAt: ISO_TS,
    preflightHistory: [],
    sprints: [],
    ...overrides,
  };
}

function baseContract(overrides = {}) {
  return {
    runId: "dev-adapter-test-001",
    artifact: "contract",
    sprint: 1,
    qualityProfile: "backend",
    executionMode: "full-loop",
    deliveryMode: "single-pass",
    gitMode: "workspace-mode",
    status: "drafted",
    decision: "initial",
    negotiationRound: 1,
    generatorSigned: true,
    evaluatorSigned: false,
    createdAt: ISO_TS,
    updatedAt: ISO_TS,
    scope: ["Implement GET /items endpoint", "Implement POST /items endpoint"],
    outOfScope: ["Authentication", "Rate limiting"],
    criteria: [
      {
        id: "criterion-1",
        label: "GET /items returns 200 with valid JSON",
        dimension: "Correctness",
        threshold: 8,
        evidenceTypes: ["command_output"],
        verificationSteps: ["Run curl against the endpoint and verify 200 status"],
      },
    ],
    verificationChecklist: [
      "Confirm the implementation is reachable in the local environment.",
      "Validate every criterion with at least one evidence source.",
    ],
    knownConstraints: ["Only constraints implied by the request or environment should be treated as mandatory."],
    ...overrides,
  };
}

function baseEvidence(overrides = {}) {
  return {
    runId: "dev-adapter-test-001",
    sprint: 1,
    evaluationMode: "command-only",
    criteria: [
      {
        criterionId: "criterion-1",
        status: "PASS",
        evidence: [
          {
            type: "command_output",
            value: "HTTP/1.1 200 OK",
            note: "curl returned 200",
          },
        ],
      },
    ],
    infraFailures: [],
    ...overrides,
  };
}

function baseSpec(overrides = {}) {
  return {
    runId: "dev-adapter-test-001",
    artifact: "spec",
    qualityProfile: "backend",
    executionMode: "full-loop",
    deliveryMode: "single-pass",
    gitMode: "workspace-mode",
    model: "runtime-dev",
    status: "ready",
    createdAt: ISO_TS,
    updatedAt: ISO_TS,
    request: "build a REST API",
    vision: "Deliver a quality-gated outcome for: build a REST API",
    primaryUser: "Primary end user defined by the original request",
    successMoment: "The user can accomplish the requested goal without obvious friction or ambiguity.",
    qualityIntent: "Create a first-pass quality spec that is specific enough to negotiate a contract.",
    coreFunctionality: ["Satisfy the primary request: build a REST API"],
    qualityPrinciples: [
      "Prefer explicit, auditable outcomes over vague aspirations.",
      "Keep scope coherent enough for a single sprint contract.",
    ],
    constraints: ["Only constraints implied by the request or environment should be treated as mandatory."],
    successCriteria: [
      "A sprint contract can be drafted from this spec without inventing hidden requirements.",
      "The evaluator can derive concrete checks from the spec's quality intent and scope.",
    ],
    nonGoals: ["Any requirement not implied by the request, active profile, or repository environment."],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("development adapter exposes the expected interface", () => {
  // Must not require any env vars
  const cleanEnv = Object.assign({}, process.env);
  delete cleanEnv.OPENAI_API_KEY;
  delete cleanEnv.ANTHROPIC_API_KEY;
  delete cleanEnv.GEN_EVAL_LLM_PROVIDER;

  const adapter = createLlmAdapter({ provider: "development", env: cleanEnv });

  assert.ok(adapter, "adapter should be created");
  assert.equal(typeof adapter.generateObject, "function", "adapter must expose generateObject");
  assert.ok("name" in adapter, "adapter must expose a name property");
});

test("development adapter name is a stable non-empty string", () => {
  const adapter1 = createLlmAdapter({ provider: "development" });
  const adapter2 = createLlmAdapter({ provider: "development" });

  assert.equal(typeof adapter1.name, "string");
  assert.ok(adapter1.name.length > 0, "name must be non-empty");
  assert.equal(adapter1.name, adapter2.name, "name must be stable across instances");
  assert.equal(adapter1.name, "development");
});

test("development adapter produces spec output that parses against specSchema", async () => {
  const adapter = createLlmAdapter({ provider: "development" });
  const run = baseRun();

  const response = await adapter.generateObject({
    schemaName: "spec",
    schema: specSchema,
    systemPrompt: "You are a planner.",
    userPrompt: "Plan the spec.",
    metadata: {
      taskType: "planner_spec",
      run,
      request: run.requestPrompt,
    },
  });

  assert.ok(response, "response must exist");
  assert.equal(response.adapterName, "development");

  // Parse the output through the schema — throws if invalid
  const parsed = specSchema.parse(response.output);
  assert.equal(parsed.artifact, "spec");
  assert.equal(parsed.runId, run.runId);
  assert.equal(parsed.qualityProfile, run.qualityProfile);
  assert.ok(parsed.coreFunctionality.length > 0, "spec must have coreFunctionality");
  assert.ok(parsed.successCriteria.length > 0, "spec must have successCriteria");
});

test("development adapter produces contract output that parses against contractSchema", async () => {
  const adapter = createLlmAdapter({ provider: "development" });
  const run = baseRun();
  const spec = baseSpec();

  const response = await adapter.generateObject({
    schemaName: "contract",
    schema: contractSchema,
    systemPrompt: "You are a generator.",
    userPrompt: "Draft a contract.",
    metadata: {
      taskType: "generator_contract",
      run,
      spec,
      sprint: 1,
      decision: "initial",
    },
  });

  assert.ok(response, "response must exist");
  assert.equal(response.adapterName, "development");

  const parsed = contractSchema.parse(response.output);
  assert.equal(parsed.artifact, "contract");
  assert.equal(parsed.runId, run.runId);
  assert.equal(parsed.sprint, 1);
  assert.ok(parsed.scope.length > 0, "contract must have scope");
  assert.ok(parsed.criteria.length > 0, "contract must have criteria");
});

test("development adapter produces report output that parses against reportSchema", async () => {
  const adapter = createLlmAdapter({ provider: "development" });
  const contract = baseContract();

  const response = await adapter.generateObject({
    schemaName: "report",
    schema: reportSchema,
    systemPrompt: "You are a generator.",
    userPrompt: "Write a report.",
    metadata: {
      taskType: "generator_report",
      contract,
    },
  });

  assert.ok(response, "response must exist");
  assert.equal(response.adapterName, "development");

  const parsed = reportSchema.parse(response.output);
  assert.equal(parsed.artifact, "report");
  assert.equal(parsed.runId, contract.runId);
  assert.ok(parsed.whatIBuilt.length > 0, "report must have whatIBuilt");
  assert.ok(parsed.selfCheck.length > 0, "report must have selfCheck");
});

test("development adapter produces contract review that parses against contractReviewSchema", async () => {
  const adapter = createLlmAdapter({ provider: "development" });
  const run = baseRun();
  const contract = baseContract();

  const response = await adapter.generateObject({
    schemaName: "contractReview",
    schema: contractReviewSchema,
    systemPrompt: "You are an evaluator.",
    userPrompt: "Review this contract.",
    metadata: {
      taskType: "evaluator_contract_review",
      run,
      contract,
    },
  });

  assert.ok(response, "response must exist");
  assert.equal(response.adapterName, "development");

  const parsed = contractReviewSchema.parse(response.output);
  assert.ok(["SIGNED", "CHANGES_REQUESTED"].includes(parsed.status));
  assert.equal(typeof parsed.approved, "boolean");
  assert.ok(parsed.summary.length > 0, "review must have a summary");
});

test("development adapter produces score output that parses against scoreSchema", async () => {
  const adapter = createLlmAdapter({ provider: "development" });
  const contract = baseContract();
  const evidence = baseEvidence();

  const response = await adapter.generateObject({
    schemaName: "score",
    schema: scoreSchema,
    systemPrompt: "You are an evaluator.",
    userPrompt: "Score this run.",
    metadata: {
      taskType: "evaluator_score",
      contract,
      evidence,
    },
  });

  assert.ok(response, "response must exist");
  assert.equal(response.adapterName, "development");

  const parsed = scoreSchema.parse(response.output);
  assert.equal(parsed.artifact, "score");
  assert.equal(parsed.runId, contract.runId);
  assert.ok(parsed.criteria.length > 0, "score must have criteria");
  assert.ok(["PASS", "FAIL"].includes(parsed.verdict));
});

test("development adapter outputs are deterministic for planner_spec", async () => {
  const adapter = createLlmAdapter({ provider: "development" });
  const run = baseRun();
  const requestArgs = {
    schemaName: "spec",
    schema: specSchema,
    systemPrompt: "You are a planner.",
    userPrompt: "Plan the spec.",
    metadata: {
      taskType: "planner_spec",
      run,
      request: run.requestPrompt,
    },
  };

  const response1 = await adapter.generateObject(requestArgs);
  const response2 = await adapter.generateObject(requestArgs);

  // Compare structural fields that must be stable (timestamps come from nowIso so compare non-timestamp fields)
  assert.equal(response1.output.runId, response2.output.runId);
  assert.equal(response1.output.artifact, response2.output.artifact);
  assert.equal(response1.output.qualityProfile, response2.output.qualityProfile);
  assert.equal(response1.output.request, response2.output.request);
  assert.equal(response1.output.vision, response2.output.vision);
  assert.deepEqual(response1.output.coreFunctionality, response2.output.coreFunctionality);
  assert.deepEqual(response1.output.successCriteria, response2.output.successCriteria);
  assert.deepEqual(response1.output.nonGoals, response2.output.nonGoals);
});

test("development adapter does not require any LLM API env vars", () => {
  // Create adapter with a completely empty env — no API keys of any kind
  const emptyEnv = {};

  assert.doesNotThrow(() => {
    createLlmAdapter({ provider: "development", env: emptyEnv });
  }, "development adapter must not require API keys");
});

test("development adapter throws when metadata.taskType is missing", async () => {
  const adapter = createLlmAdapter({ provider: "development" });

  await assert.rejects(
    () =>
      adapter.generateObject({
        schemaName: "spec",
        schema: specSchema,
        systemPrompt: "system",
        userPrompt: "user",
        metadata: { someOtherField: "value" },
      }),
    /taskType/,
    "adapter must throw a descriptive error when taskType is absent",
  );
});

test("development adapter contract review is SIGNED for a fully populated contract", async () => {
  const adapter = createLlmAdapter({ provider: "development" });
  const run = baseRun();
  const contract = baseContract();

  const response = await adapter.generateObject({
    schemaName: "contractReview",
    schema: contractReviewSchema,
    systemPrompt: "You are an evaluator.",
    userPrompt: "Review this contract.",
    metadata: {
      taskType: "evaluator_contract_review",
      run,
      contract,
    },
  });

  assert.equal(response.output.status, "SIGNED", "a fully populated valid contract should be SIGNED");
  assert.equal(response.output.approved, true);
  assert.equal(response.output.requestedChanges.length, 0);
});

test("development adapter score reflects PASS verdict when all criteria pass and no infra failures", async () => {
  const adapter = createLlmAdapter({ provider: "development" });
  const contract = baseContract();
  const evidence = baseEvidence(); // criterion-1 is PASS, no infraFailures

  const response = await adapter.generateObject({
    schemaName: "score",
    schema: scoreSchema,
    systemPrompt: "You are an evaluator.",
    userPrompt: "Score this run.",
    metadata: {
      taskType: "evaluator_score",
      contract,
      evidence,
    },
  });

  assert.equal(response.output.verdict, "PASS");
  assert.equal(response.output.criteria[0].status, "PASS");
});
