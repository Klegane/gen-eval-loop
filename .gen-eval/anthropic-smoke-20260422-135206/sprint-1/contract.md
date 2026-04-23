---
run_id: "anthropic-smoke-20260422-135206"
artifact: "contract"
sprint: 1
quality_profile: "ui"
execution_mode: "full-loop"
delivery_mode: "single-pass"
git_mode: "workspace-mode"
status: "drafted"
decision: "initial"
negotiation_round: 1
generator_signed: false
evaluator_signed: false
created_at: "2026-04-22T13:52:06Z"
updated_at: "2026-04-22T13:52:06Z"
---

# Sprint 1 Contract

## Strategic decision
initial

## Scope
- Block execution until spec provides sufficient context
- Document ambiguity in the request 'anthropic smoke'
- Create a minimal placeholder page that signals NEEDS_CONTEXT status
- Display clear message explaining that the request requires clarification

## Out of scope
- Any functional implementation before context is provided
- Visual design work beyond basic structure
- Integration with real services
- Complex UI components
- Responsive design refinement

## Criteria
| ID | Criterion | Dimension | Threshold | Evidence types | Verification steps |
|----|-----------|-----------|-----------|----------------|--------------------|
| ctx-signal | Context requirement clearly communicated | Functionality | 7 | screenshot, selector_assertion | Page loads without errors; Message explaining context need is visible; No attempt to fake a complete implementation |
| minimal-craft | Minimal page structure is clean | Craft | 7 | screenshot, console_check | No console errors on load; Basic HTML structure is valid; Typography is readable |



## Verification checklist
- Page serves on localhost
- No console errors
- Context-needed message is visible
- No placeholder content pretending to be real functionality

## Known constraints
- Spec status is NEEDS_CONTEXT across all required fields
- Request 'anthropic smoke' is ambiguous and could mean multiple things
- Cannot produce meaningful UI implementation without clarification
- Must not proceed with fake precision or guessed intent

## Signatures
- Generator: pending
- Evaluator: pending
