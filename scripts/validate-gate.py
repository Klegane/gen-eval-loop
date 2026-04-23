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


def check_fields(frontmatter: dict, required: list, label: str) -> None:
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
    parser.add_argument("--run-id", required=True, help="Run ID")
    parser.add_argument("--gate", required=True, choices=["A", "B", "C", "D"])
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
