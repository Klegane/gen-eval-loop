# Artefact Schema

All run artefacts are human-readable first, but they still need predictable structure. Markdown artefacts use YAML frontmatter for required fields. Runtime state and evidence use JSON.

If a required field is missing, the controller must treat the artefact as invalid and block the next transition.

## Common Frontmatter Fields

Use these fields in every Markdown artefact where applicable:

```yaml
run_id: <run-id>
artifact: <spec|contract|report|score|summary>
quality_profile: <ui|backend|agentic|content>
execution_mode: <full-loop|plan-only|evaluate-only>
delivery_mode: <single-pass|short-sprint>
status: <artifact-specific status>
created_at: <ISO-8601 timestamp>
updated_at: <ISO-8601 timestamp>
```

## 1. Spec

Path:

```text
docs/gen-eval/<run-id>/spec.md
```

Required frontmatter:

```yaml
artifact: spec
git_mode: <commit-mode|workspace-mode>
model: <current model id>
```

Required sections:

1. Request
2. Vision
3. Primary user and success moment
4. Quality intent
5. Core functionality
6. Quality principles
7. Constraints
8. Success criteria
9. Explicit non-goals

## 2. Contract

Path:

```text
.gen-eval/<run-id>/sprint-N/contract.md
```

Required frontmatter:

```yaml
artifact: contract
sprint: <integer>
git_mode: <commit-mode|workspace-mode>
strategic_decision: <initial|refine|pivot>
negotiation_round: <integer>
generator_signed: <true|false>
evaluator_signed: <true|false>
```

Required sections:

1. Strategic decision
2. Scope
3. Out of scope
4. Criteria
5. Verification checklist
6. Known constraints
7. Signatures

## 3. Report

Path:

```text
.gen-eval/<run-id>/sprint-N/report.md
```

Required frontmatter:

```yaml
artifact: report
sprint: <integer>
status: <done|done_with_concerns|blocked|needs_context>
```

Required sections:

1. What I built
2. Self-check against contract
3. Change log
4. Known concerns
5. Files changed

## 4. Score

Path:

```text
.gen-eval/<run-id>/sprint-N/score.md
```

Required frontmatter:

```yaml
artifact: score
sprint: <integer>
evaluation_mode: <live|static-fallback|command-only>
verdict: <PASS|FAIL>
```

Required sections:

1. Verdict summary
2. Criteria table
3. Blocking findings
4. Non-blocking observations
5. Unverified claims

Each criterion row must include:

- criterion id
- rubric dimension
- score
- threshold
- status (`PASS`, `FAIL`, or `UNVERIFIED`)
- evidence reference

## 5. Summary

Path:

```text
docs/gen-eval/<run-id>/summary.md
```

Required frontmatter:

```yaml
artifact: summary
final_verdict: <PASS|FAIL|ABORTED|CAPPED>
total_sprints: <integer>
```

Required sections:

1. Request summary
2. Run configuration
3. Sprint history
4. Final verdict
5. Residual risks
6. Recommended next step

## 6. run.json

Path:

```text
.gen-eval/<run-id>/run.json
```

Required shape:

```json
{
  "runId": "coffee-roaster-homepage-20260422-1530",
  "status": "initialized",
  "executionMode": "full-loop",
  "qualityProfile": "ui",
  "deliveryMode": "single-pass",
  "gitMode": "commit-mode",
  "model": "claude-opus-4-7",
  "playwrightAvailable": true,
  "currentSprint": 0,
  "lastCompletedState": "initialized",
  "sprints": []
}
```

`status` must come from the state machine in [state-machine.md](state-machine.md).

## 7. evidence.json

Path:

```text
.gen-eval/<run-id>/sprint-N/evidence.json
```

Required shape:

```json
{
  "runId": "coffee-roaster-homepage-20260422-1530",
  "sprint": 1,
  "evaluationMode": "live",
  "criteria": [
    {
      "criterionId": "hero-identity",
      "status": "PASS",
      "evidence": [
        {
          "type": "screenshot",
          "path": ".gen-eval/coffee-roaster-homepage-20260422-1530/sprint-1/screenshots/hero.png",
          "note": "Distinct type and palette match the spec"
        }
      ]
    }
  ],
  "infraFailures": []
}
```

## Objective evidence types

These may be used alone or in combination:

- `screenshot`
- `console_check`
- `selector_assertion`
- `http_check`
- `db_check`
- `log_extract`
- `command_output`
- `git_diff_review`

## Restricted evidence type

- `manual_observation` — **only valid when paired with at least one objective evidence type above**. A criterion whose entire evidence list is `manual_observation` items will be rejected by the gate validator as `UNVERIFIED`. Use this type to add context to objective evidence, not to replace it.

Every scored criterion needs at least one evidence item. No evidence means no PASS.
