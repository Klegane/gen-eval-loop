# Evaluation

This directory holds the infrastructure for empirically validating that gen-eval-loop produces higher-quality outputs than raw Claude Code for the tasks this system targets.

## Design

For each of the 20 tasks in [corpus/tasks.yaml](corpus/tasks.yaml), we run two conditions:

- **Baseline:** the raw prompt through a bare Claude call.
- **gen-eval-loop:** the same prompt through `/gen-eval`.

Outputs are randomly labeled X or Y per task. Three human judges score each output blind (they do not know which was produced by which condition). Scores are 1-5 per task-specific dimension, and judges also record a forced preference.

`aggregate.py` computes:
- per-dimension mean and standard deviation per condition
- delta (gen-eval − baseline) per dimension per task
- overall deltas across all tasks
- preference distribution per task

## Running the experiment

1. Set up baseline command:
   ```bash
   export CLAUDE_BASELINE_CMD="claude --print --no-save"  # adapt to your setup
   ```

2. Run each task (one at a time, ~15-30 min per task):
   ```bash
   ./runner.sh ui-01-coffee-homepage anthropic
   ./runner.sh be-01-url-shortener anthropic
   # ... all 20 tasks
   ```

   Outputs appear in `results/<timestamp>/<task-id>/{A,B}/`. `assignment.txt` records which label was the baseline for each task (do not show this to judges).

3. Prepare scorecards:
   - Copy [scorecard-template.md](scorecard-template.md) three times → one per judge.
   - Populate each with the 20 tasks and their X/Y outputs.
   - Hand off the scorecards + output directories (without `assignment.txt`) to three independent judges.

4. Collect filled scorecards as JSON files matching [schemas/scorecard.schema.json](schemas/scorecard.schema.json).

5. Aggregate:
   ```bash
   python3 aggregate.py results/<timestamp>/ judge-a.json judge-b.json judge-c.json > overall.json
   ```

   Read the Markdown summary on stderr for a quick take.

## Honesty rule

If the overall delta per dimension is not positive AND statistically distinguishable from zero across judges, the plugin does not demonstrably improve quality on this corpus. That is a valid result — publish it. Do not add judges or cherry-pick tasks until you get the answer you wanted.

## Required manual steps

This harness scaffolds the experiment. The following cannot be automated:
- actually running 20 × 2 = 40 LLM calls (time + cost)
- three independent human judges scoring blind
- reporting results honestly
