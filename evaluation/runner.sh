#!/usr/bin/env bash
# Runs one corpus task under two conditions (baseline + gen-eval-loop).
# Outputs go to evaluation/results/<run-ts>/<task-id>/{A,B}/
# A/B assignment is randomized per task to preserve blinding.
#
# Usage: ./evaluation/runner.sh <task-id> [provider]
# Example: ./evaluation/runner.sh ui-01-coffee-homepage anthropic

set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <task-id> [provider]" >&2
  exit 2
fi

TASK_ID="$1"
PROVIDER="${2:-anthropic}"
REPO_ROOT="$(git rev-parse --show-toplevel)"
TS=$(date -u +"%Y%m%dT%H%M%SZ")
OUT_DIR="$REPO_ROOT/evaluation/results/$TS/$TASK_ID"
mkdir -p "$OUT_DIR/A" "$OUT_DIR/B"

# Extract task prompt + profile from corpus via Python (portable vs jq).
read -r PROMPT PROFILE < <(python3 - <<PY
import yaml, sys
corpus = yaml.safe_load(open("$REPO_ROOT/evaluation/corpus/tasks.yaml"))
task = next((t for t in corpus["tasks"] if t["id"] == "$TASK_ID"), None)
if not task:
    sys.exit(f"task $TASK_ID not found")
print(task["prompt"].replace("\n", " "), task["profile"])
PY
)

# Randomize A/B assignment per task (coin flip).
if [ $(( RANDOM % 2 )) -eq 0 ]; then
  BASELINE_LABEL="A"; GENEVAL_LABEL="B"
else
  BASELINE_LABEL="B"; GENEVAL_LABEL="A"
fi
echo "baseline=$BASELINE_LABEL geneval=$GENEVAL_LABEL" > "$OUT_DIR/assignment.txt"

echo "== Running baseline ($BASELINE_LABEL) for $TASK_ID =="
# Baseline: pass prompt directly to a raw Claude CLI call. Adjust command per environment.
# Portable fallback: the harness assumes a CLAUDE_BASELINE_CMD env var that takes a prompt on stdin.
if [ -z "${CLAUDE_BASELINE_CMD:-}" ]; then
  echo "ERROR: set CLAUDE_BASELINE_CMD to the shell command that runs your baseline Claude call with the prompt on stdin." >&2
  exit 3
fi
echo "$PROMPT" | bash -c "$CLAUDE_BASELINE_CMD" > "$OUT_DIR/$BASELINE_LABEL/output.md" 2> "$OUT_DIR/$BASELINE_LABEL/stderr.log"

echo "== Running gen-eval-loop ($GENEVAL_LABEL) for $TASK_ID =="
cd "$REPO_ROOT/runtime"
npm run --silent start -- run-full-loop \
  --prompt "$PROMPT" \
  --model "claude-sonnet-4-6" \
  --provider "$PROVIDER" \
  --profile "$PROFILE" \
  --playwright-available "$( [ "$PROFILE" = "ui" ] && echo true || echo false )" \
  --repo-root "$OUT_DIR/$GENEVAL_LABEL" \
  > "$OUT_DIR/$GENEVAL_LABEL/result.json" 2> "$OUT_DIR/$GENEVAL_LABEL/stderr.log"

# Extract summary.md path and copy content next to result.json for judge convenience.
SUMMARY_PATH=$(python3 -c "import json; print(json.load(open('$OUT_DIR/$GENEVAL_LABEL/result.json')).get('summaryMarkdownPath', ''))")
if [ -n "$SUMMARY_PATH" ] && [ -f "$SUMMARY_PATH" ]; then
  cp "$SUMMARY_PATH" "$OUT_DIR/$GENEVAL_LABEL/output.md"
fi

echo "Done. Outputs at $OUT_DIR"
