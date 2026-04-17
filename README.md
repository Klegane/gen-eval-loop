# gen-eval-loop

A Claude Code plugin that implements a **Planner → Generator → Evaluator** loop inspired by GANs. It enforces a strict separation between the role that builds and the role that verifies, using negotiated sprint contracts and live evaluation (Playwright MCP).

## Why

LLMs are unreliable at grading their own work — they tend to praise mediocre output. The fix is the same one GANs use: a generator and a discriminator running in isolated sessions, competing through a concrete rubric with a hard threshold.

## Installation

1. Clone or copy this directory anywhere on disk (e.g. `./plugins/gen-eval-loop` relative to your project, or a shared tools folder).
2. Register the plugin in your `~/.claude/settings.json`, pointing to its absolute path:
   ```json
   {
     "plugins": ["/absolute/path/to/gen-eval-loop"]
   }
   ```
   Alternatively, load it from the `/plugin` menu inside Claude Code and select the local directory.
3. Recommended: have the **Playwright MCP server** active so the Evaluator can perform real clicks, navigations, and screenshots. Without it, the Evaluator falls back to static code review and will warn once.

## Usage

Two ways to invoke it:

**Explicit slash command:**
```
/gen-eval build a landing page for a fictional specialty coffee roaster
```

**Description-based discovery:** describe an ambitious deliverable and Claude Code will activate the skill automatically when the request matches its `description`.

## What it produces

- `docs/gen-eval/spec.md` — Planner's ambitious product spec.
- `.gen-eval/sprint-N/contract.md` — contract signed by Generator and Evaluator before any code is written.
- `.gen-eval/sprint-N/report.md` — Generator's status after implementation.
- `.gen-eval/sprint-N/score.md` — 0–10 scores per rubric dimension plus PASS/FAIL verdict.
- `.gen-eval/sprint-N/screenshots/` — visual evidence captured by the Evaluator.

Commit `docs/gen-eval/` alongside your code. Add `.gen-eval/` to `.gitignore` by default.

## Structure

```
gen-eval-loop/
├── .claude-plugin/plugin.json
├── commands/gen-eval.md
└── skills/gen-eval-loop/
    ├── SKILL.md
    ├── planner-prompt.md
    ├── generator-prompt.md
    ├── evaluator-prompt.md
    ├── sprint-contract-template.md
    ├── scoring-rubric.md
    ├── file-communication-layout.md
    └── model-adaptation.md
```

## Model adaptation

The loop picks a mode based on the current model:

- **Opus-tier (Opus 4.6, 4.7, newer):** `single-pass` — one spec, one large contract, one exhaustive evaluation. Cap: 5 iterations.
- **Sonnet-tier and older (Sonnet 4.6, Sonnet 3.5, Opus 4.5, legacy):** `short-sprint` — cohesive slices of 3–5 files, evaluated after each. Cap: 15 iterations.

Unknown models default to `short-sprint` (safer).

## When NOT to use it

- Short bugfixes.
- Mechanical tasks with a clear, objective spec (use `subagent-driven-development` instead).
- Refactors without subjective quality criteria.
