import { describePlaywrightStep } from "../evidence/playwright-plan";
import type { ContractData } from "../schemas/contract";
import type { ReportData } from "../schemas/report";
import type { ScoreData } from "../schemas/score";
import type { SpecData } from "../schemas/spec";
import type { SummaryData } from "../schemas/summary";

type FrontmatterPrimitive = string | number | boolean;

function escapeYamlString(value: string): string {
  return JSON.stringify(value);
}

function renderFrontmatter(metadata: Record<string, FrontmatterPrimitive>): string {
  const lines = Object.entries(metadata).map(([key, value]) => {
    if (typeof value === "string") {
      return `${key}: ${escapeYamlString(value)}`;
    }

    return `${key}: ${String(value)}`;
  });

  return ["---", ...lines, "---"].join("\n");
}

function renderBulletList(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function renderOptionalBulletList(items: string[]): string {
  return items.length > 0 ? renderBulletList(items) : "- None";
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|");
}

export function renderSpecMarkdown(spec: SpecData): string {
  const frontmatter = renderFrontmatter({
    run_id: spec.runId,
    artifact: spec.artifact,
    quality_profile: spec.qualityProfile,
    execution_mode: spec.executionMode,
    delivery_mode: spec.deliveryMode,
    git_mode: spec.gitMode,
    model: spec.model,
    status: spec.status,
    created_at: spec.createdAt,
    updated_at: spec.updatedAt,
  });

  return `${frontmatter}

# Quality Spec

## Request
${spec.request}

## Vision
${spec.vision}

## Primary user and success moment
**Primary user:** ${spec.primaryUser}

**Success moment:** ${spec.successMoment}

## Quality intent
${spec.qualityIntent}

## Core functionality
${renderBulletList(spec.coreFunctionality)}

## Quality principles
${renderBulletList(spec.qualityPrinciples)}

## Constraints
${renderBulletList(spec.constraints)}

## Success criteria
${renderBulletList(spec.successCriteria)}

## Explicit non-goals
${renderBulletList(spec.nonGoals)}
`;
}

export function renderSummaryMarkdown(summary: SummaryData): string {
  const frontmatter = renderFrontmatter({
    run_id: summary.runId,
    artifact: summary.artifact,
    quality_profile: summary.qualityProfile,
    execution_mode: summary.executionMode,
    delivery_mode: summary.deliveryMode,
    git_mode: summary.gitMode,
    model: summary.model,
    status: summary.status,
    final_verdict: summary.finalVerdict,
    total_sprints: summary.totalSprints,
    created_at: summary.createdAt,
    updated_at: summary.updatedAt,
  });

  const sprintRows = summary.sprintHistory.length
    ? summary.sprintHistory
        .map((entry) => {
          const failed = entry.failedDimensions.length > 0 ? entry.failedDimensions.join(", ") : "None";
          const notes = entry.notes.length > 0 ? entry.notes.join("; ") : "None";
          return `| ${entry.sprint} | ${escapeCell(entry.decision)} | ${escapeCell(entry.verdict)} | ${escapeCell(failed)} | ${escapeCell(notes)} |`;
        })
        .join("\n")
    : "| None | None | None | None | None |";

  const latestPreflightSection =
    summary.latestPreflight == null
      ? ""
      : `
## Latest preflight
- status: \`${summary.latestPreflight.status}\`
- provider: \`${summary.latestPreflight.provider}\`
- profile: \`${summary.latestPreflight.profile}\`
- model: \`${summary.latestPreflight.model ?? "unknown"}\`
- runtime health: \`${summary.latestPreflight.runtimeHealth.overallStatus}\`
- provider health: \`${summary.latestPreflight.providerHealth?.status ?? "SKIPPED"}\`

### Blocking reasons
${renderOptionalBulletList(summary.latestPreflight.blockingReasons)}

### Remediation
${renderOptionalBulletList(summary.latestPreflight.remediation)}
`;

  return `${frontmatter}

# Run Summary

## Request summary
${summary.requestSummary}

## Run configuration
- quality profile: \`${summary.qualityProfile}\`
- execution mode: \`${summary.executionMode}\`
- delivery mode: \`${summary.deliveryMode}\`
- git mode: \`${summary.gitMode}\`
- model: \`${summary.model}\`

## Sprint history
| Sprint | Decision | Verdict | Failed dimensions | Notes |
|--------|----------|---------|-------------------|-------|
${sprintRows}

## Final verdict
${summary.finalVerdict}: ${summary.finalVerdictReason}
${latestPreflightSection}

## Strongest evidence
${renderOptionalBulletList(summary.strongestEvidence)}

## Residual risks
${renderOptionalBulletList(summary.residualRisks)}

## Recommended next step
${summary.recommendedNextStep}
`;
}

export function renderContractMarkdown(contract: ContractData): string {
  const frontmatter = renderFrontmatter({
    run_id: contract.runId,
    artifact: contract.artifact,
    sprint: contract.sprint,
    quality_profile: contract.qualityProfile,
    execution_mode: contract.executionMode,
    delivery_mode: contract.deliveryMode,
    git_mode: contract.gitMode,
    status: contract.status,
    decision: contract.decision,
    negotiation_round: contract.negotiationRound,
    generator_signed: contract.generatorSigned,
    evaluator_signed: contract.evaluatorSigned,
    created_at: contract.createdAt,
    updated_at: contract.updatedAt,
  });

  const criteriaRows = contract.criteria
    .map((criterion) => {
      const evidenceTypes = criterion.evidenceTypes.join(", ");
      const steps = criterion.verificationSteps.join("; ");
      return `| ${escapeCell(criterion.id)} | ${escapeCell(criterion.label)} | ${escapeCell(
        criterion.dimension,
      )} | ${criterion.threshold} | ${escapeCell(evidenceTypes)} | ${escapeCell(steps)} |`;
    })
    .join("\n");

  const playwrightSections = contract.criteria
    .filter((criterion) => criterion.playwright != null)
    .map((criterion) => {
      const steps = criterion.playwright?.steps.map((step) => `- ${describePlaywrightStep(step)}`).join("\n");
      return `### ${criterion.id}
- stop on failure: ${criterion.playwright?.stopOnFailure === false ? "false" : "true"}
${steps ?? "- No steps defined"}`;
    })
    .join("\n\n");

  return `${frontmatter}

# Sprint ${contract.sprint} Contract

## Strategic decision
${contract.decision}

## Scope
${renderBulletList(contract.scope)}

## Out of scope
${renderBulletList(contract.outOfScope)}

## Criteria
| ID | Criterion | Dimension | Threshold | Evidence types | Verification steps |
|----|-----------|-----------|-----------|----------------|--------------------|
${criteriaRows}

${playwrightSections.length === 0 ? "" : `\n## Playwright plan\n${playwrightSections}\n`}

## Verification checklist
${renderBulletList(contract.verificationChecklist)}

## Known constraints
${renderOptionalBulletList(contract.knownConstraints)}

## Signatures
- Generator: ${contract.generatorSigned ? "signed" : "pending"}
- Evaluator: ${contract.evaluatorSigned ? "signed" : "pending"}
`;
}

export function renderReportMarkdown(report: ReportData): string {
  const frontmatter = renderFrontmatter({
    run_id: report.runId,
    artifact: report.artifact,
    sprint: report.sprint,
    status: report.status,
    created_at: report.createdAt,
    updated_at: report.updatedAt,
  });

  const checkRows = report.selfCheck
    .map(
      (check) =>
        `| ${escapeCell(check.label)} | ${check.passed ? "PASS" : "FAIL"} | ${escapeCell(check.note)} |`,
    )
    .join("\n");

  return `${frontmatter}

# Sprint ${report.sprint} Report

## What I built
${renderBulletList(report.whatIBuilt)}

## Self-check against contract
| Check | Result | Note |
|-------|--------|------|
${checkRows}

## Change log
${renderBulletList(report.changeLog)}

## Known concerns
${renderOptionalBulletList(report.knownConcerns)}

## Files changed
${renderBulletList(report.filesChanged)}
`;
}

export function renderScoreMarkdown(score: ScoreData): string {
  const frontmatter = renderFrontmatter({
    run_id: score.runId,
    artifact: score.artifact,
    sprint: score.sprint,
    evaluation_mode: score.evaluationMode,
    verdict: score.verdict,
    created_at: score.createdAt,
    updated_at: score.updatedAt,
  });

  const criteriaRows = score.criteria
    .map((criterion) => {
      const evidence = criterion.evidenceRefs.length > 0 ? criterion.evidenceRefs.join(", ") : "None";
      return `| ${escapeCell(criterion.criterionId)} | ${escapeCell(criterion.dimension)} | ${
        criterion.score
      } | ${criterion.threshold} | ${escapeCell(criterion.status)} | ${escapeCell(evidence)} |`;
    })
    .join("\n");

  return `${frontmatter}

# Sprint ${score.sprint} Score

## Verdict summary
${score.verdict}

## Criteria table
| Criterion ID | Dimension | Score | Threshold | Status | Evidence |
|--------------|-----------|-------|-----------|--------|----------|
${criteriaRows}

## Blocking findings
${renderOptionalBulletList(score.blockingFindings)}

## Non-blocking observations
${renderOptionalBulletList(score.nonBlockingObservations)}

## Unverified claims
${renderOptionalBulletList(score.unverifiedClaims)}
`;
}
