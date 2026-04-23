# gen-eval runtime

Deterministic runtime for `gen-eval-loop` v2.

## What it does

- owns `run.json` and state transitions in code
- validates artefacts with Zod
- runs stateless Planner, Generator, and Evaluator roles through an `LlmAdapter`
- collects Playwright evidence for the `ui` profile
- can resume an interrupted run or execute a full loop end to end

## Providers

The CLI loads environment variables automatically from `runtime/.env` if present.
Start by copying [`.env.example`](</c:/Users/eriks/Projects/claude-best-practices/gen-eval-loop/runtime/.env.example:1>) to `.env` and filling in your keys.

### Development adapter

Uses local deterministic builders and review logic so the runtime can be tested without a live model API.

```powershell
npm run start -- run-full-loop --prompt "build a premium homepage" --model "runtime-dev" --provider development --profile ui --playwright-available true
```

### OpenAI adapter

Uses the OpenAI Responses API with structured outputs.

Required environment variables:

```powershell
$env:GEN_EVAL_LLM_PROVIDER="openai"
$env:OPENAI_API_KEY="your-openai-api-key"
```

Optional environment variables:

```powershell
$env:OPENAI_MODEL="gpt-5.2"
$env:OPENAI_BASE_URL="https://api.openai.com/v1"
$env:OPENAI_ORGANIZATION="..."
$env:OPENAI_PROJECT="..."
$env:OPENAI_TIMEOUT_MS="60000"
```

Example:

```powershell
npm run start -- run-full-loop --prompt "build a premium homepage" --model "gpt-5.2" --provider openai --profile ui --playwright-available true
```

### Anthropic adapter

Uses the Claude Messages API with structured outputs via `output_config.format`.

Required environment variables:

```powershell
$env:GEN_EVAL_LLM_PROVIDER="anthropic"
$env:ANTHROPIC_API_KEY="your-anthropic-api-key"
```

Optional environment variables:

```powershell
$env:ANTHROPIC_MODEL="claude-sonnet-4-5"
$env:ANTHROPIC_BASE_URL="https://api.anthropic.com/v1"
$env:ANTHROPIC_VERSION="2023-06-01"
$env:ANTHROPIC_TIMEOUT_MS="60000"
$env:ANTHROPIC_MAX_TOKENS="4096"
```

Example:

```powershell
npm run start -- run-full-loop --prompt "build a premium homepage" --model "claude-sonnet-4-5" --provider anthropic --profile ui --playwright-available true
```

## Key commands

Check whether the runtime is ready before spending tokens on a run:

```powershell
npm run start -- check-runtime-health --provider anthropic --profile ui
```

If you only want to validate provider/env wiring and skip the live Chromium launch:

```powershell
npm run start -- check-runtime-health --provider anthropic --profile ui --skip-browser-launch
```

Check whether the configured provider can answer a minimal structured output request:

```powershell
npm run start -- check-provider-health --provider anthropic --model "claude-sonnet-4-6"
```

`run-full-loop` and `resume-run` now execute this preflight automatically unless you pass `--skip-preflight`.
If you want the preflight to skip only the live Chromium launch, use `--skip-preflight-browser-launch`.
Each executed preflight is persisted into `.gen-eval/<run-id>/run.json`, and completed runs also include the latest preflight snapshot in `summary.json` and `summary.md`.

Initialize a run:

```powershell
npm run start -- init-run --prompt "build a premium homepage" --model "gpt-5.2"
```

Resume a run from its persisted state:

```powershell
npm run start -- resume-run --run-id "<run-id>" --provider development
```

Run the full loop from scratch:

```powershell
npm run start -- run-full-loop --prompt "build a premium homepage" --model "gpt-5.2" --provider development --profile ui
```

Run Playwright evidence manually:

```powershell
npm run start -- run-playwright-evidence --run-id "<run-id>" --sprint 1 --base-url "http://127.0.0.1:3000"
```

## Playwright note

If Playwright browsers are not installed, the runtime will classify the result as an infrastructure failure and abort the run early instead of burning through repeated sprints.

Install browsers with:

```powershell
npx playwright install
```
