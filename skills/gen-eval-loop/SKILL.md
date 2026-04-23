---
name: gen-eval-loop
description: Use when the user wants an AI quality system, not just an AI builder. This skill creates auditable runs with a quality profile, signed contract, evidence per criterion, a scorecard, and a final summary. Best for ambitious UI, backend, agentic, or content work where self-assessment is unreliable.
---

# gen-eval-loop

## Purpose

This skill turns a loose generator-evaluator loop into a run-based quality system.

Its job is to stop the common failure mode where an agent:

1. builds something mediocre
2. writes a flattering self-review
3. calls the task done

This skill exists to enforce a different path:

1. define a quality bar
2. scope a sprint against that bar
3. build only after the scope is signed
4. require evidence before PASS
5. keep an audit trail of how the result earned its verdict

## The Four Axes The Controller Must Decide

Before dispatching any role, the controller must decide and record:

1. `run_id` - unique namespace for all artefacts
2. `execution_mode` - `full-loop`, `plan-only`, or `evaluate-only`
3. `quality_profile` - `ui`, `backend`, `agentic`, or `content`
4. `delivery_mode` - `single-pass` or `short-sprint`
5. `git_mode` - `commit-mode` or `workspace-mode`

These choices are recorded in:

- `docs/gen-eval/<run-id>/spec.md`
- `.gen-eval/<run-id>/state.json`

## Files To Load

The controller should use these files in this order:

1. [artifact-schema.md](artifact-schema.md)
2. [state-machine.md](state-machine.md)
3. [file-communication-layout.md](file-communication-layout.md)
4. [model-adaptation.md](model-adaptation.md)
5. the active profile rubric under `profiles/<profile>/rubric.md`
6. the relevant prompt template:
   - [planner-prompt.md](planner-prompt.md)
   - [generator-prompt.md](generator-prompt.md)
   - [evaluator-prompt.md](evaluator-prompt.md)
7. [run-summary-template.md](run-summary-template.md)

## When To Use

Use this skill when:

- the user wants a quality system or quality gate for AI work
- subjective quality matters and self-grading is risky
- the work needs evidence, not just a self-report
- the output should be resumable and auditable across sprints

## When Not To Use

Do not use this skill for:

- tiny bug fixes
- purely mechanical refactors
- throwaway scripts
- tasks where a binary test already defines success

## Quality Profile Selection

Pick exactly one profile per run:

- `ui` for visual surfaces, frontends, landing pages, dashboards
- `backend` for services, APIs, data workflows, scheduled jobs
- `agentic` for tool-using agents, orchestrators, multi-step automation
- `content` for long-form writing, specs, customer-facing copy, knowledge artefacts

Never mix rubric dimensions from multiple profiles in one sprint contract.

## Role Definitions

Each role must run in a fresh subagent session. The controller never reuses the same Generator or Evaluator session for the next sprint.

### Planner

- reads the user request plus run configuration
- writes `docs/gen-eval/<run-id>/spec.md`
- defines the quality intent and auditable success criteria
- does not choose implementation details

### Generator

- drafts `contract.md`
- implements only after the contract is signed
- writes `report.md`
- proposes `refine` or `pivot` after failed sprints

### Evaluator

- reviews contract quality before implementation
- scores the finished sprint against the active profile rubric
- writes `score.md` and `evidence.json`
- is skeptical by default

## Controller Workflow

1. Initialize run directories and `state.json`.
2. Dispatch Planner and validate the spec.
3. For each sprint:
   - Generator drafts contract
   - Evaluator reviews contract
   - controller checks signatures and schema
   - Generator implements
   - Evaluator scores and writes evidence
   - controller updates state and branches
4. Write `summary.md` at the end of the run.

## Gates

The controller must enforce these gates:

### Gate A - Spec gate

Do not start sprint work unless `spec.md` exists and includes:

- run metadata in frontmatter
- quality profile
- success criteria that can actually be checked
- explicit non-goals

### Gate B - Contract gate

Do not start implementation unless `contract.md`:

- validates against the artefact schema
- includes non-empty scope and out-of-scope
- maps each criterion to a valid rubric dimension
- contains both Generator and Evaluator signatures

### Gate C - Evaluation gate

Do not accept PASS unless:

- `score.md` exists
- `evidence.json` exists
- every criterion has at least one objective evidence item (not `manual_observation` alone)
- no criterion is `UNVERIFIED`
- every criterion is at or above threshold

`manual_observation` is only valid as supplementary context alongside objective evidence.
The gate validator (scripts/validate-gate.py) enforces this programmatically.

### Gate D - Finalization gate

Do not mark the run complete until `summary.md` reflects:

- final verdict
- sprint history
- residual risks
- profile and mode choices

## Refine vs Pivot

After a failed sprint, the Generator must choose one:

- `refine` when the direction is working and specific defects are blocking PASS
- `pivot` when the direction is failing structurally or the same dimension has failed twice in a row

The next contract must record that decision explicitly.

## Controller Discipline

The controller must not:

- write product code instead of dispatching the Generator in `full-loop`
- let a sprint bypass signatures
- treat missing evidence as a soft warning
- let the wrong profile rubric leak into scoring
- keep going after the iteration cap

## Output Philosophy

This is a quality system, not an essay generator. Artefacts should be:

- concise enough to audit quickly
- structured enough to validate
- opinionated enough to push quality upward
- specific enough that another evaluator could replay the run
