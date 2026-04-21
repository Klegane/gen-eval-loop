# gen-eval-loop

An AI quality system for ambitious deliverables. Instead of letting one agent build and self-approve, `gen-eval-loop` creates an auditable run with a spec, signed contract, evidence, scorecard, and final summary.

## What This Is

`gen-eval-loop` is a Claude Code plugin for work where "looks good", "feels polished", or "behaves robustly" matters more than a single unit test going green.

It is not a builder framework. It is a **quality gate** for AI work.

The core idea is simple:

1. A Planner turns the request into a quality spec.
2. A Generator proposes scope and implements it.
3. An Evaluator verifies with evidence and decides PASS or FAIL.
4. The controller enforces state transitions so no stage can be skipped casually.

## Why It Exists

LLMs are unreliable judges of their own output. They over-score weak work, hide uncertainty, and drift into "close enough".

This plugin counters that by requiring:

- explicit quality criteria before implementation
- separation between build and verification
- evidence per criterion before PASS
- a run history that can be resumed or audited

## Core Concepts

### Run

Every invocation creates a `run_id` and writes artefacts under that namespace.

Example:

```text
docs/gen-eval/coffee-roaster-homepage-20260422-1530/
.gen-eval/coffee-roaster-homepage-20260422-1530/
```

### Quality Profile

The controller chooses one active profile per run:

- `ui` - polished interfaces, landing pages, visual products
- `backend` - APIs, services, integrations, data workflows
- `agentic` - tool-using agents, long-running workflows, automation
- `content` - high-stakes written outputs where structure and grounding matter

Each profile has its own rubric. The controller must not reuse UI criteria for backend or agentic work.

### Execution Mode

- `full-loop` - plan, contract, build, evaluate, summarize
- `plan-only` - produce spec and signed contract, stop before implementation
- `evaluate-only` - score an existing implementation against a contract or explicit acceptance criteria

### Delivery Mode

The loop also adapts to model strength:

- `single-pass` - stronger models, larger sprints, lower orchestration overhead
- `short-sprint` - weaker models, tighter slices, faster feedback

See [skills/gen-eval-loop/model-adaptation.md](skills/gen-eval-loop/model-adaptation.md).

### Evidence Gate

A sprint cannot PASS unless every scored criterion has evidence attached in `.gen-eval/<run-id>/sprint-N/evidence.json`.

## Installation

1. Clone or copy this directory anywhere on disk.
2. Register the plugin in your `~/.claude/settings.json` with its absolute path:

   ```json
   {
     "plugins": ["/absolute/path/to/gen-eval-loop"]
   }
   ```

3. Recommended for `ui` runs: enable the Playwright MCP server so the Evaluator can capture real browser evidence.

## Usage

Invoke the slash command with the deliverable you want quality-gated:

```text
/gen-eval build a premium homepage for a fictional specialty coffee roaster
```

The controller will:

1. create a new run id
2. choose `execution_mode`, `quality_profile`, `delivery_mode`, and `git_mode`
3. write a run-scoped spec
4. negotiate a signed sprint contract
5. implement and evaluate against that contract
6. emit evidence, scorecards, and a final summary

## Run Layout

```text
<repo-root>/
|-- docs/
|   `-- gen-eval/
|       `-- <run-id>/
|           |-- spec.md
|           `-- summary.md
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

- `commit-mode` - the Generator must create commits and the Evaluator reviews diffs by commit.
- `workspace-mode` - use when auto-commits are not appropriate; the Evaluator reviews changed files and records the limitation.

## When To Use It

- ambitious UI or product work with a subjective quality bar
- agentic features where behavior quality is fuzzy
- backend work that needs explicit reliability and operability checks
- situations where you want an auditable AI delivery process

## When Not To Use It

- tiny bug fixes
- purely mechanical refactors
- disposable scripts
- tasks where a single binary test already captures success

## Repository Structure

```text
gen-eval-loop/
|-- .claude-plugin/plugin.json
|-- commands/gen-eval.md
`-- skills/gen-eval-loop/
    |-- SKILL.md
    |-- artifact-schema.md
    |-- state-machine.md
    |-- file-communication-layout.md
    |-- model-adaptation.md
    |-- planner-prompt.md
    |-- generator-prompt.md
    |-- evaluator-prompt.md
    |-- sprint-contract-template.md
    |-- run-summary-template.md
    |-- scoring-rubric.md
    `-- profiles/
        |-- ui/rubric.md
        |-- backend/rubric.md
        |-- agentic/rubric.md
        `-- content/rubric.md
```

## Current Scope

This refactor makes the plugin much stronger as an AI quality system, but the system is still prompt-driven. The main enforcement mechanism is now procedural and artefact-based rather than pure free-form instruction, yet it still depends on the controller following the gates defined in the skill.
