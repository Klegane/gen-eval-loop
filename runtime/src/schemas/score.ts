import { z } from "zod";

import { EVALUATION_MODES, SCORE_CRITERION_STATUSES } from "../domain/run-types";

const isoTimestampSchema = z.string().datetime({ offset: true });
const scoreVerdictSchema = z.enum(["PASS", "FAIL"]);

export const scoreCriterionSchema = z.object({
  criterionId: z.string().min(1),
  dimension: z.string().min(1),
  score: z.number().min(0).max(10),
  threshold: z.number().min(0).max(10),
  status: z.enum(SCORE_CRITERION_STATUSES),
  evidenceRefs: z.array(z.string().min(1)),
});

export const scoreSchema = z
  .object({
    runId: z.string().min(3),
    artifact: z.literal("score"),
    sprint: z.number().int().positive(),
    evaluationMode: z.enum(EVALUATION_MODES),
    verdict: scoreVerdictSchema,
    createdAt: isoTimestampSchema,
    updatedAt: isoTimestampSchema,
    criteria: z.array(scoreCriterionSchema).min(1),
    blockingFindings: z.array(z.string().min(1)),
    nonBlockingObservations: z.array(z.string().min(1)),
    unverifiedClaims: z.array(z.string().min(1)),
  })
  .superRefine((score, ctx) => {
    const criterionIds = score.criteria.map((criterion) => criterion.criterionId);

    if (new Set(criterionIds).size !== criterionIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Score criterion ids must be unique.",
        path: ["criteria"],
      });
    }

    const hasFailures = score.criteria.some(
      (criterion) => criterion.status === "FAIL" || criterion.status === "UNVERIFIED",
    );

    if (score.verdict === "PASS" && hasFailures) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A PASS score cannot contain failing or unverified criteria.",
        path: ["verdict"],
      });
    }
  });

export type ScoreInput = z.input<typeof scoreSchema>;
export type ScoreData = z.output<typeof scoreSchema>;
