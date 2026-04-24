export const QUALITY_PROFILES = ["ui", "backend", "agentic", "content"] as const;

export const EXECUTION_MODES = ["full-loop", "plan-only", "evaluate-only"] as const;

export const DELIVERY_MODES = ["single-pass", "short-sprint"] as const;

export const GIT_MODES = ["workspace-mode", "commit-mode"] as const;

export const RUN_STATUSES = [
  "initialized",
  "spec_ready",
  "contract_drafted",
  "contract_signed",
  "implemented",
  "evaluated",
  "passed",
  "failed",
  "aborted",
  "capped",
  "completed",
] as const;

export const SPRINT_DECISIONS = ["initial", "refine", "pivot"] as const;

export const SPRINT_STATES = [
  "contract_drafted",
  "contract_signed",
  "implemented",
  "evaluated",
] as const;

export const SPRINT_VERDICTS = ["PASS", "FAIL", "INFRA_FAIL"] as const;

export const SCORE_CRITERION_STATUSES = ["PASS", "FAIL", "UNVERIFIED"] as const;

export const EVALUATION_MODES = ["live", "static-fallback", "command-only"] as const;

export const EVIDENCE_TYPES = [
  "screenshot",
  "console_check",
  "selector_assertion",
  "http_check",
  "db_check",
  "log_extract",
  "command_output",
  "git_diff_review",
  "manual_observation",
] as const;

export const RUNTIME_HEALTH_STATUSES = ["PASS", "WARN", "FAIL"] as const;

export const PROVIDER_HEALTH_STATUSES = ["PASS", "FAIL"] as const;

export const PREFLIGHT_STATUSES = ["PASS", "FAIL"] as const;

export const PROVIDER_HEALTH_ERROR_CATEGORIES = [
  "AUTH",
  "BILLING",
  "TIMEOUT",
  "NETWORK",
  "CONFIG",
  "UNKNOWN",
] as const;

export type QualityProfile = (typeof QUALITY_PROFILES)[number];
export type ExecutionMode = (typeof EXECUTION_MODES)[number];
export type DeliveryMode = (typeof DELIVERY_MODES)[number];
export type GitMode = (typeof GIT_MODES)[number];
export type RunStatus = (typeof RUN_STATUSES)[number];
export type SprintDecision = (typeof SPRINT_DECISIONS)[number];
export type SprintState = (typeof SPRINT_STATES)[number];
export type SprintVerdict = (typeof SPRINT_VERDICTS)[number];
export type ScoreCriterionStatus = (typeof SCORE_CRITERION_STATUSES)[number];
export type EvaluationMode = (typeof EVALUATION_MODES)[number];
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];
export type RuntimeHealthStatus = (typeof RUNTIME_HEALTH_STATUSES)[number];
export type ProviderHealthStatus = (typeof PROVIDER_HEALTH_STATUSES)[number];
export type PreflightStatus = (typeof PREFLIGHT_STATUSES)[number];
export type ProviderHealthErrorCategory = (typeof PROVIDER_HEALTH_ERROR_CATEGORIES)[number];

export interface RuntimeHealthCheck {
  id: string;
  status: RuntimeHealthStatus;
  summary: string;
  details: string[];
  remediation: string[];
}

export interface RuntimeHealthReport {
  generatedAt: string;
  provider: "development" | "openai" | "anthropic" | "claude-cli";
  profile: QualityProfile;
  overallStatus: RuntimeHealthStatus;
  checks: RuntimeHealthCheck[];
}

export interface ProviderHealthError {
  category: ProviderHealthErrorCategory;
  message: string;
  remediation: string[];
}

export interface ProviderHealthOutput {
  status: "ok";
  providerEcho: string;
  message: string;
}

export interface ProviderHealthReport {
  generatedAt: string;
  provider: "development" | "openai" | "anthropic" | "claude-cli";
  model: string | null;
  adapterName: string;
  status: ProviderHealthStatus;
  roundTripMs: number;
  output?: ProviderHealthOutput | undefined;
  error?: ProviderHealthError | undefined;
}

export interface PreflightReport {
  status: PreflightStatus;
  provider: "development" | "openai" | "anthropic" | "claude-cli";
  profile: QualityProfile;
  model: string | null;
  runtimeHealth: RuntimeHealthReport;
  providerHealth?: ProviderHealthReport | undefined;
  blockingReasons: string[];
  remediation: string[];
}

export interface SprintArtifactPaths {
  contractJson?: string | undefined;
  reportJson?: string | undefined;
  scoreJson?: string | undefined;
  evidenceJson?: string | undefined;
  screenshotsDir?: string | undefined;
  contractMarkdown?: string | undefined;
  reportMarkdown?: string | undefined;
  scoreMarkdown?: string | undefined;
}

export interface SprintRecord {
  sprint: number;
  decision: SprintDecision;
  state: SprintState;
  verdict?: SprintVerdict | undefined;
  failedCriteria: string[];
  artifactPaths: SprintArtifactPaths;
}

export interface RunRecord {
  runId: string;
  requestPrompt: string;
  status: RunStatus;
  qualityProfile: QualityProfile;
  executionMode: ExecutionMode;
  deliveryMode: DeliveryMode;
  gitMode: GitMode;
  model: string;
  playwrightAvailable: boolean;
  currentSprint: number;
  sprintCap: number;
  lastCompletedState: RunStatus;
  createdAt: string;
  updatedAt: string;
  preflightHistory: PreflightReport[];
  sprints: SprintRecord[];
}

export interface TransitionContext {
  hasSpec?: boolean;
  hasContract?: boolean;
  hasSignedContract?: boolean;
  hasReport?: boolean;
  hasScore?: boolean;
  hasEvidence?: boolean;
  everyCriterionPassed?: boolean;
  hasUnverifiedCriteria?: boolean;
  capReached?: boolean;
}

export interface TransitionInput {
  from: RunStatus;
  to: RunStatus;
  context?: TransitionContext;
}
