import {
  type RunRecord,
  type RunStatus,
  type TransitionContext,
  type TransitionInput,
  RUN_STATUSES,
} from "./run-types";

export class InvalidRunTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidRunTransitionError";
  }
}

export const ACTIVE_RUN_STATUSES: readonly RunStatus[] = [
  "initialized",
  "spec_ready",
  "contract_drafted",
  "contract_signed",
  "implemented",
  "evaluated",
  "failed",
];

export const VALID_TRANSITIONS: Readonly<Record<RunStatus, readonly RunStatus[]>> = {
  initialized: ["spec_ready", "aborted", "capped"],
  spec_ready: ["contract_drafted", "aborted", "capped"],
  contract_drafted: ["contract_signed", "aborted", "capped"],
  contract_signed: ["implemented", "evaluated", "completed", "aborted", "capped"],
  implemented: ["evaluated", "aborted", "capped"],
  evaluated: ["passed", "failed", "aborted", "capped"],
  passed: ["completed"],
  failed: ["contract_drafted", "aborted", "capped"],
  aborted: ["completed"],
  capped: ["completed"],
  completed: [],
};

const REQUIRED_CONTEXT: Partial<Record<RunStatus, ReadonlyArray<keyof TransitionContext>>> = {
  spec_ready: ["hasSpec"],
  contract_drafted: ["hasContract"],
  contract_signed: ["hasSignedContract"],
  implemented: ["hasReport"],
  evaluated: ["hasScore", "hasEvidence"],
  passed: ["everyCriterionPassed"],
  failed: [],
  completed: [],
};

export function isRunStatus(value: string): value is RunStatus {
  return (RUN_STATUSES as readonly string[]).includes(value);
}

export function isActiveRunStatus(status: RunStatus): boolean {
  return ACTIVE_RUN_STATUSES.includes(status);
}

export function canTransition(from: RunStatus, to: RunStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function getRequiredContextFor(target: RunStatus): ReadonlyArray<keyof TransitionContext> {
  return REQUIRED_CONTEXT[target] ?? [];
}

export function assertTransition(input: TransitionInput): void {
  const { from, to, context = {} } = input;

  if (!canTransition(from, to)) {
    throw new InvalidRunTransitionError(`Invalid run transition: ${from} -> ${to}`);
  }

  if (to === "failed" && !context.hasUnverifiedCriteria && context.everyCriterionPassed) {
    throw new InvalidRunTransitionError(
      "A run cannot move to failed when all evaluation criteria passed.",
    );
  }

  if (to === "passed" && context.hasUnverifiedCriteria) {
    throw new InvalidRunTransitionError(
      "A run cannot move to passed while any criterion remains unverified.",
    );
  }

  if (to === "capped" && !context.capReached) {
    throw new InvalidRunTransitionError("A run cannot move to capped before the sprint cap is hit.");
  }

  for (const field of getRequiredContextFor(to)) {
    if (context[field] !== true) {
      throw new InvalidRunTransitionError(
        `Transition ${from} -> ${to} requires context field "${field}" to be true.`,
      );
    }
  }
}

export function applyTransition(
  run: RunRecord,
  to: RunStatus,
  context: TransitionContext = {},
  updatedAt: string = new Date().toISOString(),
): RunRecord {
  assertTransition({ from: run.status, to, context });

  return {
    ...run,
    status: to,
    lastCompletedState: to,
    updatedAt,
  };
}

export function getNextEvaluationStatus(context: TransitionContext): Extract<RunStatus, "passed" | "failed"> {
  if (context.hasUnverifiedCriteria) {
    return "failed";
  }

  return context.everyCriterionPassed ? "passed" : "failed";
}

export function assertEvaluationContext(context: TransitionContext): void {
  if (context.hasScore !== true || context.hasEvidence !== true) {
    throw new InvalidRunTransitionError(
      "Evaluation requires both score and evidence artefacts before verdict resolution.",
    );
  }
}
