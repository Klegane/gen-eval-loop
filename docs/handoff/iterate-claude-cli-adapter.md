# Handoff — Iterate the `claude-cli` Adapter Until a Real Run Completes

**Goal:** make `gen-eval-loop` execute its full evaluation loop end-to-end using **only the local `claude` CLI** (Claude Pro subscription, no API key required), so the empirical experiment in `evaluation/` produces real data to compare against the baseline condition.

**Author of handoff:** previous session, 2026-04-25.
**Reads:** any LLM with shell access (Claude Code, Cursor, Aider, etc.) — the work is local prompt engineering plus optional schema tweaks.

---

## 1. Repo orientation (5 min read)

- **Repo:** `/Users/erikmuniain/Projects/gen-eval-loop`
- **Branch:** `main`
- **TypeScript runtime:** `runtime/`. `npm test` runs `tsc -p tsconfig.json && node --test`. **88 tests must stay green** through every change.
- **Evaluation harness:** `evaluation/`. `runner.sh` drives one task, `aggregate.py` rolls up scorecards.
- **Slash command:** `commands/gen-eval.md` delegates to the runtime CLI.

Useful files for context:

| File | Why |
|------|-----|
| `runtime/src/roles/claude-cli-adapter.ts` | The adapter we're iterating on |
| `runtime/src/roles/development-llm-adapter.ts` | Reference: deterministic adapter that produces schema-valid outputs |
| `runtime/src/roles/anthropic-messages-adapter.ts` | Reference: API adapter, also produces schema-valid outputs |
| `runtime/src/schemas/spec.ts` | Spec schema — this is where the current failure is |
| `runtime/src/schemas/contract.ts`, `report.ts`, `score.ts`, `evidence.ts`, `summary.ts` | Other artifact schemas, expect same kind of friction |
| `runtime/src/roles/planner-role.ts` etc. | Where roles call the adapter |
| `runtime/src/app/resume-run.ts` | Drives the full loop; reads spec/contract/report/etc. through the controller |
| `evaluation/runner.sh` | Test harness (calls baseline + gen-eval-loop) |
| `evaluation/corpus/tasks.yaml` | The 20 corpus tasks; we focus on `content` profile (4 tasks) |

Recent commits:

```
c467f1f feat(runtime): add claude-cli adapter using local Claude CLI + Pro subscription   ← adapter we're iterating on
e3932be fix(evaluation): unify A/B labels across scorecard, aggregator, and assignment.txt
1061e21 fix(evaluation): symlink skills/ into per-run output dir so PromptLoader resolves
709487d feat(runtime): resumeRun supports content/backend/agentic profiles
666bef5 fix(evaluation): runner.sh correctly parses multi-word prompts
```

---

## 2. What works empirically today

1. **Baseline condition fully works.** `CLAUDE_BASELINE_CMD='claude --print --model sonnet'` produces ~80-line postmortems / spec / etc. via the user's Pro subscription.
2. **`claude-cli` adapter wired through.** `--provider claude-cli` selects it. Adapter spawns `claude --print --output-format json --json-schema <S> --disallowedTools Write Edit ... --model <M> --system-prompt <SP>` with the user prompt on stdin.
3. **Pipeline reaches the LLM.** The runtime calls `PlannerRole.run`, role calls `adapter.generateObject`, adapter calls the CLI, CLI calls Claude with Pro subscription, Claude returns JSON.
4. **88/88 tests green** including `claude-cli` adapter compile.

---

## 3. The exact failure mode you'll hit first

Run the smoke test:

```bash
cd /Users/erikmuniain/Projects/gen-eval-loop
rm -rf evaluation/results
CLAUDE_BASELINE_CMD='claude --print --model sonnet' \
  bash evaluation/runner.sh ct-03-postmortem claude-cli
```

Inspect the gen-eval condition's stderr:

```bash
LATEST=$(ls -td evaluation/results/*/ | head -1)
ASSIGN=$(cat "$LATEST"ct-03-postmortem/assignment.txt)
GENEVAL=$(echo "$ASSIGN" | sed -n 's/.*geneval=\([AB]\).*/\1/p')
cat "$LATEST"ct-03-postmortem/$GENEVAL/stderr.log | head -40
```

You will see a `ZodError` on the `Spec` schema. As of last session it was:

```
ZodError: [
  { "code": "invalid_type", "expected": "string", "received": "object",
    "path": ["successCriteria", 0], "message": "Expected string, received object" },
  ...
]
```

Meaning: Claude generates `successCriteria: [{title: "...", measure: "..."}, ...]` (objects) but the schema requires `successCriteria: string[]`.

Same class of bug will likely surface again on the next role's call (`Generator.draftContract` → contract criteria, `Evaluator.score` → score rows).

---

## 4. The iteration loop (this is the loop you'll run repeatedly)

Each cycle is ~30-60 seconds:

