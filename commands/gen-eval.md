---
description: Run the AI quality system via the TypeScript runtime. Delegates all orchestration to `runtime/` and surfaces the result.
argument-hint: <deliverable or evaluation target>
allowed-tools: [Read, Bash]
---

# /gen-eval

You have been invoked to run the AI quality system for this request:

```text
$ARGUMENTS
```

## Controller stance

You are a thin wrapper around the TypeScript runtime. Do NOT orchestrate the loop in-prompt and do NOT dispatch subagents. The runtime in `runtime/` owns state, validation, role dispatch, and evidence collection.

## Step 1 — Confirm the profile

Pick the profile that best fits the request:

- `ui` — visual surfaces, landing pages, dashboards (requires Playwright MCP + browsers)
- `backend` — APIs, services, data workflows
- `agentic` — tool-using agents, orchestrators
- `content` — long-form writing, specs, customer-facing copy

**Current runtime limitation:** the full-loop resume path is implemented for the `ui` profile. Other profiles can still run the individual CLI commands (init-run, write-spec-skeleton, etc.) but `run-full-loop` may error on non-ui profiles. If the request is clearly not ui, confirm with the user before proceeding.

## Step 2 — Verify the runtime is built

```bash
test -f runtime/dist/cli.js || (cd runtime && npm ci && npm run build)
```

## Step 3 — Pick the provider based on available credentials

- if `$ANTHROPIC_API_KEY` is set → `--provider anthropic`
- else if `$OPENAI_API_KEY` is set → `--provider openai`
- else → `--provider development` (deterministic, no network; smoke tests only)

Select the matching model:
- anthropic → `claude-sonnet-4-6` (or whatever the user's `ANTHROPIC_MODEL` env specifies)
- openai → `gpt-5.2` (or `OPENAI_MODEL`)
- development → `runtime-dev`

## Step 4 — Delegate to the runtime

Run the full loop:

```bash
cd runtime && npm run --silent start -- run-full-loop \
  --prompt "$ARGUMENTS" \
  --model "<model id for the selected provider>" \
  --provider "<provider>" \
  --profile "<profile from Step 1>" \
  --playwright-available "<true if ui profile else false>"
```

## Step 5 — Surface the result

The runtime prints a JSON object on stdout. Extract and show the user:

- `runId`
- `status` (final run status)
- `completed` (boolean)
- `summaryMarkdownPath` — link so the user can read the full summary

If the runtime exits non-zero or `status` is `PRECHECK_FAILED`, show the `preflight` block verbatim so the user can fix the environment (missing API key, missing browser, etc.).

## Do not

- orchestrate the loop with Task subagents in Claude Code
- read or write `run.json`, contracts, or scores directly — the runtime owns these
- invent a separate Python validator — the runtime validates via Zod
- continue past a non-zero exit code without surfacing the runtime's error
