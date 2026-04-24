# gen-eval-loop Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the gen-eval-loop plugin against its five identified structural failure modes: LLM-based gate enforcement, Evaluator role fusion, `manual_observation` loophole, soft Playwright dependency, and same-model Generator/Evaluator.

**Architecture:** Six targeted changes across prompts, schema files, and a new Python validation script. The script becomes the authoritative gate enforcer; the LLM controller calls it via Bash before every state transition instead of self-checking. Evaluator roles are split into two separate prompt files. `manual_observation`-only evidence is rejected at Gate C by the script.

**Tech Stack:** Markdown (skill/command files), Python 3.9+ (validation script), YAML frontmatter (artifact metadata), JSON (state, evidence, schemas)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| CREATE | `scripts/validate-gate.py` | Deterministic FSM enforcer — called by controller via Bash |
| CREATE | `skills/gen-eval-loop/contract-reviewer-prompt.md` | Evaluator role: contract review only (Gate B) |
| CREATE | `skills/gen-eval-loop/sprint-evaluator-prompt.md` | Evaluator role: scoring only (Gate C) |
| MODIFY | `skills/gen-eval-loop/evaluator-prompt.md` | Deprecate dual-mode; redirect to the two new files |
| MODIFY | `skills/gen-eval-loop/artifact-schema.md` | Fix `decision` → `strategic_decision`; restrict `manual_observation` |
| MODIFY | `skills/gen-eval-loop/sprint-contract-template.md` | Fix `decision` → `strategic_decision` in frontmatter |
| MODIFY | `skills/gen-eval-loop/model-adaptation.md` | Add Evaluator model recommendation section |
| MODIFY | `skills/gen-eval-loop/SKILL.md` | Update role definitions; reference new prompt files |
| MODIFY | `commands/gen-eval.md` | Hard Playwright gate for UI; script calls before each gate; two Evaluator roles |

---

## Task 1: Fix `decision` vs `strategic_decision` schema inconsistency

**Context:** `artifact-schema.md` uses `strategic_decision` in the contract frontmatter spec, but `sprint-contract-template.md` uses `decision`. The validate script in Task 6 will reject contracts where the field name is wrong, so fix the source of truth first.

**Files:**
- Modify: `skills/gen-eval-loop/sprint-contract-template.md:14`
- Modify: `skills/gen-eval-loop/artifact-schema.md:65`

- [ ] **Step 1: Confirm the inconsistency**

```bash
grep -n "strategic_decision\|^decision:" \
  /Users/erikmuniain/Projects/gen-eval-loop/skills/gen-eval-loop/artifact-schema.md \
  /Users/erikmuniain/Projects/gen-eval-loop/skills/gen-eval-loop/sprint-contract-template.md \
  /Users/erikmuniain/Projects/gen-eval-loop/skills/gen-eval-loop/generator-prompt.md
```

Expected output: `artifact-schema.md` and `generator-prompt.md` use `strategic_decision`; `sprint-contract-template.md` uses bare `decision:`.

- [ ] **Step 2: Fix sprint-contract-template.md frontmatter**

In [skills/gen-eval-loop/sprint-contract-template.md](skills/gen-eval-loop/sprint-contract-template.md), find:

```yaml
decision: initial
```

Replace with:

```yaml
strategic_decision: initial
```

- [ ] **Step 3: Verify no other stale `^decision:` in skill files**

```bash
grep -rn "^decision:" /Users/erikmuniain/Projects/gen-eval-loop/skills/
```

Expected: no output. If any remain, fix them to `strategic_decision:`.

- [ ] **Step 4: Commit**

```bash
git add skills/gen-eval-loop/sprint-contract-template.md
git commit -m "fix: unify contract frontmatter field to strategic_decision"
```

---

## Task 2: Harden `manual_observation` evidence type

**Context:** `manual_observation` is listed as a first-class evidence type in `artifact-schema.md`. An Evaluator can satisfy Gate C entirely with self-generated observations, defeating the purpose of independent evaluation. The fix: demote it to a restricted fallback that is only valid when paired with at least one objective evidence type, and document that restriction clearly.

**Files:**
- Modify: `skills/gen-eval-loop/artifact-schema.md`

- [ ] **Step 1: Update the evidence type section in artifact-schema.md**

Find the `Allowed evidence types` list in [skills/gen-eval-loop/artifact-schema.md](skills/gen-eval-loop/artifact-schema.md):

```
Allowed evidence types:

- `screenshot`
- `console_check`
- `selector_assertion`
- `http_check`
- `db_check`
- `log_extract`
- `command_output`
- `git_diff_review`
- `manual_observation`
```

Replace with:

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
```

- [ ] **Step 2: Add the restriction to the Gate C definition in SKILL.md**

In [skills/gen-eval-loop/SKILL.md](skills/gen-eval-loop/SKILL.md), find the Gate C block:

```
### Gate C - Evaluation gate

Do not accept PASS unless:

