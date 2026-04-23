import { z } from "zod";

import { EVALUATION_MODES, EVIDENCE_TYPES, SCORE_CRITERION_STATUSES } from "../domain/run-types";

export const evidenceItemSchema = z.object({
  type: z.enum(EVIDENCE_TYPES),
  path: z.string().min(1).optional(),
  value: z.string().min(1).optional(),
  note: z.string().min(1),
});

export const evidenceCriterionSchema = z
  .object({
    criterionId: z.string().min(1),
    status: z.enum(SCORE_CRITERION_STATUSES),
    evidence: z.array(evidenceItemSchema),
  })
  .superRefine((criterion, ctx) => {
    if (criterion.status !== "UNVERIFIED" && criterion.evidence.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Verified criteria must include at least one evidence item.",
        path: ["evidence"],
      });
    }
  });

export const evidenceSchema = z.object({
  runId: z.string().min(3),
  sprint: z.number().int().positive(),
  evaluationMode: z.enum(EVALUATION_MODES),
  criteria: z.array(evidenceCriterionSchema).min(1),
  infraFailures: z.array(z.string().min(1)),
});

export type EvidenceInput = z.input<typeof evidenceSchema>;
export type EvidenceData = z.output<typeof evidenceSchema>;
