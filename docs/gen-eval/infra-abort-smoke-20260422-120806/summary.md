---
run_id: "infra-abort-smoke-20260422-120806"
artifact: "summary"
quality_profile: "ui"
execution_mode: "full-loop"
delivery_mode: "single-pass"
git_mode: "workspace-mode"
model: "runtime-dev"
status: "completed"
final_verdict: "ABORTED"
total_sprints: 1
created_at: "2026-04-22T12:08:06.686Z"
updated_at: "2026-04-22T12:08:06.717Z"
---

# Run Summary

## Request summary
infra abort smoke

## Run configuration
- quality profile: `ui`
- execution mode: `full-loop`
- delivery mode: `single-pass`
- git mode: `workspace-mode`
- model: `runtime-dev`

## Sprint history
| Sprint | Decision | Verdict | Failed dimensions | Notes |
|--------|----------|---------|-------------------|-------|
| 1 | initial | INFRA_FAIL | criterion-1, criterion-2 | Infrastructure prevented full verification. |

## Final verdict
ABORTED: Playwright browser binaries are not installed. Run `npx playwright install` before retrying.

## Strongest evidence
- None

## Residual risks
- Playwright browser binaries are not installed. Run `npx playwright install` before retrying.
- Criterion criterion-1 remained unverified.
- Criterion criterion-2 remained unverified.
- No live evidence confirmed criterion-1.
- No live evidence confirmed criterion-2.

## Recommended next step
Decide whether to reopen the run or archive it with its incomplete artefacts.
