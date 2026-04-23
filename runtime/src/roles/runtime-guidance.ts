import type { RunRecordData } from "../schemas/run";

export function buildRuntimeSchemaGuidance(run: RunRecordData): string {
  const browserEvidenceNote =
    run.playwrightAvailable
      ? "Playwright is available. For ui profile, screenshot, console_check, and selector_assertion are allowed when they fit the contract."
      : "Playwright is NOT available. Do not require screenshot, console_check, or selector_assertion evidence. Any browser-only criterion would be invalid in this run.";

  return [
    "Runtime schema guidance:",
    "- The runtime JSON schema is canonical. If markdown docs and schema wording differ, follow the runtime schema.",
    "- Contract objects use `decision`, not `strategic_decision`.",
    "- Contract objects use `generatorSigned` and `evaluatorSigned`.",
    "- Report objects do not include `files_changed_count` or `git_mode` fields unless the runtime schema explicitly defines them.",
    "- Evidence objects use `runId`, `sprint`, `evaluationMode`, `criteria`, and `infraFailures`.",
    "- Score and evidence must stay aligned on runId and sprint.",
    `- qualityProfile=${run.qualityProfile}, executionMode=${run.executionMode}, deliveryMode=${run.deliveryMode}, gitMode=${run.gitMode}.`,
    `- playwrightAvailable=${String(run.playwrightAvailable)}.`,
    `- ${browserEvidenceNote}`,
  ].join("\n");
}

export function buildPlannerGuidance(run: RunRecordData): string {
  return [
    buildRuntimeSchemaGuidance(run),
    "Planner-specific guidance:",
    "- Prefer `status: ready` unless the request is truly too ambiguous to produce auditable criteria.",
    "- If you use `status: draft`, the run should not proceed to contract drafting without more context.",
  ].join("\n");
}

export function buildGeneratorGuidance(run: RunRecordData): string {
  return [
    buildRuntimeSchemaGuidance(run),
    "Generator-specific guidance:",
    "- Draft contracts that the runtime can actually evaluate with the available tooling.",
    "- Keep the contract cohesive and avoid criteria that contradict the declared scope.",
    "- For ui runs without Playwright, do not fake browser evidence or visual verification steps.",
    "- For Playwright plans, use relative URLs such as `/` or `/index.html`, not `file://` URLs. The controller may provide a local baseUrl at evaluation time.",
    "- Do not require HTTP 200 checks for a raw file URL workflow. If you need HTTP-style checks, assume the controller serves the target over local HTTP.",
  ].join("\n");
}

export function buildEvaluatorGuidance(run: RunRecordData): string {
  return [
    buildRuntimeSchemaGuidance(run),
    "Evaluator-specific guidance:",
    "- Reject contracts that demand evidence the runtime cannot collect.",
    "- Reject contracts if spec.status is not `ready` for a full-loop implementation sprint.",
    "- Prefer specific requested changes over generic criticism.",
  ].join("\n");
}