- `score.md` exists
- `evidence.json` exists
- every criterion has evidence
- no criterion is `UNVERIFIED`
- every criterion is at or above threshold
```

Replace with:

```
### Gate C - Evaluation gate

Do not accept PASS unless:

- `score.md` exists
- `evidence.json` exists
- every criterion has at least one objective evidence item (not `manual_observation` alone)
- no criterion is `UNVERIFIED`
- every criterion is at or above threshold

`manual_observation` is only valid as supplementary context alongside objective evidence.
The gate validator (Task 6) enforces this programmatically.
```

- [ ] **Step 3: Commit**

```bash
git add skills/gen-eval-loop/artifact-schema.md skills/gen-eval-loop/SKILL.md
git commit -m "fix: demote manual_observation to restricted supplementary evidence type"
```

---

## Task 3: Make Playwright a hard dependency for the UI profile

**Context:** [gen-eval.md:48](commands/gen-eval.md#L48) currently warns once and continues if Playwright MCP is missing when profile is `ui`. This produces runs that reach `CAPPED` without any real evaluation. The UI profile rubric's top evidence types (`screenshot`, `selector_assertion`, `console_check`) all require a browser. Without them, every UI criterion becomes `UNVERIFIED` and the run fails anyway — but only after wasting N sprint cycles.

**Files:**
- Modify: `commands/gen-eval.md`
- Modify: `skills/gen-eval-loop/profiles/ui/rubric.md`

- [ ] **Step 1: Replace the soft Playwright check in gen-eval.md**

In [commands/gen-eval.md](commands/gen-eval.md), find the Step 2 Precondition checks section:

```markdown
## Step 2 - Precondition checks

- If the active profile is `ui`, verify Playwright MCP tools (`mcp__playwright__*`) are available before dispatching the Planner.
- If Playwright is missing, warn the user once that any live-only UI criterion will remain `UNVERIFIED`, which causes the sprint to fail unless the contract uses static-only checks.
- If git is unavailable or the workspace policy makes commits inappropriate, set `git_mode` to `workspace-mode` and record that limitation in `state.json`.
```

Replace with:

```markdown
## Step 2 - Precondition checks

### UI profile — Playwright hard dependency

If the active profile is `ui`, verify that Playwright MCP tools (`mcp__playwright__*`) are available **before dispatching the Planner**.

If Playwright is unavailable:
1. Do NOT initialize the run.
2. Stop and tell the user:

   > "The `ui` quality profile requires Playwright MCP for browser evaluation. Playwright MCP tools (`mcp__playwright__*`) are not available in this session. Options:
   > - Start Claude Code with Playwright MCP configured and retry.
   > - Switch to the `backend` or `content` profile if visual quality is not the primary concern.
   > The run cannot proceed without Playwright for UI evaluation."

3. Set `state.json` to `aborted` if it was already initialized, then stop.

There is no degraded mode for the UI profile. Static-only evaluation defeats the purpose of UI quality gating.

### Git mode detection

If git is unavailable or the workspace policy makes commits inappropriate, set `git_mode` to `workspace-mode` and record that limitation in `state.json`.
```

- [ ] **Step 2: Document the hard dependency in the UI rubric**

At the top of [skills/gen-eval-loop/profiles/ui/rubric.md](skills/gen-eval-loop/profiles/ui/rubric.md), after the default threshold line, add:

```markdown
## Hard dependency

This profile requires Playwright MCP (`mcp__playwright__*`) for evaluation. The controller must verify availability before run initialization. Runs on this profile cannot proceed without a live browser evaluation tool. There is no static fallback mode.
```

- [ ] **Step 3: Commit**

```bash
git add commands/gen-eval.md skills/gen-eval-loop/profiles/ui/rubric.md
git commit -m "fix: make Playwright a hard dependency for UI profile, no degraded mode"
```

---

## Task 4: Split Evaluator into ContractReviewer and SprintEvaluator

**Context:** [evaluator-prompt.md](skills/gen-eval-loop/evaluator-prompt.md) currently runs as a dual-mode agent (`REVIEW_CONTRACT` / `SCORE`). Crucially, line 149 says the same subagent instance should do both. This means the agent that approved the contract's criteria is the same one measuring the implementation against them — a structural confirmation bias. The fix: two separate prompt files, two separate subagent dispatches, zero shared session state between them.

**Files:**
- Create: `skills/gen-eval-loop/contract-reviewer-prompt.md`
- Create: `skills/gen-eval-loop/sprint-evaluator-prompt.md`
- Modify: `skills/gen-eval-loop/evaluator-prompt.md` (deprecation notice)
- Modify: `skills/gen-eval-loop/SKILL.md`
- Modify: `commands/gen-eval.md`

- [ ] **Step 1: Create contract-reviewer-prompt.md**

Create [skills/gen-eval-loop/contract-reviewer-prompt.md](skills/gen-eval-loop/contract-reviewer-prompt.md) with this content:

```markdown
# Contract Reviewer Prompt Template

