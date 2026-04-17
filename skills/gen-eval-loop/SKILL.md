---
name: gen-eval-loop
description: Use when the user wants an ambitious, high-quality deliverable (polished UI, visual product, agentic feature) where LLM self-assessment is unreliable. Triggers on tasks that need strict separation between building and verification, scored against a rubric with a threshold, and live checks via Playwright. Skip for bugfixes, mechanical tasks, or refactors with no subjective quality bar.
---

# Generator-Evaluator Loop (GAN-style)

## Overview

LLMs are bad at self-evaluating their own work — they over-praise mediocre output. This skill borrows the GAN pattern: **the agent that builds must not be the agent that judges**. You orchestrate three isolated roles (Planner, Generator, Evaluator) through file-based handoffs and a scored rubric with a strict threshold.

**Core principle:** Generator and Evaluator are adversaries. The Evaluator's job is to *find flaws*, not to validate the Generator. The rubric is the contract; the threshold is non-negotiable.

## When to Use

```
Ambitious deliverable with subjective quality bar? ─yes─► Does "looking good" matter more than "passing tests"? ─yes─► gen-eval-loop
                                                                                                             ─no──► subagent-driven-development
                                                   ─no──► Manual execution or smaller skill
```

**Use when:**
- Building polished UI, landing pages, visual products
- Designing agentic features where behavior quality is fuzzy
- Producing product specs where "ambition" matters
- You've noticed the model praising its own mediocre output
- The user said "make it great" (not "make it work")

**Do NOT use for:**
- Bugfixes of a few lines
- Mechanical refactors
- Tasks with purely binary pass/fail tests (use `subagent-driven-development`)
- One-off scripts

## The Three Roles

Each role is a **fresh subagent** dispatched via `Task` — never the controller itself. Isolated context keeps them honest.

**Planner.** Expands the user's prompt into an ambitious product spec. Focuses on *what* and *why*, never *how*. Output: `docs/gen-eval/spec.md`. Template: [planner-prompt.md](planner-prompt.md).

**Generator.** Reads the spec and the sprint contract, writes code, commits to git, writes a status report. Can propose architectural pivots if stuck. Template: [generator-prompt.md](generator-prompt.md).

**Evaluator.** Reads the contract and the report, then **exercises the system for real**: clicks through with Playwright, hits endpoints, inspects DB, studies screenshots. Scores against the rubric. Adversarial tone — does not trust the Generator. Template: [evaluator-prompt.md](evaluator-prompt.md).

## The Process

1. **Planner expansion** — Dispatch Planner with the user's prompt. It writes `docs/gen-eval/spec.md`.
2. **Sprint contract negotiation** — Generator drafts `contract.md` (scope + evaluable criteria + threshold + verification method). Evaluator reviews and signs (or requests changes). Iterate until both sign. See [sprint-contract-template.md](sprint-contract-template.md).
3. **Generator builds** — Implements the contract's scope. Commits via git. Writes `sprint-N/report.md`.
4. **Evaluator verifies live** — Runs the app, clicks through, takes screenshots, checks endpoints. Scores 0–10 per rubric criterion. Writes `sprint-N/score.md` with PASS/FAIL and specific feedback.
5. **Branch on result:**
   - All criteria ≥ threshold → sprint PASS → next sprint or final delivery.
   - Any criterion < threshold → sprint FAIL → Generator reads `score.md`, decides **refine** vs **pivot** (see below), starts next sprint.
6. **Stop condition** — Deliverable meets rubric across all sprints, or iteration cap reached (default 15). Escalate to user if capped.

All handoffs happen through files in [file-communication-layout.md](file-communication-layout.md) — never by stuffing large context into `Task` prompts.

## The Rubric

Four criteria, scored 0–10, default threshold 7:

- **Design Quality** — visual hierarchy, typography, palette, spacing.
- **Originality** — avoids "AI slop": generic fonts (Inter/Arial), purple-on-white gradients, cookie-cutter layouts.
- **Craft** — micro-details, consistency, zero visible bugs, no console errors.
- **Functionality** — every flow in the contract works end-to-end.

