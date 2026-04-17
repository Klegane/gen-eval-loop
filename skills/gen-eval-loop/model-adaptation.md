# Model Adaptation

The rigidity of the loop should match the capability of the underlying model. Stronger models can sustain long coherent tasks; weaker models drift and need frequent evaluation.

## Detection

At loop start, the controller reads the current model ID from the environment / system prompt context. Log the decision in the spec header so it's auditable:

```
---
# in docs/gen-eval/spec.md
model: claude-opus-4-7
mode: single-pass
---
```

## Modes

### single-pass

**Use for:** `claude-opus-4-7`, `claude-opus-4-6`, and any newer Opus-tier / more capable model.

**Shape:**
1. Planner produces the full spec.
2. Generator drafts **one** contract covering the whole deliverable.
3. Evaluator reviews and signs.
4. Generator implements the whole thing in a single IMPLEMENT dispatch.
5. Evaluator runs **one** exhaustive SCORE pass at the end.
6. If PASS, done. If FAIL, start sprint-2 with the score as input.

**Why:** strong models hold the whole product in context without drifting. Breaking it into micro-sprints wastes tokens on repeated overhead and costs coherence.

**Cap:** 5 iterations. If the deliverable hasn't passed by sprint-5, escalate to the user — either the rubric is unrealistic or the spec is wrong.

### short-sprint

**Use for:** `claude-sonnet-4-6` (latest Sonnet), `claude-sonnet-3-5`, `claude-opus-4-5`, and any Sonnet-tier or older / smaller model where long-context coherence is less reliable than Opus.

**Shape:**
1. Planner produces the full spec.
2. Generator draft picks a **cohesive slice** (3–5 files, one user-visible outcome) for sprint-1.
3. Evaluator signs, Generator builds, Evaluator scores.
4. Next sprint picks the next slice, using previous score as context.
5. Repeat until the spec's success criteria are all covered and passing.

**Why:** weaker models drift in long tasks; evaluating every few files catches regressions before they compound.

**Cap:** 15 iterations. If still not done, escalate.

## Fallback rules

- Unknown model ID → default to `short-sprint` (safer).
- User explicitly asked for speed → can downgrade to `single-pass` even on a weaker model, but flag the risk in the response to the user once.
- User explicitly asked for high rigor → can upgrade to `short-sprint` even on a strong model.

## What does NOT change between modes

- The rubric. Same four criteria, same default threshold.
- The roles. Planner + Generator + Evaluator in all modes.
- The file layout. Same `docs/gen-eval/` and `.gen-eval/sprint-N/` shape.
- The adversarial stance. Evaluator is hostile to the Generator's report in every mode.

The mode only affects **granularity and iteration count**, not the structure of the loop itself.
