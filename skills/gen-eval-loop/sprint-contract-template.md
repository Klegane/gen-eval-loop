# Sprint Contract Template

Every sprint begins with a contract. The Generator drafts it; the Evaluator reviews and signs (or requests changes). No code is written until both lines are signed.

Save at `.gen-eval/sprint-N/contract.md`.

## Template

```markdown
# Sprint N Contract

## Strategic decision
One of: `initial` (sprint 1) | `refine` (continue current direction) | `pivot` (abandon previous approach). If pivot, explain in 2–3 sentences why the previous direction failed and what changes.

## Scope
Exactly what will be built in this sprint. Bulleted, each item user-visible.

- [item 1]
- [item 2]
- [item 3]

## Out of scope (this sprint)
Explicit list of things the Generator will NOT touch, to prevent scope creep.

- [thing deferred]
- [thing deferred]

## Evaluable criteria
Each criterion must map to one of the four rubric dimensions and specify how it will be checked.

| Criterion | Rubric dim.   | Threshold | How the Evaluator checks it |
|-----------|---------------|-----------|-----------------------------|
| Hero section renders with bespoke typography and coffee-shop palette | Design, Originality | 7 | Playwright navigates to /; screenshot saved; visual review |
| Menu list shows 5+ items from data source | Functionality | 7 | Playwright navigates to /menu; asserts ≥5 list items |
| No console errors on initial load | Craft | 7 | Playwright opens /; reads browser console |
| Page load < 2s on local dev | Craft | 7 | Playwright measures navigation timing |

## Verification method
Concrete, runnable steps the Evaluator will execute. No "check it works" — actual commands, URLs, and expected states.

1. `pnpm dev` — dev server on http://localhost:3000
2. Playwright visits http://localhost:3000 → screenshot `hero.png`
3. Playwright visits http://localhost:3000/menu → screenshot `menu.png` → assert ≥5 `<li>`
4. Playwright reads console → assert zero errors
5. Navigation timing → assert DOMContentLoaded < 2000ms

## Thresholds
- Default per criterion: 7/10
- Overrides: Originality ≥ 8 (spec demands a strong identity)

## Signatures
- Generator: [ ]  (sign with ✅ when draft is ready)
- Evaluator: [ ]  (sign with ✅ after reviewing)
```

## How to negotiate

- Generator fills in everything except the Evaluator signature.
- Controller dispatches Evaluator in `REVIEW_CONTRACT` mode.
- If Evaluator responds CHANGES_REQUESTED, Generator updates the contract and re-submits. Max 3 negotiation rounds — if they can't agree, escalate to the user via `AskUserQuestion`.
- Once both signed, the contract is frozen for this sprint. Neither role may edit it mid-sprint. If reality forces a change, the sprint is aborted and a new contract drafted.

## What makes a good contract

- **Scope is cohesive** — a contract describing unrelated features is a sign the sprint is too big.
- **Every criterion is automatable or visually checkable** — "feels premium" is not a criterion; "hero uses a display font from the allowed list AND saturation of accent color ≥ 0.6" is.
- **Verification steps match criteria 1:1** — the Evaluator should never have to improvise how to check something.
- **Out-of-scope is populated** — explicitly listing what won't be built protects the Generator from being dinged on things the contract didn't promise.
