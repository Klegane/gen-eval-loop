# State Machine

The controller must treat the run as a finite state machine. This is the main enforcement layer of the system.

## States

- `initialized`
- `spec_ready`
- `contract_drafted`
- `contract_signed`
- `implemented`
- `evaluated`
- `passed`
- `failed`
- `aborted`
- `capped`
- `completed`

## Valid Transitions

| From | To | Required artefacts |
|------|----|--------------------|
| initialized | spec_ready | `spec.md` |
| spec_ready | contract_drafted | `contract.md` with required frontmatter |
| contract_drafted | contract_signed | `contract.md` with both signatures |
| contract_signed | implemented | `report.md` |
| contract_signed | evaluated | `score.md` and `evidence.json` for `evaluate-only` runs |
| contract_signed | completed | `summary.md` for `plan-only` runs |
| implemented | evaluated | `score.md` and `evidence.json` |
| evaluated | passed | every criterion at or above threshold and none `UNVERIFIED` |
| evaluated | failed | any criterion below threshold or `UNVERIFIED` |
| passed | completed | `summary.md` |
| failed | contract_drafted | next sprint initialized with `refine` or `pivot` |
| any active state | aborted | explicit user stop or unrecoverable contradiction |
| any active state | capped | sprint cap reached |
| capped | completed | `summary.md` |
| aborted | completed | `summary.md` |

## Mode-Specific Notes

### plan-only

- stop after `contract_signed`
- write `summary.md`
- move to `completed`

### evaluate-only

- controller may initialize directly to `contract_signed` if an existing contract or explicit acceptance criteria are already present
- evaluation still requires `score.md` and `evidence.json`

## Blocking Rules

The controller must block progression when:

- a required artefact is missing
- required frontmatter fields are absent
- the active profile rubric does not match contract dimensions
- contract signatures are missing
- evaluation evidence is missing
- a criterion is `UNVERIFIED`

## Repair Rules

If the run drifts into an inconsistent state:

1. inspect the latest artefacts on disk
2. repair `state.json`
3. resume from the last valid state

Do not guess that a step happened. If the artefact is missing, the state did not happen.
