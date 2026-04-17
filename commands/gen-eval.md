---
description: Run the Generator-Evaluator (GAN-style) loop — Planner expands the prompt, Generator builds, Evaluator verifies live with Playwright and scores against a strict rubric.
argument-hint: <ambitious deliverable description>
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash, Task, TodoWrite, AskUserQuestion]
---

# /gen-eval

You have been invoked to run the **Generator-Evaluator loop** for this prompt:

```
$ARGUMENTS
```

## What to do

1. Load the `gen-eval-loop` skill. Follow its SKILL.md step by step — do NOT improvise the workflow.
2. Detect the current model and pick the mode (`single-pass` or `short-sprint`) per `skills/gen-eval-loop/model-adaptation.md`.
3. Dispatch the **Planner** first with the user's prompt. Read the resulting `docs/gen-eval/spec.md` yourself before moving on.
4. For each sprint: dispatch **Generator** in DRAFT_CONTRACT mode → dispatch **Evaluator** in REVIEW_CONTRACT mode → iterate until both sign → dispatch Generator in IMPLEMENT mode → dispatch Evaluator in SCORE mode → read the verdict.
5. On FAIL, have the Generator read `sprint-N/score.md` and decide refine vs pivot before drafting the next contract.
6. Stop when a sprint passes all criteria, or when the iteration cap is reached (5 for single-pass, 15 for short-sprint) — escalate to the user in that case.
7. Keep a `TodoWrite` list that tracks sprints and their verdicts. Use `AskUserQuestion` only when the Evaluator genuinely cannot judge something (rare) or when the iteration cap is hit.

## Do NOT

- Write code directly. You are the controller, not the Generator.
- Let any role skip the file handoffs. Everything goes through `docs/gen-eval/` and `.gen-eval/sprint-N/`.
- Soften the rubric. The threshold is the threshold.
- Proceed without a signed contract.

## Precondition check

Before dispatching the Planner, verify the MCP Playwright server appears in available tools (`mcp__playwright__*`). If missing, warn the user once that the Evaluator will fall back to static code review only, then proceed if they confirm.