The ContractReviewer runs at Gate B. It has one job: validate the contract before implementation begins. It never sees the implementation and never scores a sprint.

Dispatch a fresh subagent each sprint. Do NOT reuse the ContractReviewer session for sprint scoring.

```text
Task tool:
  description: "ContractReviewer: [RUN_ID] sprint [N]"
  prompt: |
    You are the ContractReviewer in an AI quality system.

    Your ONLY job is to validate the draft sprint contract before implementation begins.
    You do not see the implementation. You do not score the sprint.
    A separate SprintEvaluator will handle scoring after implementation.

    ## Inputs
    - Spec: docs/gen-eval/[RUN_ID]/spec.md
    - Contract: .gen-eval/[RUN_ID]/sprint-[N]/contract.md
    - Active rubric: skills/gen-eval-loop/profiles/[PROFILE]/rubric.md
    - Artefact schema: skills/gen-eval-loop/artifact-schema.md
    - State: .gen-eval/[RUN_ID]/state.json

    ## Validation checklist

    Check every item. Fail on the first violation and report it specifically.

    1. Frontmatter completeness:
       - `run_id`, `artifact`, `sprint`, `strategic_decision`, `negotiation_round`,
         `generator_signed`, `evaluator_signed` are all present.
       - `artifact` equals `contract`.
       - `generator_signed` equals `true`.
       - `evaluator_signed` equals `false` (you will set it if valid).

    2. Scope:
       - `Scope` section is non-empty.
       - `Out of scope` section is non-empty.
       - Scope items describe user-visible outcomes, not implementation details.

    3. Criteria:
       - Every criterion maps to a valid dimension in the active profile rubric.
       - Every criterion has a threshold at or above the profile default.
       - Every criterion names at least one **objective** evidence type
         (not `manual_observation` alone — see artifact-schema.md).
       - Every criterion has a concrete, replayable verification method.

    4. Verification checklist:
       - Start command is specified.
       - Target URLs or endpoints are specified.
       - Assertions are specific enough to reproduce.

    5. Known constraints section is present (may be empty but must exist).

    ## If valid

    - Sign the Evaluator line in the body: `- Evaluator: [ContractReviewer — SIGNED]`
    - Set `evaluator_signed: true` in frontmatter.
    - Set `status: signed` in frontmatter.
    - Report `SIGNED`.

    ## If invalid

    - Do NOT sign.
    - Report `CHANGES_REQUESTED`.
    - List each failing item with the exact fix required (not suggestions — requirements).

    ## Final report format
    Status: SIGNED | CHANGES_REQUESTED
    Issues (if CHANGES_REQUESTED):
    - [exact required fix]
```

## Controller Notes

- Dispatch one ContractReviewer per negotiation round.
- NEVER reuse the ContractReviewer for sprint scoring. That is the SprintEvaluator's job.
- After 3 rounds of CHANGES_REQUESTED, escalate to the user instead of continuing negotiation.
```

- [ ] **Step 2: Create sprint-evaluator-prompt.md**

Create [skills/gen-eval-loop/sprint-evaluator-prompt.md](skills/gen-eval-loop/sprint-evaluator-prompt.md) with this content:

```markdown
# Sprint Evaluator Prompt Template

The SprintEvaluator runs at Gate C. It scores the finished implementation. It never reviewed the contract and has no prior attachment to the criteria it is measuring.

Dispatch a fresh subagent each sprint. Do NOT reuse a ContractReviewer session for this role.

