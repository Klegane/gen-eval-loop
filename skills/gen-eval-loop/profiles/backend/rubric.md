# Backend Quality Profile Rubric

Default threshold per dimension: 7

Use this profile for APIs, services, jobs, integrations, database workflows, and non-visual systems.

## Dimensions

### 1. Correctness

What it measures: whether contract behavior is implemented accurately.

| Score | Descriptor |
|-------|------------|
| 0-2 | Core behavior incorrect or broken |
| 3-4 | Major contract flows fail |
| 5-6 | Mostly correct with notable gaps |
| 7 | Contract behavior works as specified |
| 8 | Correct plus thoughtful edge-case handling |
| 9 | Correct under broad evaluator probing |
| 10 | Production-grade correctness and consistency |

### 2. Reliability

What it measures: resilience under retries, bad inputs, timeouts, and repeated runs.

| Score | Descriptor |
|-------|------------|
| 0-2 | Fragile or flaky |
| 3-4 | Works once, breaks under mild pressure |
| 5-6 | Adequate but brittle in edge cases |
| 7 | Stable under normal and obvious failure cases |
| 8 | Handles retries and degraded conditions well |
| 9 | Resilient, predictable, and low-drift |
| 10 | Robust enough for sustained operational use |

Automatic deductions:

- flaky verification or non-deterministic output with no explanation -> cap at 6
- retry/failure path missing for a promised integration -> cap at 5

### 3. Observability

What it measures: logs, diagnostics, error clarity, and ability to understand failures.

| Score | Descriptor |
|-------|------------|
| 0-2 | Silent failures or opaque behavior |
| 3-4 | Minimal visibility into what went wrong |
| 5-6 | Some useful logs, missing structure or coverage |
| 7 | Clear enough logs and outputs to debug contract flows |
| 8 | Thoughtful diagnostics and failure surfacing |
| 9 | Strong observability across normal and failure paths |
| 10 | Excellent diagnostic quality and operational clarity |

Automatic deductions:

- promised failure path has no useful error output -> cap at 6
- evaluator cannot tell why a step failed -> cap at 5

### 4. Operability

What it measures: ease of starting, configuring, migrating, and evaluating the system.

| Score | Descriptor |
|-------|------------|
| 0-2 | Cannot be started or configured reliably |
| 3-4 | Setup is brittle or undocumented |
| 5-6 | Runnable, but rough operationally |
| 7 | Straightforward to start, configure, and verify |
| 8 | Clear setup, safe defaults, clean operational workflow |
| 9 | Strongly operator-friendly |
| 10 | Excellent local and team operability |

Automatic deductions:

- app or service does not start -> cap at 3
- undocumented required env var or setup step -> cap at 6
- migration or seed step is required but not described -> cap at 5

## Preferred Evidence

- `http_check`
- `db_check`
- `command_output`
- `log_extract`
- `git_diff_review`

## Scoring Rule

No evidence, no PASS. Any criterion marked `UNVERIFIED` fails the sprint.
