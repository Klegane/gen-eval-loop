#!/usr/bin/env python3
"""Aggregate evaluation scorecards into summary statistics.

Usage:
  python3 evaluation/aggregate.py <results-dir> <scorecard.json> [<scorecard.json> ...]

Reads:
  - <results-dir>/<task-id>/assignment.txt — which label was baseline vs gen-eval
  - one or more scorecard JSON files conforming to evaluation/schemas/scorecard.schema.json

Computes per task and overall:
  - mean score per dimension, per condition
  - mean score DIFFERENCE (gen-eval − baseline)
  - preference share (X, Y, TIE → baseline, gen-eval, tie)

Output: JSON to stdout, human-readable Markdown to stderr.
"""
import json
import sys
from pathlib import Path
from statistics import mean, stdev


def load_assignments(results_dir: Path) -> dict:
    assignments = {}
    for task_dir in results_dir.iterdir():
        if not task_dir.is_dir():
            continue
        assignment_file = task_dir / "assignment.txt"
        if not assignment_file.exists():
            continue
        content = assignment_file.read_text().strip()
        parts = dict(kv.split("=") for kv in content.split())
        assignments[task_dir.name] = parts  # baseline=A/B, geneval=A/B
    return assignments


def main() -> None:
    if len(sys.argv) < 3:
        print("Usage: aggregate.py <results-dir> <scorecard.json> [<scorecard.json> ...]", file=sys.stderr)
        sys.exit(2)

    results_dir = Path(sys.argv[1])
    scorecard_paths = [Path(p) for p in sys.argv[2:]]

    assignments = load_assignments(results_dir)

    scorecards = [json.loads(p.read_text()) for p in scorecard_paths]

    by_task = {}
    for sc in scorecards:
        judge = sc["judgeId"]
        for entry in sc["results"]:
            task_id = entry["taskId"]
            if task_id not in assignments:
                continue
            task = by_task.setdefault(task_id, {"baseline": [], "geneval": [], "preferences": []})

            # Scorecards use outputA/outputB/preference=A|B|TIE.
            # assignment.txt records which label (A or B) was the baseline
            # vs the gen-eval condition for this task.
            a_cond = "baseline" if assignments[task_id]["baseline"] == "A" else "geneval"
            b_cond = "baseline" if assignments[task_id]["baseline"] == "B" else "geneval"

            for label, cond in (("outputA", a_cond), ("outputB", b_cond)):
                scores = entry[label]["scores"]
                for dim, score in scores.items():
                    task[cond].append((dim, score, judge))

            pref = entry["preference"]
            if pref == "TIE":
                task["preferences"].append((judge, "tie"))
            else:
                task["preferences"].append((
                    judge,
                    "baseline" if assignments[task_id]["baseline"] == pref else "geneval",
                ))

    summary = {}
    for task_id, data in by_task.items():
        by_dim = {}
        for cond in ("baseline", "geneval"):
            dim_scores = {}
            for dim, score, _judge in data[cond]:
                dim_scores.setdefault(dim, []).append(score)
            by_dim[cond] = {
                dim: {
                    "mean": mean(v),
                    "stdev": stdev(v) if len(v) > 1 else 0.0,
                    "n": len(v),
                }
                for dim, v in dim_scores.items()
            }

        deltas = {}
        for dim in by_dim["baseline"]:
            if dim in by_dim["geneval"]:
                deltas[dim] = by_dim["geneval"][dim]["mean"] - by_dim["baseline"][dim]["mean"]

        pref_counts = {"baseline": 0, "geneval": 0, "tie": 0}
        for _judge, pref in data["preferences"]:
            pref_counts[pref] += 1

        summary[task_id] = {
            "byDimension": by_dim,
            "delta": deltas,
            "preferenceCounts": pref_counts,
        }

    overall_deltas = {}
    for task_summary in summary.values():
        for dim, delta in task_summary["delta"].items():
            overall_deltas.setdefault(dim, []).append(delta)
    overall = {dim: {"meanDelta": mean(v), "n": len(v)} for dim, v in overall_deltas.items()}

    result = {"perTask": summary, "overall": overall}
    print(json.dumps(result, indent=2))

    print("\n## Overall (gen-eval − baseline)", file=sys.stderr)
    for dim, stats in overall.items():
        print(f"- {dim}: Δ={stats['meanDelta']:+.2f} (n={stats['n']})", file=sys.stderr)


if __name__ == "__main__":
    main()
