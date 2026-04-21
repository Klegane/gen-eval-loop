# Agentic Quality Profile Rubric

Default threshold per dimension: 7

Use this profile for tool-using agents, orchestrators, automated task runners, and multi-step workflows where behavior quality matters more than a static UI.

## Dimensions

### 1. Task Success

What it measures: whether the agent actually completes the requested job.

| Score | Descriptor |
|-------|------------|
| 0-2 | Fails the core task |
| 3-4 | Partial progress only |
| 5-6 | Completes happy path with notable gaps |
| 7 | Completes the contracted task reliably |
| 8 | Handles reasonable variations in the task |
| 9 | Strong task execution under evaluator probing |
| 10 | Exceptional task completion quality |

### 2. Tool Discipline

What it measures: correct use of tools, constraints, and available capabilities.

| Score | Descriptor |
|-------|------------|
| 0-2 | Fabricates tool results or misuses tools badly |
| 3-4 | Frequent tool confusion or sloppy execution |
| 5-6 | Mostly correct, some weak discipline |
| 7 | Uses tools correctly and transparently |
| 8 | Strong judgment about tool choice and sequencing |
| 9 | Excellent discipline and constraint handling |
| 10 | Exemplary tool behavior with no wasted motion |

Automatic deductions:

- fabricated tool output -> cap at 2
- bypassing a required gate or constraint -> cap at 4

### 3. Robustness

What it measures: behavior under bad inputs, partial failures, and ambiguity.

| Score | Descriptor |
|-------|------------|
| 0-2 | Falls apart on mild disruption |
| 3-4 | Handles only the clean path |
| 5-6 | Some fallback behavior, still brittle |
| 7 | Handles obvious disruptions responsibly |
| 8 | Adapts sensibly under partial failure |
| 9 | Strong resilience without losing task clarity |
| 10 | Exceptionally robust under adversarial use |

### 4. Recovery Behavior

What it measures: whether the agent notices mistakes, repairs them, and escalates when appropriate.

| Score | Descriptor |
|-------|------------|
| 0-2 | Repeats mistakes or hides failures |
| 3-4 | Notices some issues, weak recovery |
| 5-6 | Basic retries, limited repair strategy |
| 7 | Recognizes failure and chooses reasonable recovery |
| 8 | Good repair loops and escalation judgment |
| 9 | Strong self-correction without thrashing |
| 10 | Excellent recovery behavior and operator trust |

Automatic deductions:

- hidden failure or misleading success claim -> cap at 3
- obvious recoverable failure with no retry or escalation -> cap at 4

## Preferred Evidence

- `command_output`
- `log_extract`
- `manual_observation`
- `git_diff_review`

## Scoring Rule

A sprint fails if the evaluator cannot verify the contracted behavior with real artefacts or replayable evidence.