Full descriptors in [scoring-rubric.md](scoring-rubric.md). The contract can raise a threshold for a sprint but never lower it.

## Refine vs Pivot

When a sprint fails, the Generator must make a strategic call before starting the next:

- **Refine** if the score shows the direction is right (most criteria ≥ threshold, one or two close behind). Incremental fixes.
- **Pivot** if the same criterion has failed in two consecutive sprints, or the score is a blanket low. Propose a different architecture/design direction in the next contract — don't patch a dead end.

Record the decision at the top of the next `contract.md`.

## Model Adaptation

The rigidity of the loop depends on the underlying model. See [model-adaptation.md](model-adaptation.md).

- **Opus-tier (Opus 4.6, 4.7):** single-pass mode. Planner → Generator builds everything → Evaluator runs one exhaustive pass at the end. Iterate only on failure.
- **Sonnet-tier and older (Sonnet 4.6, Sonnet 3.5, Opus 4.5, legacy):** short-sprint mode. 3–5 files per sprint, evaluation after each, cap 15 iterations. Sonnet 4.6 is strong but benefits from tighter feedback loops — its context-coherence budget is narrower than Opus.

The controller detects the current model at start and logs the chosen mode in `docs/gen-eval/spec.md` header.

## Controller Responsibilities

The controller (you, orchestrating in the main session) does NOT write code. Its job:

1. Detect model → pick mode.
2. Dispatch Planner → read `spec.md`.
3. For each sprint: dispatch Generator → dispatch Evaluator → handle result → decide next sprint or stop.
4. Keep `TodoWrite` in sync with sprint progress.
5. Surface user-gating questions via `AskUserQuestion` when the Evaluator flags something that needs human taste (not on every sprint — only when it genuinely can't judge).

## Red Flags

**Never:**
- Let the Generator grade its own work.
- Skip the Playwright (or equivalent live) verification when evaluating UI.
- Accept "close enough" — the threshold is the threshold.
- Pass large content between roles in prompts — use files.
- Start a sprint without a signed contract.
- Let the controller start coding directly instead of dispatching.
- Continue past sprint 15 without escalating to the user.

**If two sprints fail on the same criterion** → pivot, do not patch.

**If the Evaluator cannot run the app** → that is itself a FAIL (Craft/Functionality). Don't let the Evaluator score blind.

## Related Skills

- **subagent-driven-development** — use instead when tasks have binary pass/fail criteria and you don't need a subjective rubric. That skill is about spec compliance; this skill is about quality under ambition.
- **frontend-design** — useful reference for "Originality" in the rubric (what counts as AI slop).
- **writing-plans** — use before invoking this skill if the user wants to review the spec before any code is written.

## Example Turn

```
User: /gen-eval build a specialty coffee roaster landing page

Controller:
  [detects claude-opus-4-7 → single-pass mode, logs decision]
  [dispatches Planner with the user prompt]
Planner → writes docs/gen-eval/spec.md (vision, audience, success criteria)

Controller:
  [dispatches Generator to draft sprint-1 contract from spec]
Generator → writes .gen-eval/sprint-1/contract.md (scope: hero+menu+story sections; threshold 7/10; verification: Playwright visits /, screenshots hero+menu, no console errors)

Controller:
  [dispatches Evaluator to review contract]
Evaluator → signs (or requests changes). Both sign.

Controller:
  [dispatches Generator to implement]
Generator → builds, commits, writes report.md

Controller:
  [dispatches Evaluator to verify]
Evaluator → starts dev server, Playwright navigates, screenshots, scores:
  Design 8, Originality 5 (Inter font + purple gradient — AI slop), Craft 7, Functionality 9
  Verdict: FAIL (Originality below threshold)

Controller:
  [Generator reads score.md, decides: pivot (change type system + palette)]
  [dispatches Generator for sprint-2 with pivot note in contract]
  ...
```
