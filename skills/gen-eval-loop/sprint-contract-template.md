# Sprint Contract Template

Every sprint starts with a contract. The Generator drafts it. The Evaluator signs it only after checking scope, criteria, and verification steps.

Save at `.gen-eval/<run-id>/sprint-N/contract.md`.

## Frontmatter

```yaml
---
run_id: <run-id>
artifact: contract
sprint: 1
status: drafted
quality_profile: ui
execution_mode: full-loop
delivery_mode: single-pass
git_mode: commit-mode
decision: initial
negotiation_round: 1
generator_signed: false
evaluator_signed: false
created_at: 2026-04-22T15:30:00Z
updated_at: 2026-04-22T15:30:00Z
---
```

## Body Template

```markdown
# Sprint 1 Contract

## Strategic decision
One of `initial`, `refine`, or `pivot`.

If `pivot`, explain in 2-3 sentences:

- why the last direction failed
- what is changing now
- what evidence would prove the pivot worked

## Scope

- [user-visible outcome 1]
- [user-visible outcome 2]
- [user-visible outcome 3]

## Out of scope

- [deferred item 1]
- [deferred item 2]

## Criteria

| Criterion ID | Criterion | Rubric dimension | Threshold | Evidence type | Verification method |
|--------------|-----------|------------------|-----------|---------------|---------------------|
| hero-identity | Hero establishes a distinct brand identity | Originality | 8 | screenshot, manual_observation | Playwright opens `/`, captures `hero.png`, evaluator reviews against spec principles |
| hero-stability | Initial load shows no console errors or major layout shift | Craft | 7 | console_check, screenshot | Playwright loads `/`, records console, compares first and settled render |
| menu-loads | Menu page renders five data-backed items | Functionality | 7 | screenshot, selector_assertion | Playwright opens `/menu`, asserts at least five visible items |

## Verification checklist

1. Start command:
   - `pnpm dev`
2. Target URLs:
   - `http://localhost:3000/`
   - `http://localhost:3000/menu`
3. Assertions:
   - console has zero errors on initial load
   - selectors in criteria table are reachable
   - screenshots are saved under `screenshots/`
4. Fallback behavior:
   - if a required tool is unavailable, the affected criterion becomes `UNVERIFIED`

## Known constraints

- [constraint that may affect implementation or evaluation]

## Signatures

- Generator: [ ]
- Evaluator: [ ]
```

## Contract Rules

- `Scope` must be cohesive.
- `Out of scope` must never be empty.
- Every criterion must map to a valid dimension in the active profile rubric.
- Every criterion must name at least one evidence type.
- Every criterion must have a concrete verification method.
- Thresholds may be raised per criterion, never lowered below the profile default.

## Negotiation Limit

Maximum 3 rounds. After that, the controller must escalate to the user instead of silently watering down the contract.
