# File Communication Layout

All role handoffs happen through run-scoped files. The controller should keep prompts short and pass paths, not long copied content.

## Layout

```text
<repo-root>/
|-- docs/
|   `-- gen-eval/
|       `-- <run-id>/
|           |-- spec.md
|           `-- summary.md
`-- .gen-eval/
    `-- <run-id>/
        |-- state.json
        |-- sprint-1/
        |   |-- contract.md
        |   |-- report.md
        |   |-- score.md
        |   |-- evidence.json
        |   `-- screenshots/
        `-- sprint-2/
            `-- ...
```

## Rules

1. `run_id` namespaces everything. Never write to a shared `docs/gen-eval/spec.md` path.
2. `docs/gen-eval/<run-id>/` is durable run history. Keep it in git unless the user explicitly wants a disposable run.
3. `.gen-eval/<run-id>/` is execution state and evaluator evidence. Ignore it by default in product repos unless the team wants audit artefacts committed.
4. Each sprint directory is append-only for the controller. Once a sprint is scored, treat it as history.
5. Large content belongs in files, not in prompts.
6. The next sprint reads the previous sprint's `score.md` and `evidence.json` before drafting a new contract.

## Minimum Artefacts Per State

- `spec_ready` -> `docs/gen-eval/<run-id>/spec.md`
- `contract_drafted` -> `.gen-eval/<run-id>/sprint-N/contract.md`
- `implemented` -> `.gen-eval/<run-id>/sprint-N/report.md`
- `evaluated` -> `.gen-eval/<run-id>/sprint-N/score.md` and `.gen-eval/<run-id>/sprint-N/evidence.json`
- `completed` -> `docs/gen-eval/<run-id>/summary.md`

## Resume Behavior

To resume a run:

1. read `.gen-eval/<run-id>/state.json`
2. confirm the latest sprint artefacts exist
3. continue from the latest valid state only

If `state.json` and the file tree disagree, trust the file tree and repair `state.json` before proceeding.

## Gate Validation Script

The controller must call `scripts/validate-gate.py` before advancing state at each gate.

```bash
# Gate A — after spec.md is written
python3 scripts/validate-gate.py --run-id <RUN_ID> --gate A

# Gate B — after ContractReviewer reports SIGNED
python3 scripts/validate-gate.py --run-id <RUN_ID> --gate B

# Gate C — after SprintEvaluator reports SCORED
python3 scripts/validate-gate.py --run-id <RUN_ID> --gate C

# Gate D — after summary.md is written
python3 scripts/validate-gate.py --run-id <RUN_ID> --gate D
```

Requires: Python 3.9+, `pyyaml` (`pip install pyyaml`).

The script enforces:
- artifact existence at each gate
- required YAML frontmatter fields
- both signatures on contracts (Gate B)
- no `UNVERIFIED` criteria (Gate C)
- no `manual_observation`-only evidence (Gate C)
- valid `final_verdict` values (Gate D)