```text
Task tool:
  description: "SprintEvaluator: [RUN_ID] sprint [N]"
  prompt: |
    You are the SprintEvaluator in an AI quality system.

    Assume the Generator's work does NOT deserve PASS until you can prove otherwise with evidence.
    You did not review the contract. You have no prior attachment to the criteria.
    Your job is to determine what the implementation actually does and score it against the signed contract.

    ## Inputs
    - Spec: docs/gen-eval/[RUN_ID]/spec.md
    - Signed contract: .gen-eval/[RUN_ID]/sprint-[N]/contract.md
    - Active rubric: skills/gen-eval-loop/profiles/[PROFILE]/rubric.md
    - Artefact schema: skills/gen-eval-loop/artifact-schema.md
    - Generator report: .gen-eval/[RUN_ID]/sprint-[N]/report.md
    - State: .gen-eval/[RUN_ID]/state.json

    ## Step 1 — Review implementation scope

    - If git mode is `commit-mode`, inspect the sprint commits and compare to contract scope.
    - If git mode is `workspace-mode`, inspect changed files and record that limitation.
    - Note any out-of-scope work or missing scope items.

    ## Step 2 — Run the verification checklist

    Execute the contract's verification checklist exactly as written.

    If the profile is `ui`:
    - Use Playwright MCP for browser interaction (required, not optional).
    - Capture screenshots to `.gen-eval/[RUN_ID]/sprint-[N]/screenshots/`.
    - Record console errors.
    - Interact with flows — do not just assert visibility.

    If the profile is `backend`:
    - Hit endpoints, inspect outputs, verify state, and review logs.

    If the profile is `agentic`:
    - Replay the task flow, inspect tool use, and check failure handling.

    If the profile is `content`:
    - Verify claims, structure, specificity, and factual grounding with explicit evidence.

    If a required verification tool is unavailable:
    - Mark the affected criterion `UNVERIFIED`.
    - Record why in `evidence.json`.
    - The sprint FAILS if any criterion is `UNVERIFIED`.

    ## Step 3 — Score against the active rubric

    - Score every criterion 0-10.
    - Use the active profile's dimensions only.
    - Cite evidence for every score. A score without evidence is invalid.

    ## Step 4 — Evidence rules

    `manual_observation` is only valid alongside at least one objective evidence type.
    A criterion with only `manual_observation` evidence must be marked `UNVERIFIED`.

    ## Step 5 — Write score.md

    Path: `.gen-eval/[RUN_ID]/sprint-[N]/score.md`

    Required frontmatter:
    ```yaml
    artifact: score
    sprint: [N]
    evaluation_mode: [live | static-fallback | command-only]
    verdict: [PASS | FAIL]
    ```

    Required sections:
    1. Verdict summary
    2. Criteria table (criterion id, dimension, score, threshold, status, evidence reference)
    3. Blocking findings
    4. Non-blocking observations
    5. Unverified claims

    ## Step 6 — Write evidence.json

    Path: `.gen-eval/[RUN_ID]/sprint-[N]/evidence.json`

    Every scored criterion needs at least one objective evidence item.

    ## Discipline

    - Do not invent evidence.
    - Do not score from the wrong profile.
    - Do not soften a failure because the Generator tried hard.
    - If the system cannot be evaluated as contracted, that is a sprint failure.

    ## Final report format
    Status: SCORED
    Verdict: PASS | FAIL
    Score path: .gen-eval/[RUN_ID]/sprint-[N]/score.md
    Evidence path: .gen-eval/[RUN_ID]/sprint-[N]/evidence.json
```

## Controller Notes

- Fresh SprintEvaluator session per sprint.
- Never use the same session that reviewed the contract.
- PASS requires both `score.md` and `evidence.json` with no `UNVERIFIED` criteria.
```

- [ ] **Step 3: Deprecate evaluator-prompt.md**

Replace the entire content of [skills/gen-eval-loop/evaluator-prompt.md](skills/gen-eval-loop/evaluator-prompt.md) with:

```markdown
# Evaluator Prompt Template — DEPRECATED

This file is kept for reference only. Do not use it to dispatch subagents.

The Evaluator role has been split into two independent roles:

- **Gate B (contract review):** use `contract-reviewer-prompt.md`
- **Gate C (sprint scoring):** use `sprint-evaluator-prompt.md`

The roles must run in separate subagent sessions. The ContractReviewer must never score a sprint.
```

- [ ] **Step 4: Update SKILL.md role definitions**

In [skills/gen-eval-loop/SKILL.md](skills/gen-eval-loop/SKILL.md), find the `### Evaluator` section:

```markdown
### Evaluator

- reviews contract quality before implementation
- scores the finished sprint against the active profile rubric
- writes `score.md` and `evidence.json`
- is skeptical by default
```

Replace with:

```markdown
### ContractReviewer

- validates the draft contract before implementation begins (Gate B only)
- never sees the implementation
- never scores a sprint
- uses `contract-reviewer-prompt.md`

### SprintEvaluator

- scores the finished implementation against the signed contract (Gate C only)
- runs in a fresh session with no memory of the ContractReviewer session
- writes `score.md` and `evidence.json`
- is skeptical by default: assumes FAIL until evidence proves otherwise
- uses `sprint-evaluator-prompt.md`
```

Also update the `## Files To Load` section. Find:

```markdown
6. the relevant prompt template:
   - [planner-prompt.md](planner-prompt.md)
   - [generator-prompt.md](generator-prompt.md)
   - [evaluator-prompt.md](evaluator-prompt.md)
```

Replace with:

```markdown
6. the relevant prompt template:
   - [planner-prompt.md](planner-prompt.md)
   - [generator-prompt.md](generator-prompt.md)
   - [contract-reviewer-prompt.md](contract-reviewer-prompt.md) — Gate B
   - [sprint-evaluator-prompt.md](sprint-evaluator-prompt.md) — Gate C
```

- [ ] **Step 5: Update gen-eval.md to use the two distinct roles**

In [commands/gen-eval.md](commands/gen-eval.md), find Step 4 Contract gate:

```markdown
## Step 4 - Contract gate

For each sprint:

1. Dispatch Generator in `DRAFT_CONTRACT`.
2. Dispatch Evaluator in `REVIEW_CONTRACT`.
3. If the Evaluator requests changes, the Generator revises and resubmits.
```

Replace with:

