# Content Quality Profile Rubric

Default threshold per dimension: 7

Use this profile for written deliverables where quality depends on fit, specificity, structure, and factual discipline.

## Dimensions

### 1. Intent Fit

What it measures: how well the output addresses the user's actual goal, audience, and requested format.

| Score | Descriptor |
|-------|------------|
| 0-2 | Misses the assignment |
| 3-4 | Addresses parts of the request only |
| 5-6 | Mostly aligned, with important misses |
| 7 | Fits the request, audience, and format clearly |
| 8 | Strong fit with clear prioritization |
| 9 | Highly tuned to the real user need |
| 10 | Perfectly calibrated to intent and audience |

### 2. Specificity

What it measures: substance, insight, and avoidance of generic filler.

| Score | Descriptor |
|-------|------------|
| 0-2 | Empty or generic filler |
| 3-4 | Mostly abstract statements |
| 5-6 | Some concrete value, still broad |
| 7 | Specific, useful, and non-generic |
| 8 | Insightful and richly concrete |
| 9 | Deeply specific and high-signal |
| 10 | Exceptionally sharp and original |

Automatic deductions:

- boilerplate filler with little concrete guidance -> cap at 5
- repeated generic phrasing -> cap at 6

### 3. Structure and Craft

What it measures: flow, readability, clarity, and sentence-level polish.

| Score | Descriptor |
|-------|------------|
| 0-2 | Hard to follow or badly structured |
| 3-4 | Loose structure and rough writing |
| 5-6 | Readable but uneven |
| 7 | Clear structure and competent polish |
| 8 | Strong pacing and clean craft |
| 9 | Excellent clarity and editorial control |
| 10 | Outstanding structure and prose quality |

### 4. Factual Grounding

What it measures: whether claims are supported, caveated, or appropriately constrained.

| Score | Descriptor |
|-------|------------|
| 0-2 | Invented or misleading claims |
| 3-4 | Several unsupported assertions |
| 5-6 | Mostly grounded, with some shaky claims |
| 7 | Claims are supported or clearly framed as assumptions |
| 8 | Strong grounding and careful caveats |
| 9 | Highly trustworthy and evidence-aware |
| 10 | Extremely rigorous and dependable |

Automatic deductions:

- invented factual claim -> cap at 3
- unsupported high-confidence assertion in a critical section -> cap at 5

## Preferred Evidence

- `manual_observation`
- `command_output`
- `log_extract`

## Scoring Rule

If a factual criterion cannot be substantiated, mark it `UNVERIFIED` and fail the sprint.
