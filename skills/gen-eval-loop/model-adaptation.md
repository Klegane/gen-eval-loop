# Model Adaptation

`delivery_mode` controls sprint granularity. It is independent from `execution_mode` and `quality_profile`.

## Output

The controller records the chosen mode in both:

- `docs/gen-eval/<run-id>/spec.md`
- `.gen-eval/<run-id>/state.json`

## Modes

### single-pass

Use when the active model is strong enough to hold a large contract coherently.

Typical default:

- frontier-tier Claude models such as `claude-opus-*`
- other strongest available models in the current environment

Shape:

1. Planner writes the full spec.
2. Generator drafts one large contract.
3. Evaluator signs.
4. Generator implements the full sprint.
5. Evaluator runs one exhaustive score pass.

Cap: 5 sprints.

### short-sprint

Use when the active model is more likely to drift or when the user wants maximum rigor.

Typical default:

- mid-tier Claude models such as `claude-sonnet-*`
- unknown models
- any run where the user explicitly values rigor over speed

Shape:

1. Planner writes the full spec.
2. Generator drafts a cohesive slice.
3. Evaluator signs.
4. Generator implements.
5. Evaluator scores.
6. Repeat with `refine` or `pivot`.

Cap: 15 sprints.

## Fallback Rules

- Unknown model id -> default to `short-sprint`.
- User asked for speed -> controller may choose `single-pass`, but must note the risk in the spec.
- User asked for rigor -> controller may choose `short-sprint` even on a frontier model.

## What Does Not Change

These are constant across modes:

- the run structure
- the quality profile
- the evidence gate
- the requirement for a signed contract
- the final summary

## Evaluator Model Recommendation

The SprintEvaluator should run on a **more capable model than the Generator** when the environment allows it.

Recommended pairings (Generator → SprintEvaluator):

| Generator model | Recommended SprintEvaluator model |
|-----------------|-----------------------------------|
| `claude-sonnet-*` | `claude-opus-*` |
| `claude-haiku-*` | `claude-sonnet-*` or `claude-opus-*` |
| `claude-opus-*` | `claude-opus-*` (same tier — no upgrade available) |

The ContractReviewer may use the same model as the Generator — its job is structural validation, not quality judgment.

If the environment does not support per-subagent model selection, document this in `state.json` under `evaluatorModelNote` and proceed with the available model. Do not skip evaluation.

Record the chosen evaluator model in `state.json`:

```json
"evaluatorModel": "claude-opus-4-7"
```