```markdown
## Step 4 - Contract gate

For each sprint:

1. Dispatch Generator in `DRAFT_CONTRACT`.
2. Dispatch **ContractReviewer** (using `contract-reviewer-prompt.md`) for this sprint's contract.
3. If ContractReviewer reports `CHANGES_REQUESTED`, the Generator revises and resubmits.
4. ContractReviewer must be a **fresh subagent each negotiation round** — never reuse its session.
```

Find Step 6 Evaluation gate:

```markdown
## Step 6 - Evaluation gate

Dispatch Evaluator in `SCORE`.
```

Replace with:

```markdown
## Step 6 - Evaluation gate

Dispatch **SprintEvaluator** (using `sprint-evaluator-prompt.md`) in a **fresh subagent session**.

This must NOT be the same session used for contract review in Step 4. A SprintEvaluator has no memory of the ContractReviewer session.
```

- [ ] **Step 6: Commit**

```bash
git add \
  skills/gen-eval-loop/contract-reviewer-prompt.md \
  skills/gen-eval-loop/sprint-evaluator-prompt.md \
  skills/gen-eval-loop/evaluator-prompt.md \
  skills/gen-eval-loop/SKILL.md \
  commands/gen-eval.md
git commit -m "feat: split Evaluator into ContractReviewer (Gate B) and SprintEvaluator (Gate C)"
```

---

## Task 5: Add Evaluator model differentiation

**Context:** Generator and Evaluator share the same model family and training priors. The bias is structural. The mitigation: `model-adaptation.md` should recommend dispatching the SprintEvaluator with a more capable model than the Generator when both are available (e.g., Generator = Sonnet, Evaluator = Opus). The controller passes this recommendation in the subagent prompt.

**Files:**
- Modify: `skills/gen-eval-loop/model-adaptation.md`
- Modify: `commands/gen-eval.md`

- [ ] **Step 1: Add Evaluator model recommendation to model-adaptation.md**

In [skills/gen-eval-loop/model-adaptation.md](skills/gen-eval-loop/model-adaptation.md), at the end of the file, add:

```markdown
## Evaluator Model Recommendation

The SprintEvaluator should run on a **more capable model than the Generator** when the environment allows it.

Recommended pairings (Generator → SprintEvaluator):

| Generator model | Recommended SprintEvaluator model |
|-----------------|-----------------------------------|
| `claude-sonnet-*` | `claude-opus-*` |
| `claude-haiku-*` | `claude-sonnet-*` or `claude-opus-*` |
| `claude-opus-*` | `claude-opus-*` (same, no upgrade available) |

The ContractReviewer may use the same model as the Generator — its job is structural validation, not quality judgment.

If the environment does not allow model selection per subagent, document this limitation in `state.json` under `evaluatorModelNote` and proceed with the available model. Do not skip evaluation.

Record the chosen evaluator model in `state.json`:

```json
"evaluatorModel": "claude-opus-4-7"
```
```

- [ ] **Step 2: Update gen-eval.md to document the model choice in Step 1**

In [commands/gen-eval.md](commands/gen-eval.md), find Step 1 Initialize the run — the numbered list. After item 4 (detecting model and delivery_mode), add:

```markdown
5. Choose the `evaluator_model`:
   - If the active model is `claude-sonnet-*`, prefer `claude-opus-*` for the SprintEvaluator.
   - If no upgrade is available, use the same model and record `evaluatorModelNote: "same model — upgrade unavailable"` in `state.json`.
   - Record `evaluatorModel` in `state.json`.
```

Update the state.json Required shape in artifact-schema.md to include the new field. Find the `state.json` Required shape block and add:

```json
"evaluatorModel": "claude-opus-4-7",
"evaluatorModelNote": ""
```

- [ ] **Step 3: Wire evaluator model into SprintEvaluator dispatch in gen-eval.md**

In Step 6 of [commands/gen-eval.md](commands/gen-eval.md), after the SprintEvaluator dispatch instruction, add:

```markdown
When dispatching the SprintEvaluator subagent, include in the prompt:

> Preferred model for this subagent: [evaluatorModel from state.json]

Note: subagent model selection is environment-dependent. If the environment does not support per-subagent model override, log this in evidence.json under `notes`.
```

- [ ] **Step 4: Commit**

```bash
git add skills/gen-eval-loop/model-adaptation.md skills/gen-eval-loop/artifact-schema.md commands/gen-eval.md
git commit -m "feat: recommend Opus for SprintEvaluator to reduce same-model bias"
```

---

## Task 6: Create the deterministic gate validation script

**Context:** This is the most impactful change. A Python script replaces the LLM's self-reporting as the gate enforcer. The controller calls it via Bash before each state transition. If the script exits non-zero, the controller must not advance the state. The script validates artifact existence, YAML frontmatter fields, signature presence, and the `manual_observation` restriction.

**Files:**
- Create: `scripts/validate-gate.py`

- [ ] **Step 1: Create scripts/ directory and validate-gate.py**

