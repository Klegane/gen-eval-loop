# Run Summary Template

Every run ends with `docs/gen-eval/<run-id>/summary.md`.

## Frontmatter

```yaml
---
run_id: <run-id>
artifact: summary
quality_profile: ui
execution_mode: full-loop
delivery_mode: single-pass
status: completed
final_verdict: PASS
total_sprints: 2
created_at: 2026-04-22T15:30:00Z
updated_at: 2026-04-22T16:20:00Z
---
```

## Body Template

```markdown
# Run Summary

## Request summary
What the user asked for in one short paragraph.

## Run configuration
- quality profile: `ui`
- execution mode: `full-loop`
- delivery mode: `single-pass`
- git mode: `commit-mode`
- model: `claude-opus-4-7`

## Sprint history
| Sprint | Decision | Verdict | Failed dimensions | Notes |
|--------|----------|---------|-------------------|-------|
| 1 | initial | FAIL | Originality | too generic |
| 2 | pivot | PASS | None | stronger type and palette |

## Final verdict
State whether the run ended in `PASS`, `FAIL`, `ABORTED`, or `CAPPED`, and why.

## Residual risks
- [risk 1]
- [risk 2]

## Recommended next step
One of:
- ship
- run another sprint
- narrow the scope
- revisit the spec
```

## Summary Rules

- The summary should be readable by a human who did not watch the run live.
- Mention the strongest evidence that justified the final verdict.
- Do not hide residual risks just because the run passed.
