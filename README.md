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
5. A **deterministic runtime** enforces every state transition — no gate can be skipped or self-reported.

ContractReviewer and SprintEvaluator always run in separate subagent sessions. The agent that approved the contract never scores the implementation.

## Architecture

This project has two components that work together:

1. **Claude Code plugin** (`commands/`, `skills/`) — entry point. When you run `/gen-eval` inside Claude Code, the plugin delegates to the runtime CLI for the actual orchestration. The plugin's Markdown files are reference documentation for the roles the runtime dispatches.

2. **TypeScript runtime** (`runtime/`) — the authoritative implementation. It owns `run.json`, validates all artifacts with Zod, runs the Planner/Generator/Evaluator roles via an LLM adapter (OpenAI, Anthropic, or deterministic development), and collects Playwright evidence. See [runtime/README.md](runtime/README.md).

The runtime can be used directly via its CLI (`npm run start -- run-full-loop ...`) without Claude Code.

## Why It Exists

LLMs are unreliable judges of their own output. They over-score weak work, hide uncertainty, and drift into "close enough".

This plugin counters that by requiring:

- explicit quality criteria **before** implementation starts
- **separate roles** for contract review and sprint scoring
- evidence per criterion before PASS — `manual_observation` alone is never accepted
- a **deterministic runtime** that blocks gate transitions when artifacts are missing or malformed
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

## Installation

1. Clone or copy this directory anywhere on disk.
2. Register the plugin in your `~/.claude/settings.json`:

   ```json
   {
     "plugins": ["/absolute/path/to/gen-eval-loop"]
   }
   ```

3. Install the TypeScript runtime dependencies:

   ```bash
   cd runtime && npm install
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
├── .claude-plugin/plugin.json
├── commands/gen-eval.md
├── runtime/                        # TypeScript v2 — authoritative implementation
│   ├── src/
│   │   ├── app/                    # controllers, CLI commands
│   │   ├── domain/                 # state machine, types
│   │   ├── schemas/                # Zod schemas (single source of truth)
│   │   ├── roles/                  # Planner, Generator, Evaluator + adapters
│   │   ├── evidence/               # Playwright runner
│   │   ├── render/                 # Markdown rendering
│   │   └── storage/                # FileStore, paths
│   ├── tests/                      # node:test coverage
│   └── package.json
└── skills/gen-eval-loop/           # reference docs for runtime roles
    ├── SKILL.md
    ├── artifact-schema.md
    ├── state-machine.md
    ├── file-communication-layout.md
    ├── model-adaptation.md
    ├── planner-prompt.md
    ├── generator-prompt.md
    ├── contract-reviewer-prompt.md
    ├── sprint-evaluator-prompt.md
    ├── sprint-contract-template.md
    ├── run-summary-template.md
    ├── scoring-rubric.md
    └── profiles/
        ├── ui/rubric.md
        ├── backend/rubric.md
        ├── agentic/rubric.md
        └── content/rubric.md
```