```bash
mkdir -p /Users/erikmuniain/Projects/gen-eval-loop/scripts
```

Create [scripts/validate-gate.py](scripts/validate-gate.py) with this content:

```python
#!/usr/bin/env python3
"""
gen-eval-loop gate validator.

Usage:
  python scripts/validate-gate.py --run-id <id> --gate <A|B|C|D> [--repo-root <path>]

Exit codes:
  0  gate passes
  1  gate fails (reason printed to stderr)
  2  usage error
"""
import argparse
import json
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    print("ERROR: PyYAML required. Run: pip install pyyaml", file=sys.stderr)
    sys.exit(2)

OBJECTIVE_EVIDENCE_TYPES = {
    "screenshot", "console_check", "selector_assertion",
    "http_check", "db_check", "log_extract", "command_output", "git_diff_review"
}

VALID_STATUSES = {
    "initialized", "spec_ready", "contract_drafted", "contract_signed",
    "implemented", "evaluated", "passed", "failed", "aborted", "capped", "completed"
}


def fail(msg: str) -> None:
    print(f"GATE FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


def read_state(repo_root: Path, run_id: str) -> dict:
    path = repo_root / ".gen-eval" / run_id / "state.json"
    if not path.exists():
        fail(f"state.json not found: {path}")
    with open(path) as f:
        return json.load(f)


def read_frontmatter(path: Path) -> dict:
    content = path.read_text(encoding="utf-8")
    if not content.startswith("---"):
        return {}
    try:
        end = content.index("---", 3)
    except ValueError:
        return {}
    return yaml.safe_load(content[3:end]) or {}


def check_fields(frontmatter: dict, required: list[str], label: str) -> None:
    for field in required:
        if field not in frontmatter:
            fail(f"{label}: missing frontmatter field '{field}'")


def validate_gate_a(repo_root: Path, run_id: str, _state: dict) -> None:
    """Gate A — Spec gate: spec.md must exist with required frontmatter."""
    spec_path = repo_root / "docs" / "gen-eval" / run_id / "spec.md"
    if not spec_path.exists():
        fail(f"Gate A: spec.md not found at {spec_path}")

    fm = read_frontmatter(spec_path)
    check_fields(fm, [
        "run_id", "artifact", "quality_profile",
        "execution_mode", "delivery_mode", "git_mode", "status", "model"
    ], "Gate A spec.md")

    if fm.get("artifact") != "spec":
        fail(f"Gate A: spec.md frontmatter 'artifact' must be 'spec', got '{fm.get('artifact')}'")
    if fm.get("run_id") != run_id:
        fail(f"Gate A: spec.md run_id '{fm.get('run_id')}' does not match run '{run_id}'")

    print("Gate A: PASS")


def validate_gate_b(repo_root: Path, run_id: str, state: dict) -> None:
    """Gate B — Contract gate: contract.md must exist with both signatures."""
    sprint = state.get("currentSprint", 1)
    contract_path = repo_root / ".gen-eval" / run_id / f"sprint-{sprint}" / "contract.md"
    if not contract_path.exists():
        fail(f"Gate B: contract.md not found at {contract_path}")

    fm = read_frontmatter(contract_path)
    check_fields(fm, [
        "run_id", "artifact", "sprint", "strategic_decision",
        "negotiation_round", "generator_signed", "evaluator_signed"
    ], "Gate B contract.md")

    if fm.get("artifact") != "contract":
        fail(f"Gate B: contract.md 'artifact' must be 'contract', got '{fm.get('artifact')}'")
    if fm.get("run_id") != run_id:
        fail(f"Gate B: contract.md run_id '{fm.get('run_id')}' does not match run '{run_id}'")
    if fm.get("sprint") != sprint:
        fail(f"Gate B: contract.md sprint {fm.get('sprint')} does not match current sprint {sprint}")
    if not fm.get("generator_signed"):
        fail("Gate B: contract.md generator_signed is not true — Generator has not signed")
    if not fm.get("evaluator_signed"):
        fail("Gate B: contract.md evaluator_signed is not true — ContractReviewer has not signed")
    if fm.get("strategic_decision") not in ("initial", "refine", "pivot"):
        fail(f"Gate B: strategic_decision must be initial|refine|pivot, got '{fm.get('strategic_decision')}'")

    print("Gate B: PASS")


def validate_gate_c(repo_root: Path, run_id: str, state: dict) -> None:
    """Gate C — Evaluation gate: score.md and evidence.json with no UNVERIFIED criteria."""
    sprint = state.get("currentSprint", 1)
    base = repo_root / ".gen-eval" / run_id / f"sprint-{sprint}"

    score_path = base / "score.md"
    evidence_path = base / "evidence.json"

    if not score_path.exists():
        fail(f"Gate C: score.md not found at {score_path}")
    if not evidence_path.exists():
        fail(f"Gate C: evidence.json not found at {evidence_path}")

    fm = read_frontmatter(score_path)
    check_fields(fm, ["artifact", "sprint", "evaluation_mode", "verdict"], "Gate C score.md")
    if fm.get("artifact") != "score":
        fail(f"Gate C: score.md 'artifact' must be 'score', got '{fm.get('artifact')}'")
    if fm.get("verdict") not in ("PASS", "FAIL"):
        fail(f"Gate C: score.md verdict must be PASS or FAIL, got '{fm.get('verdict')}'")

    with open(evidence_path, encoding="utf-8") as f:
        evidence = json.load(f)

    criteria = evidence.get("criteria", [])
    if not criteria:
        fail("Gate C: evidence.json has no criteria — evaluation is empty")

    for criterion in criteria:
        cid = criterion.get("criterionId", "<unknown>")
        status = criterion.get("status")

        if status == "UNVERIFIED":
            fail(f"Gate C: criterion '{cid}' is UNVERIFIED — sprint cannot PASS")

        ev_list = criterion.get("evidence", [])
        if not ev_list:
            fail(f"Gate C: criterion '{cid}' has no evidence items")

        ev_types = {item.get("type") for item in ev_list}
        has_objective = bool(ev_types & OBJECTIVE_EVIDENCE_TYPES)
        if not has_objective:
            fail(
                f"Gate C: criterion '{cid}' has only 'manual_observation' evidence. "
                "At least one objective evidence type is required. "
                "Mark the criterion UNVERIFIED if objective evidence cannot be obtained."
            )

    print("Gate C: PASS")


def validate_gate_d(repo_root: Path, run_id: str, _state: dict) -> None:
    """Gate D — Finalization gate: summary.md must exist with required fields."""
    summary_path = repo_root / "docs" / "gen-eval" / run_id / "summary.md"
    if not summary_path.exists():
        fail(f"Gate D: summary.md not found at {summary_path}")

    fm = read_frontmatter(summary_path)
    check_fields(fm, ["artifact", "final_verdict", "total_sprints"], "Gate D summary.md")
    if fm.get("artifact") != "summary":
        fail(f"Gate D: summary.md 'artifact' must be 'summary', got '{fm.get('artifact')}'")
    if fm.get("final_verdict") not in ("PASS", "FAIL", "ABORTED", "CAPPED"):
        fail(f"Gate D: final_verdict must be PASS|FAIL|ABORTED|CAPPED, got '{fm.get('final_verdict')}'")

    print("Gate D: PASS")


def main() -> None:
    parser = argparse.ArgumentParser(description="gen-eval-loop gate validator")
    parser.add_argument("--run-id", required=True, help="Run ID (e.g. my-app-20260423-1530)")
    parser.add_argument("--gate", required=True, choices=["A", "B", "C", "D"], help="Gate to validate")
    parser.add_argument("--repo-root", default=".", help="Repository root (default: current directory)")
    args = parser.parse_args()

    repo_root = Path(args.repo_root).resolve()
    state = read_state(repo_root, args.run_id)

    gates = {
        "A": validate_gate_a,
        "B": validate_gate_b,
        "C": validate_gate_c,
        "D": validate_gate_d,
    }
    gates[args.gate](repo_root, args.run_id, state)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Verify the script is syntactically valid**

```bash
cd /Users/erikmuniain/Projects/gen-eval-loop && python3 -m py_compile scripts/validate-gate.py && echo "Syntax OK"
```

Expected: `Syntax OK`

- [ ] **Step 3: Smoke-test Gate A with a missing spec**

```bash
cd /Users/erikmuniain/Projects/gen-eval-loop && \
  mkdir -p .gen-eval/smoke-test && \
  echo '{"runId":"smoke-test","status":"initialized","currentSprint":1}' > .gen-eval/smoke-test/state.json && \
  python3 scripts/validate-gate.py --run-id smoke-test --gate A 2>&1 || true