```bash
# 1. Edit adapter or schema (your change)
$EDITOR runtime/src/roles/claude-cli-adapter.ts

# 2. Build
cd runtime && npm run build && cd ..

# 3. Confirm tests still pass
cd runtime && npm test 2>&1 | tail -5 && cd ..

# 4. Run one smoke task
rm -rf evaluation/results
CLAUDE_BASELINE_CMD='claude --print --model sonnet' \
  bash evaluation/runner.sh ct-03-postmortem claude-cli

# 5. Inspect outcome
LATEST=$(ls -td evaluation/results/*/ | head -1)
ASSIGN=$(cat "$LATEST"ct-03-postmortem/assignment.txt)
GENEVAL=$(echo "$ASSIGN" | sed -n 's/.*geneval=\([AB]\).*/\1/p')
RESULT="$LATEST"ct-03-postmortem/$GENEVAL/result.json
if [ -s "$RESULT" ]; then
  python3 -c "import json; d=json.load(open('$RESULT')); print(d.get('status'), 'completed='+str(d.get('completed')))"
else
  head -20 "$LATEST"ct-03-postmortem/$GENEVAL/stderr.log
fi
```

When ct-03 completes, run all 4 content tasks:

```bash
for t in ct-01-onboarding-email ct-02-migration-guide ct-03-postmortem ct-04-product-spec; do
  echo "=== $t ==="
  CLAUDE_BASELINE_CMD='claude --print --model sonnet' \
    bash evaluation/runner.sh "$t" claude-cli 2>&1 | tail -3
done
```

---

## 5. Three solution paths (try in this order)

### Path A — Tighten the system prompt (lowest cost, try first)

File: `runtime/src/roles/claude-cli-adapter.ts`, the `systemPrompt` const around line ~50.

The current prompt tells Claude to copy metadata fields and generate content fields. It does NOT explain the exact shape of arrays. Add concrete shape rules. Example additions:

- "Array fields whose schema entry is `{type: 'array', items: {type: 'string'}}` MUST be a flat list of strings, NEVER objects. If you have structured data, flatten each item to a single sentence string."
- "Read the inline JSON Schema carefully. Match exact types: `string` is not `object`, `number` is not `string`."
- "Do NOT add fields not present in the schema."

Cost: free, ~5-10 iteration cycles.

### Path B — Few-shot examples in the prompt

If Path A plateaus, embed one realistic example of a schema-valid spec/contract/etc. in the system prompt. The development adapter (`runtime/src/roles/development-llm-adapter.ts`) builds these — borrow its output shapes.

Pseudocode:

```typescript
const exampleByTaskType: Record<string, unknown> = {
  planner_spec: { runId: "demo", artifact: "spec", successCriteria: ["Loads in under 1s", "Passes a11y audit"], /* ... */ },
  // etc.
};

const taskType = (request.metadata?.taskType as string) ?? "";
const fewShotJson = exampleByTaskType[taskType];
if (fewShotJson) {
  systemPromptParts.push("Example of a valid output for this task type:\n" + JSON.stringify(fewShotJson, null, 2));
}
```

Cost: ~30 min, mostly building the example payloads.

### Path C — Schema coercion (most invasive, save for last)

If the LLM stubbornly returns objects where strings are expected, add a Zod `preprocess` to flatten. File: `runtime/src/schemas/spec.ts` (and likely siblings).

Pattern:

```typescript
const flexibleStringArray = z.preprocess((v) => {
  if (!Array.isArray(v)) return v;
  return v.map((item) => {
    if (typeof item === "string") return item;
    if (item && typeof item === "object") {
      // Pick the most likely "title" or "label" field, fall back to JSON.
      const o = item as Record<string, unknown>;
      return (o.title as string) ?? (o.label as string) ?? (o.text as string) ?? JSON.stringify(o);
    }
    return String(item);
  });
}, z.array(z.string().min(1)));

// Replace `successCriteria: z.array(z.string().min(1))` with:
successCriteria: flexibleStringArray,
```

Pros: definitive, handles drift across LLMs. Cons: may break test fixtures that pass objects expecting rejection. Run `npm test` after every schema change.

---

## 6. How to know you're done

**Done = green smoke test of all 4 content tasks:**

```
ct-01-onboarding-email   status=completed  completed=True
ct-02-migration-guide    status=completed  completed=True
ct-03-postmortem         status=completed  completed=True
ct-04-product-spec       status=completed  completed=True
```

Plus:

- `npm test` still emits `pass 88` (or higher if you added tests).
- Each gen-eval condition output is `>= 30` lines and looks like a real summary, not a stub.

When you reach this state, commit and stop. The user can then recruit 3 human judges and run `aggregate.py` to get the experiment's actual quality verdict.

---

## 7. Constraints — please respect

- **Do NOT use the Anthropic Messages API.** No `ANTHROPIC_API_KEY`. Everything must go through `claude --print` so the user's Pro subscription pays.
- **Do NOT skip the build step.** `node --test` runs against `dist/`, so changes invisible to the build won't take effect.
- **Do NOT modify `evaluation/corpus/tasks.yaml`** to make tasks easier — that defeats the experiment.
- **Do NOT silently change Zod schemas without checking** all consumers (run `grep -rn '<SchemaName>' runtime/src` first).
- **Commit every meaningful step** with a descriptive message — the previous session's commit log is a useful trail.
- **Stop and report** if you've spent more than 10 cycles on one error class. Sometimes the right answer is to escalate to the human (e.g., "Path A and B exhausted, recommend Path C").

