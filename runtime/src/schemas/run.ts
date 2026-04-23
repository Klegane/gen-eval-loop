import { z } from "zod";

import {
  DELIVERY_MODES,
  EXECUTION_MODES,
  GIT_MODES,
  QUALITY_PROFILES,
  RUN_STATUSES,
  SPRINT_DECISIONS,
  SPRINT_STATES,
  SPRINT_VERDICTS,
} from "../domain/run-types";
import { preflightReportSchema } from "./preflight";

const isoTimestampSchema = z.string().datetime({ offset: true });

const artifactPathsSchema = z.object({
  contractJson: z.string().min(1).optional(),
  reportJson: z.string().min(1).optional(),
  scoreJson: z.string().min(1).optional(),
  evidenceJson: z.string().min(1).optional(),
  screenshotsDir: z.string().min(1).optional(),
  contractMarkdown: z.string().min(1).optional(),
  reportMarkdown: z.string().min(1).optional(),
  scoreMarkdown: z.string().min(1).optional(),
});

export const sprintRecordSchema = z.object({
  sprint: z.number().int().positive(),
  decision: z.enum(SPRINT_DECISIONS),
  state: z.enum(SPRINT_STATES),
  verdict: z.enum(SPRINT_VERDICTS).optional(),
  failedCriteria: z.array(z.string().min(1)),
  artifactPaths: artifactPathsSchema,
});

export const runRecordSchema = z
  .object({
    runId: z.string().min(3),
    requestPrompt: z.string().min(1),
    status: z.enum(RUN_STATUSES),
    qualityProfile: z.enum(QUALITY_PROFILES),
    executionMode: z.enum(EXECUTION_MODES),
    deliveryMode: z.enum(DELIVERY_MODES),
    gitMode: z.enum(GIT_MODES),
    model: z.string().min(1),
    playwrightAvailable: z.boolean(),
    currentSprint: z.number().int().nonnegative(),
    sprintCap: z.number().int().positive(),
    lastCompletedState: z.enum(RUN_STATUSES),
    createdAt: isoTimestampSchema,
    updatedAt: isoTimestampSchema,
    preflightHistory: z.array(preflightReportSchema).default([]),
    sprints: z.array(sprintRecordSchema),
  })
  .superRefine((run, ctx) => {
    const sprintNumbers = run.sprints.map((sprint) => sprint.sprint);
    const uniqueSprintCount = new Set(sprintNumbers).size;

    if (uniqueSprintCount !== sprintNumbers.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Sprint numbers must be unique.",
        path: ["sprints"],
      });
    }

    if (run.sprints.length === 0 && run.currentSprint !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "currentSprint must be 0 when no sprint records exist.",
        path: ["currentSprint"],
      });
    }

    if (run.sprints.length > 0) {
      const sorted = [...sprintNumbers].sort((left, right) => left - right);
      const lastSprint = sorted[sorted.length - 1];

      if (lastSprint !== run.currentSprint) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "currentSprint must match the highest recorded sprint number.",
          path: ["currentSprint"],
        });
      }

      if (sorted.some((value, index) => value !== index + 1)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Sprint numbers must be contiguous starting at 1.",
          path: ["sprints"],
        });
      }
    }

    if (run.currentSprint > run.sprintCap) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "currentSprint cannot exceed sprintCap.",
        path: ["currentSprint"],
      });
    }

    if (run.status === "initialized" && run.sprints.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "An initialized run cannot already contain sprint history.",
        path: ["sprints"],
      });
    }

    if (run.lastCompletedState !== run.status) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "lastCompletedState must match the persisted run status snapshot.",
        path: ["lastCompletedState"],
      });
    }

    for (const sprint of run.sprints) {
      if (sprint.state === "evaluated" && sprint.verdict == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "An evaluated sprint must include a verdict.",
          path: ["sprints", sprint.sprint - 1, "verdict"],
        });
      }

      if (sprint.verdict === "PASS" && sprint.failedCriteria.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A passing sprint cannot list failed criteria.",
          path: ["sprints", sprint.sprint - 1, "failedCriteria"],
        });
      }
    }
  });

export type RunRecordInput = z.input<typeof runRecordSchema>;
export type RunRecordData = z.output<typeof runRecordSchema>;
