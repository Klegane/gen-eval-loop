import { z } from "zod";

import {
  DELIVERY_MODES,
  EXECUTION_MODES,
  GIT_MODES,
  QUALITY_PROFILES,
  SPRINT_DECISIONS,
  SPRINT_VERDICTS,
} from "../domain/run-types";
import { preflightReportSchema } from "./preflight";

const isoTimestampSchema = z.string().datetime({ offset: true });
const finalVerdictSchema = z.enum(["PASS", "FAIL", "ABORTED", "CAPPED", "PLANNED"]);

export const summarySprintSchema = z.object({
  sprint: z.number().int().positive(),
  decision: z.enum(SPRINT_DECISIONS),
  verdict: z.enum(SPRINT_VERDICTS),
  failedDimensions: z.array(z.string().min(1)),
  notes: z.array(z.string().min(1)),
});

export const summarySchema = z
  .object({
    runId: z.string().min(3),
    artifact: z.literal("summary"),
    qualityProfile: z.enum(QUALITY_PROFILES),
    executionMode: z.enum(EXECUTION_MODES),
    deliveryMode: z.enum(DELIVERY_MODES),
    gitMode: z.enum(GIT_MODES),
    model: z.string().min(1),
    status: z.literal("completed"),
    finalVerdict: finalVerdictSchema,
    totalSprints: z.number().int().nonnegative(),
    createdAt: isoTimestampSchema,
    updatedAt: isoTimestampSchema,
    requestSummary: z.string().min(1),
    sprintHistory: z.array(summarySprintSchema),
    latestPreflight: preflightReportSchema.optional(),
    finalVerdictReason: z.string().min(1),
    strongestEvidence: z.array(z.string().min(1)),
    residualRisks: z.array(z.string().min(1)),
    recommendedNextStep: z.string().min(1),
  })
  .superRefine((summary, ctx) => {
    if (summary.totalSprints !== summary.sprintHistory.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "totalSprints must match sprintHistory length.",
        path: ["totalSprints"],
      });
    }

    if (summary.finalVerdict === "PLANNED" && summary.executionMode !== "plan-only") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "PLANNED is only valid for plan-only runs.",
        path: ["finalVerdict"],
      });
    }

    if (summary.finalVerdict !== "PLANNED" && summary.executionMode === "plan-only") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Plan-only runs must use finalVerdict PLANNED.",
        path: ["finalVerdict"],
      });
    }
  });

export type SummaryInput = z.input<typeof summarySchema>;
export type SummaryData = z.output<typeof summarySchema>;
