---
run_id: "role-pipeline-smoke-20260422-111949"
artifact: "contract"
sprint: 1
quality_profile: "ui"
execution_mode: "full-loop"
delivery_mode: "single-pass"
git_mode: "workspace-mode"
status: "signed"
decision: "initial"
negotiation_round: 1
generator_signed: true
evaluator_signed: true
created_at: "2026-04-22T11:19:56.724Z"
updated_at: "2026-04-22T11:20:00.051Z"
---

# Sprint 1 Contract

## Strategic decision
initial

## Scope
- Satisfy the primary request: verify the planner role can write a valid UI quality spec

## Out of scope
- Any requirement not implied by the request, active profile, or repository environment.

## Criteria
| ID | Criterion | Dimension | Threshold | Evidence types | Verification steps |
|----|-----------|-----------|-----------|----------------|--------------------|
| criterion-1 | A sprint contract can be drafted from this spec without inventing hidden requirements. | Design Quality | 7 | screenshot, console_check | Verify criterion 1: A sprint contract can be drafted from this spec without inventing hidden requirements. |
| criterion-2 | The evaluator can derive concrete checks from the spec's quality intent and scope. | Functionality | 7 | selector_assertion, console_check | Verify criterion 2: The evaluator can derive concrete checks from the spec's quality intent and scope. |


## Playwright plan
### criterion-1
- stop on failure: true
- goto / (load)
- wait for body (visible)
- screenshot criterion-1.png (full page)
- check console error

### criterion-2
- stop on failure: true
- goto / (load)
- wait for body (visible)
- assert body min=1
- check console error


## Verification checklist
- Confirm the implementation is reachable in the local environment.
- Validate every criterion with at least one evidence source.

## Known constraints
- Only constraints implied by the request or environment should be treated as mandatory.

## Signatures
- Generator: signed
- Evaluator: signed