```

Expected output contains: `GATE FAIL: Gate A: spec.md not found`

- [ ] **Step 4: Smoke-test Gate C with manual_observation-only evidence**

```bash
cd /Users/erikmuniain/Projects/gen-eval-loop && \
  mkdir -p .gen-eval/smoke-test/sprint-1/screenshots && \
  cat > .gen-eval/smoke-test/sprint-1/score.md << 'EOF'
---
artifact: score
sprint: 1
evaluation_mode: static-fallback
verdict: PASS
---
EOF
  cat > .gen-eval/smoke-test/sprint-1/evidence.json << 'EOF'
{
  "runId": "smoke-test",
  "sprint": 1,
  "criteria": [
    {
      "criterionId": "hero",
      "status": "PASS",
      "evidence": [{"type": "manual_observation", "note": "looks fine"}]
    }
  ]
}
EOF
  python3 scripts/validate-gate.py --run-id smoke-test --gate C 2>&1 || true
```

Expected output contains: `GATE FAIL: criterion 'hero' has only 'manual_observation' evidence`

- [ ] **Step 5: Clean up smoke-test artifacts**

```bash
rm -rf /Users/erikmuniain/Projects/gen-eval-loop/.gen-eval/smoke-test
```

- [ ] **Step 6: Commit the script**

```bash
git add scripts/validate-gate.py
git commit -m "feat: add deterministic gate validator script (validate-gate.py)"
```

---

## Task 7: Wire the validation script into the controller

**Context:** The controller in `gen-eval.md` currently self-checks gate conditions via prompt instructions. Now that the script exists, the controller calls it via Bash before advancing state. If the script exits non-zero, the controller must stop and report the failure verbatim to the user. This replaces the LLM's soft "I verified the gate" with a hard binary check.

**Files:**
- Modify: `commands/gen-eval.md`
- Modify: `skills/gen-eval-loop/file-communication-layout.md`

- [ ] **Step 1: Add the gate validation call pattern to gen-eval.md**

In [commands/gen-eval.md](commands/gen-eval.md), at the beginning of the `## Step 3 - Planner` section, add a new block before step 3 (between step 2 and step 3):

