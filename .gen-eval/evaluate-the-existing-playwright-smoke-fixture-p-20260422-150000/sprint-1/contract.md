---
run_id: "evaluate-the-existing-playwright-smoke-fixture-p-20260422-150000"
artifact: "contract"
sprint: 1
quality_profile: "ui"
execution_mode: "full-loop"
delivery_mode: "single-pass"
git_mode: "workspace-mode"
status: "signed"
decision: "initial"
negotiation_round: 1
generator_signed: true
evaluator_signed: true
created_at: "2026-04-22T15:00:00Z"
updated_at: "2026-04-22T15:00:00Z"
---

# Sprint 1 Contract

## Strategic decision
initial

## Scope
- Load the smoke fixture page at / via local HTTP and verify it returns a successful response
- Confirm the headline text 'Evidence runner ready' is present in the DOM and visible
- Capture console output during page load and verify zero errors
- Capture console output during page load and verify zero warnings
- Capture a screenshot of the loaded page as visual evidence
- Produce evidence artifacts using Playwright screenshot and console_check types

## Out of scope
- Modifying the smoke fixture page HTML, CSS, or JavaScript
- Evaluating the design quality, originality, or craft of the fixture page
- Testing interaction flows, user input, or navigation beyond the initial page load
- Assessing server configuration, network infrastructure, or deployment concerns
- Inventing new product requirements or expanding the fixture functionality

## Criteria
| ID | Criterion | Dimension | Threshold | Evidence types | Verification steps |
|----|-----------|-----------|-----------|----------------|--------------------|
| load-success | Smoke fixture page loads successfully at / | Functionality | 7 | screenshot, selector_assertion | Navigate to / using Playwright; Wait for the page to reach the 'load' or 'domcontentloaded' state; Capture a screenshot to confirm the page rendered; Assert that the page loaded without navigation errors |
| headline-visible | Headline 'Evidence runner ready' is present and visible | Functionality | 7 | selector_assertion, screenshot | Locate the headline element containing the text 'Evidence runner ready'; Assert the element is attached to the DOM; Assert the element is visible to the user; Capture a screenshot showing the headline in context |
| console-no-errors | Console contains zero errors during page load | Craft | 7 | console_check | Monitor console output during page load; Filter for messages with level 'error'; Assert that zero error-level messages were logged |
| console-no-warnings | Console contains zero warnings during page load | Craft | 7 | console_check | Monitor console output during page load; Filter for messages with level 'warning'; Assert that zero warning-level messages were logged |


## Playwright plan
### load-success
- stop on failure: true
- goto / (load)
- screenshot smoke-fixture-loaded (full page)

### headline-visible
- stop on failure: true
- wait for text=Evidence runner ready (visible)
- assert text=Evidence runner ready min=1 max=1
- screenshot headline-visible

### console-no-errors
- stop on failure: true
- goto / (load)
- check console error

### console-no-warnings
- stop on failure: true
- goto / (load)
- check console warning


## Verification checklist
- Confirm Playwright can navigate to / via the local HTTP server provided by the controller
- Verify the page load completes without navigation errors
- Confirm the headline text 'Evidence runner ready' is present in the DOM
- Confirm the headline is visible (not hidden or off-screen)
- Capture and review console output for error-level messages during page load
- Capture and review console output for warning-level messages during page load
- Collect screenshot evidence of the loaded page
- Collect screenshot evidence of the visible headline
- Ensure all evidence artifacts reference the correct criterion IDs
- Confirm all evidence types used (screenshot, console_check, selector_assertion) are valid for the ui profile

## Known constraints
- Must use relative URLs only; the controller provides the local HTTP server and baseUrl
- Must not modify the smoke fixture page or invent new product requirements
- Evidence collection is limited to Playwright-based methods available in the ui profile
- Console checks are strict: any error or warning message will cause the criterion to fail
- The evaluation is a meta-quality check of the Playwright infrastructure, not a product quality assessment

## Signatures
- Generator: signed
- Evaluator: signed
