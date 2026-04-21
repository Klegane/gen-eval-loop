# UI Quality Profile Rubric

Default threshold per dimension: 7

Use this profile for frontends, landing pages, dashboards, visual flows, and any run where visual quality is part of the product value.

## Dimensions

### 1. Design Quality

What it measures: hierarchy, typography, spacing, composition, and color coherence.

| Score | Descriptor |
|-------|------------|
| 0-2 | Raw defaults or visibly broken design |
| 3-4 | Some styling, weak hierarchy, inconsistent spacing |
| 5-6 | Competent but generic |
| 7 | Clear hierarchy and deliberate type and spacing |
| 8 | Strong, coherent visual choices |
| 9 | Distinctive and polished product-level design |
| 10 | Outstanding, gallery-level execution |

### 2. Originality

What it measures: resistance to AI slop and possession of a real visual identity.

| Score | Descriptor |
|-------|------------|
| 0-2 | Pure AI slop |
| 3-4 | Mostly generic with a few custom touches |
| 5-6 | Mixed; some choices are intentional but the overall shape still feels default |
| 7 | Distinct look with deliberately chosen type and palette |
| 8 | Clearly differentiated from generic LLM output |
| 9 | Aesthetic feels specific to the product |
| 10 | The visual identity is inseparable from the concept |

Instant caps:

- generic default font stacks without spec justification -> cap at 4
- stock purple/blue gradient on white -> cap at 4
- generic centered hero + three cards + testimonial + CTA formula -> cap at 4
- placeholder copy or emoji gimmicks left in -> cap at 4

### 3. Craft

What it measures: polish, consistency, absence of visible defects, and interaction detail.

| Score | Descriptor |
|-------|------------|
| 0-2 | Broken or visibly rough |
| 3-4 | Multiple defects or inconsistencies |
| 5-6 | Acceptable with some rough edges |
| 7 | No obvious defects; interaction states are clear |
| 8 | Thoughtful polish and detail |
| 9 | Consistently high quality everywhere |
| 10 | Feels carefully hand-crafted |

Automatic deductions:

- console errors on initial load -> cap at 6
- major layout shift on first load -> cap at 6
- broken images or 404s in promised flows -> cap at 4

### 4. Functionality

What it measures: whether every promised UI flow works end to end.

| Score | Descriptor |
|-------|------------|
| 0-2 | Core flows broken |
| 3-4 | Happy path only or partially broken |
| 5-6 | Most flows work, several gaps remain |
| 7 | Every contract flow works |
| 8 | Flows work and handle obvious error states |
| 9 | Robust under messy user behavior |
| 10 | Production-ready behavior under evaluator pressure |

Automatic deductions:

- required flow unreachable -> cap at 4
- app does not start -> cap at 2
- criterion cannot be exercised live and no static alternative was contracted -> `UNVERIFIED`

## Preferred Evidence

- `screenshot`
- `console_check`
- `selector_assertion`
- `manual_observation`
- `git_diff_review`

## Scoring Rule

Any dimension without evidence must be treated as invalid. Any criterion marked `UNVERIFIED` fails the sprint.