```markdown
## Gate validation — how to call the validator

Before advancing state at any gate, run the validator via Bash:

```bash
python3 scripts/validate-gate.py --run-id <RUN_ID> --gate <A|B|C|D>
```

If the command exits with a non-zero code:
1. Do NOT advance `state.json`.
2. Report the exact error message to the user verbatim.
3. Resolve the blocking issue before retrying.

If `pyyaml` is not installed in the environment:
```bash
pip install pyyaml --quiet
```
Then retry the validator.
```

- [ ] **Step 2: Wire Gate A call into gen-eval.md Step 3**

In Step 3 of [commands/gen-eval.md](commands/gen-eval.md), after "Read the spec yourself before continuing", add:

```markdown
After reading the spec, run Gate A validation:

```bash
python3 scripts/validate-gate.py --run-id <RUN_ID> --gate A
```

Do not dispatch the Generator until Gate A exits 0.
```

- [ ] **Step 3: Wire Gate B call into gen-eval.md Step 4**

In Step 4, after the contract negotiation block and before "Do not proceed until:", add:

```markdown
After the ContractReviewer reports `SIGNED`, run Gate B validation:

```bash
python3 scripts/validate-gate.py --run-id <RUN_ID> --gate B
```

The script is the authoritative gate check. Do not advance to `contract_signed` until Gate B exits 0.
```

- [ ] **Step 4: Wire Gate C call into gen-eval.md Step 6**

In Step 6, after "The Evaluator must produce", add:

```markdown
After the SprintEvaluator reports `SCORED`, run Gate C validation:

```bash
python3 scripts/validate-gate.py --run-id <RUN_ID> --gate C
```

Do not accept PASS or FAIL from the SprintEvaluator until Gate C exits 0. The script is the authoritative check; the SprintEvaluator's self-reported verdict is advisory only.
```

- [ ] **Step 5: Wire Gate D call into gen-eval.md Step 8**

In Step 8 Finalization, after "Every run ends with `docs/gen-eval/<run-id>/summary.md`", add:

```markdown
After writing `summary.md`, run Gate D validation:

```bash
python3 scripts/validate-gate.py --run-id <RUN_ID> --gate D
```

Do not mark the run complete until Gate D exits 0.
```

- [ ] **Step 6: Document the script in file-communication-layout.md**

At the end of [skills/gen-eval-loop/file-communication-layout.md](skills/gen-eval-loop/file-communication-layout.md), add:

```markdown
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
- artifact existence
- required YAML frontmatter fields
- both signatures on contracts (Gate B)
- no `UNVERIFIED` criteria (Gate C)
- no `manual_observation`-only evidence (Gate C)
- valid `final_verdict` values (Gate D)
```

- [ ] **Step 7: Commit**

```bash
git add commands/gen-eval.md skills/gen-eval-loop/file-communication-layout.md
git commit -m "feat: wire validate-gate.py into controller at every gate transition"
```

---

## Self-Review

### Spec coverage

| Change from analysis | Task |
|----------------------|------|
| Fix `decision` vs `strategic_decision` bug | Task 1 |
| Harden `manual_observation` | Task 2 + Gate C script check |
| Hard Playwright dependency for UI | Task 3 |
| Split ContractReviewer / SprintEvaluator | Task 4 |
| Evaluator model differentiation | Task 5 |
| Deterministic controller script | Task 6 |
| Wire script into controller | Task 7 |

All five structural issues from the analysis are covered.

### Placeholder scan

No TBD, TODO, or "similar to Task N" references. All code blocks are complete. All file paths are absolute or repo-relative.

### Type consistency

- `strategic_decision` is used consistently in Task 1, Task 6 (Gate B check), and contract-reviewer-prompt.md.
- `OBJECTIVE_EVIDENCE_TYPES` set in script matches the objective types listed in Task 2's artifact-schema.md update.
- Gate labels (A, B, C, D) are consistent across gen-eval.md wiring (Task 7) and the script (Task 6).
