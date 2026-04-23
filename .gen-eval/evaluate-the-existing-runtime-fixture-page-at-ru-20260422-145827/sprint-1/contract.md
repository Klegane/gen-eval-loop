---
run_id: "evaluate-the-existing-runtime-fixture-page-at-ru-20260422-145827"
artifact: "contract"
sprint: 1
quality_profile: "ui"
execution_mode: "full-loop"
delivery_mode: "single-pass"
git_mode: "workspace-mode"
status: "drafted"
decision: "initial"
negotiation_round: 1
generator_signed: true
evaluator_signed: false
created_at: "2026-04-22T14:58:27Z"
updated_at: "2026-04-22T14:58:27Z"
---

# Sprint 1 Contract

## Strategic decision
initial

## Scope
- Verify the existing fixture page at runtime/fixtures/playwright-smoke/index.html loads without errors
- Confirm main content is visible and rendered correctly
- Validate console remains clean with no JavaScript errors or warnings
- Check page has a valid document title
- Verify no layout shifts or broken images on initial render

## Out of scope
- Modifying or enhancing the fixture page implementation
- Adding new features or content
- Styling improvements or design changes
- Testing dynamic behavior or user interactions beyond initial load
- Evaluating navigation or multi-page flows

## Criteria
| ID | Criterion | Dimension | Threshold | Evidence types | Verification steps |
|----|-----------|-----------|-----------|----------------|--------------------|
| page-loads-clean | Page loads with HTTP 200 and no network errors | Functionality | 7 | screenshot, console_check | Navigate to the fixture page using Playwright; Verify HTTP response status is 200; Check console for network errors; Capture screenshot of loaded state |
| content-visible | Main content element is present and rendered | Functionality | 7 | selector_assertion, screenshot | Wait for page load; Assert at least one main content selector exists; Verify element is visible; Capture screenshot showing rendered content |
| console-clean | Console has zero errors or warnings on initial load | Craft | 7 | console_check | Navigate to page with console monitoring active; Check for any error-level console messages; Check for any warning-level console messages; Report findings |
| valid-title | Page has a non-empty document title | Craft | 7 | selector_assertion, manual_observation | Load page; Check document title is present and non-empty; Record title value |
| no-broken-images | No broken images or missing resources on initial render | Craft | 7 | console_check, screenshot | Load page; Monitor network requests for 404 or failed image loads; Check console for resource load errors; Capture screenshot for visual verification |


## Playwright plan
### page-loads-clean
- stop on failure: true
- goto file://runtime/fixtures/playwright-smoke/index.html (load)
- check console error
- screenshot page-loaded (full page)

### content-visible
- stop on failure: true
- goto file://runtime/fixtures/playwright-smoke/index.html (load)
- wait for body (visible)
- assert body * min=1
- screenshot content-visible (full page)

### console-clean
- stop on failure: false
- goto file://runtime/fixtures/playwright-smoke/index.html (domcontentloaded)
- check console error
- check console warning

### valid-title
- stop on failure: false
- goto file://runtime/fixtures/playwright-smoke/index.html (load)
- assert title min=1

### no-broken-images
- stop on failure: false
- goto file://runtime/fixtures/playwright-smoke/index.html (networkidle)
- check console error
- screenshot no-broken-resources (full page)


## Verification checklist
- Navigate to runtime/fixtures/playwright-smoke/index.html using Playwright
- Verify page loads with HTTP 200
- Confirm at least one visible content element exists
- Check console log for zero errors
- Check console log for zero warnings
- Verify page has a document title
- Check for broken images or 404 network errors
- Capture screenshots documenting each verification step
- Review all evidence before claiming completion

## Known constraints
- Must evaluate existing fixture as-is without modifications
- Limited to file:// protocol access for local HTML file
- No product context beyond fixture file contents
- Must use Playwright for all verification steps
- Evidence types restricted to screenshot, console_check, and selector_assertion
- Single-pass delivery mode requires complete verification in one sprint

## Signatures
- Generator: signed
- Evaluator: pending
