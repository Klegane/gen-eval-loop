# gen-eval-loop

An AI quality system for ambitious deliverables. Instead of letting one agent build and self-approve, `gen-eval-loop` creates an auditable run with a spec, signed contract, evidence, scorecard, and final summary.

## What This Is

`gen-eval-loop` is a Claude Code plugin for work where "looks good", "feels polished", or "behaves robustly" matters more than a single unit test going green.

It is not a builder framework. It is a **quality gate** for AI work.

The core idea:

1. A **Planner** turns the request into a quality spec.
2. A **Generator** proposes scope and implements against a signed contract.
3. A **ContractReviewer** validates the contract before implementation begins (Gate B).
4. A **SprintEvaluator** scores the finished implementation with evidence (Gate C).
5. A **deterministic gate validator** (`scripts/validate-gate.py`) enforces every state transition — no gate can be skipped or self-reported.

ContractReviewer and SprintEvaluator always run in separate subagent sessions. The agent that approved the contract never scores the implementation.

## Why It Exists

LLMs are unreliable judges of their own output. They over-score weak work, hide uncertainty, and drift into "close enough".

This plugin counters that by requiring:

- explicit quality criteria **before** implementation starts
- **separate roles** for contract review and sprint scoring
- evidence per criterion before PASS — `manual_observation` alone is never accepted
- a **deterministic Python script** that blocks gate transitions when artifacts are missing or malformed
- a run history that can be resumed or audited

## Core Concepts

### Run

Every invocation creates a `run_id` and writes artefacts under that namespace.

```text
docs/gen-eval/coffee-roaster-homepage-20260422-1530/
.gen-eval/coffee-roaster-homepage-20260422-1530/
```

### Quality Profile

The controller chooses one active profile per run:

- `ui` — polished interfaces, landing pages, visual products (**requires Playwright MCP**)
- `backend` — APIs, services, integrations, data workflows
- `agentic` — tool-using agents, long-running workflows, automation
- `content` — high-stakes written outputs where structure and grounding matter

Each profile has its own rubric. The controller must not reuse UI criteria for backend work.

### Execution Mode

- `full-loop` — plan, contract, build, evaluate, summarize
- `plan-only` — produce spec and signed contract, stop before implementation
- `evaluate-only` — score an existing implementation against a contract

### Delivery Mode

The loop adapts to model strength:

- `single-pass` — frontier models (Opus), larger sprints, lower orchestration overhead
- `short-sprint` — mid-tier models (Sonnet), tighter slices, faster feedback

See [skills/gen-eval-loop/model-adaptation.md](skills/gen-eval-loop/model-adaptation.md).

### Evidence Gate

A sprint cannot PASS unless every scored criterion has at least one **objective** evidence item in `.gen-eval/<run-id>/sprint-N/evidence.json`.

Objective evidence types: `screenshot`, `console_check`, `selector_assertion`, `http_check`, `db_check`, `log_extract`, `command_output`, `git_diff_review`.

`manual_observation` is only valid as supplementary context alongside objective evidence. Using it alone causes the gate validator to reject the criterion as `UNVERIFIED`.

### Gate Validator

`scripts/validate-gate.py` is a deterministic Python script that the controller runs before advancing state at every gate:

```bash
python3 scripts/validate-gate.py --run-id <RUN_ID> --gate A   # spec ready
python3 scripts/validate-gate.py --run-id <RUN_ID> --gate B   # contract signed
python3 scripts/validate-gate.py --run-id <RUN_ID> --gate C   # sprint evaluated
python3 scripts/validate-gate.py --run-id <RUN_ID> --gate D   # run complete
```

If the script exits non-zero, the controller must not advance `state.json`. The error message is surfaced verbatim to the user.

**Requires:** Python 3.9+, `pyyaml` (`pip install pyyaml`)

## Installation

1. Clone or copy this directory anywhere on disk.
2. Register the plugin in your `~/.claude/settings.json`:

   ```json
   {
     "plugins": ["/absolute/path/to/gen-eval-loop"]
   }
   ```

3. Install the gate validator dependency:

   ```bash
   pip install pyyaml
   ```

4. For `ui` profile runs, enable the Playwright MCP server. The UI profile has no degraded mode — runs will not start without Playwright available.

## Usage

Invoke the slash command with the deliverable you want quality-gated:

```text
/gen-eval build a premium homepage for a fictional specialty coffee roaster
```

The controller will:

1. create a run id and initialize `state.json`
2. choose `execution_mode`, `quality_profile`, `delivery_mode`, `git_mode`, and `evaluator_model`
3. write a run-scoped spec and validate it (Gate A)
4. negotiate a signed sprint contract via ContractReviewer and validate it (Gate B)
5. implement via Generator
6. score via SprintEvaluator (fresh session, preferably a more capable model) and validate (Gate C)
7. emit evidence, scorecards, and a final summary validated (Gate D)

## Evaluator Model

To reduce same-model confirmation bias, the SprintEvaluator is dispatched on a more capable model than the Generator when the environment allows it:

| Generator | Recommended SprintEvaluator |
|-----------|----------------------------|
| `claude-sonnet-*` | `claude-opus-*` |
| `claude-haiku-*` | `claude-sonnet-*` or `claude-opus-*` |
| `claude-opus-*` | `claude-opus-*` (same tier) |

## Run Layout

```text
<repo-root>/
|-- docs/
|   `-- gen-eval/
|       `-- <run-id>/
|           |-- spec.md
|           `-- summary.md
|-- scripts/
|   `-- validate-gate.py
`-- .gen-eval/
    `-- <run-id>/
        |-- state.json
        `-- sprint-1/
            |-- contract.md
            |-- report.md
            |-- score.md
            |-- evidence.json
            `-- screenshots/
```

## Git Modes

- `commit-mode` — the Generator creates commits; the SprintEvaluator reviews diffs by commit ref
- `workspace-mode` — use when auto-commits are not appropriate; the SprintEvaluator reviews changed files and records the limitation

## When To Use It

- ambitious UI or product work with a subjective quality bar
- agentic features where behavior quality is hard to capture in a unit test
- backend work that needs explicit reliability and operability checks
- any situation where you want an auditable AI delivery process with evidence per criterion

## When Not To Use It

- tiny bug fixes
- purely mechanical refactors
- disposable scripts
- tasks where a binary test already captures success

## Repository Structure

```text
gen-eval-loop/
|-- .claude-plugin/plugin.json
|-- commands/gen-eval.md
|-- scripts/
|   `-- validate-gate.py
`-- skills/gen-eval-loop/
    |-- SKILL.md
    |-- artifact-schema.md
    |-- state-machine.md
    |-- file-communication-layout.md
    |-- model-adaptation.md
    |-- planner-prompt.md
    |-- generator-prompt.md
    |-- evaluator-prompt.md          (deprecated — kept for reference)
    |-- contract-reviewer-prompt.md  (Gate B)
    |-- sprint-evaluator-prompt.md   (Gate C)
    |-- sprint-contract-template.md
    |-- run-summary-template.md
    |-- scoring-rubric.md
    `-- profiles/
        |-- ui/rubric.md
        |-- backend/rubric.md
        |-- agentic/rubric.md
        `-- content/rubric.md
```