---

## 8. Drop-in prompt for a fresh LLM session

Paste the block below into a fresh Claude Code (or other tool-using LLM) session at the repo root.

````
You are continuing work on the gen-eval-loop project. There is a handoff
document at:

  docs/handoff/iterate-claude-cli-adapter.md

Read it FIRST and follow its iteration loop. The goal is to make the
TypeScript runtime's `claude-cli` provider produce schema-valid outputs
for the Planner, Generator, and Evaluator roles, so a full content-profile
run completes end-to-end using only the local `claude` CLI (Claude Pro
subscription, no API key).

Hard constraints (also in the handoff):
- Use ONLY the local `claude` CLI. Never set or read ANTHROPIC_API_KEY or OPENAI_API_KEY.
- Keep the existing 88 tests green at every commit (`cd runtime && npm test`).
- Do not modify the corpus prompts in `evaluation/corpus/tasks.yaml`.
- Do not weaken Zod schemas to accept obviously wrong shapes; either tighten
  the prompt (Path A/B in the handoff) or add narrow `z.preprocess` coercions
  (Path C). If you go Path C, document each coercion with a comment naming
  the actual LLM output shape it normalises.

Process:
1. Read docs/handoff/iterate-claude-cli-adapter.md fully.
2. Run the iteration loop in section 4 once with no changes to confirm you
   reproduce the failure described in section 3.
3. Pick Path A (system prompt tuning) and iterate. Try at most 5 prompt
   variations on `ct-03-postmortem`. After each, run the loop and inspect
   the new stderr; categorise whether the error class is the same, different,
   or gone.
4. If Path A plateaus, switch to Path B (few-shot examples). The development
   adapter at `runtime/src/roles/development-llm-adapter.ts` produces
   schema-valid payloads — borrow its shapes for the few-shot.
5. Only escalate to Path C (Zod preprocess) if A and B together still leave
   one schema field broken.
6. When `ct-03-postmortem` reaches `completed=True`, run all 4 content
   tasks (ct-01 through ct-04) and confirm 4/4 complete.
7. Commit each meaningful step. Final commit should say what changed and
   why, citing the failure modes you fixed.

Report cadence:
- One short status update per iteration cycle (1 sentence: "tried X, error
  changed from Y to Z").
- A longer summary when you switch paths or finish.

Do NOT touch unrelated files. Do NOT add new dependencies. Do NOT enlarge
the scope to other profiles (ui/backend/agentic) — content only for now.

Start by reading the handoff doc.
````

---

## 9. Smoke commands cheatsheet (copy-paste friendly)

```bash
# Build runtime
cd /Users/erikmuniain/Projects/gen-eval-loop/runtime && npm run build

# Run all 88 tests
npm test 2>&1 | tail -10

# Single-task smoke
cd /Users/erikmuniain/Projects/gen-eval-loop
rm -rf evaluation/results
CLAUDE_BASELINE_CMD='claude --print --model sonnet' \
  bash evaluation/runner.sh ct-03-postmortem claude-cli

# Inspect last gen-eval result
LATEST=$(ls -td evaluation/results/*/ | head -1)
ASSIGN=$(cat "$LATEST"ct-03-postmortem/assignment.txt)
GENEVAL=$(echo "$ASSIGN" | sed -n 's/.*geneval=\([AB]\).*/\1/p')
RESULT="$LATEST"ct-03-postmortem/$GENEVAL/result.json
echo "--- result.json ---"; [ -s "$RESULT" ] && cat "$RESULT" | python3 -m json.tool || echo "(empty or missing)"
echo "--- stderr.log first 30 ---"; head -30 "$LATEST"ct-03-postmortem/$GENEVAL/stderr.log

# Manual one-shot CLI test (debugging schema/prompt friction in isolation)
SCHEMA=$(node -e "
const { specSchema } = require('./runtime/dist/schemas/spec.js');
const { zodToJsonSchema } = require('./runtime/node_modules/zod-to-json-schema');
console.log(JSON.stringify(zodToJsonSchema(specSchema, {\$refStrategy:'none'})));
")
echo 'Produce a minimal valid spec for run id "smoke-1", request "write a postmortem", profile content. Return JSON only.' | \
  claude --print --output-format json --json-schema "$SCHEMA" --model sonnet \
    --disallowedTools Write Edit Task Bash Read Glob Grep WebFetch WebSearch TodoWrite \
    --system-prompt "Return ONLY a JSON object matching the schema. No prose. No markdown." \
    | python3 -c "import json,sys; d=json.load(sys.stdin); print('keys:', list(d.keys())); print('result first 800:', d.get('result','')[:800])"
```
