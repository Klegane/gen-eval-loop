---
run_id: "preflight-summary-smoke-20260422-195258"
artifact: "summary"
quality_profile: "ui"
execution_mode: "full-loop"
delivery_mode: "single-pass"
git_mode: "workspace-mode"
model: "runtime-dev"
status: "completed"
final_verdict: "ABORTED"
total_sprints: 1
created_at: "2026-04-22T19:52:58.389Z"
updated_at: "2026-04-22T19:52:58.429Z"
---

# Run Summary

## Request summary
preflight summary smoke

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
ABORTED: The runtime hit a permission or sandbox restriction while starting infrastructure. Retry with the required permissions or run the target service outside the sandbox.

## Latest preflight
- status: `PASS`
- provider: `development`
- profile: `ui`
- model: `runtime-dev`
- runtime health: `WARN`
- provider health: `SKIPPED`

### Blocking reasons
- None

### Remediation
- None


## Strongest evidence
- None

## Residual risks
- The runtime hit a permission or sandbox restriction while starting infrastructure. Retry with the required permissions or run the target service outside the sandbox.
- Criterion criterion-1 remained unverified.
- Criterion criterion-2 remained unverified.
- No live evidence confirmed criterion-1.
- No live evidence confirmed criterion-2.

## Recommended next step
Decide whether to reopen the run or archive it with its incomplete artefacts.
