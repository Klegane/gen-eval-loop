import { z } from "zod";

import {
  DELIVERY_MODES,
  EVIDENCE_TYPES,
  EXECUTION_MODES,
  GIT_MODES,
  QUALITY_PROFILES,
  SPRINT_DECISIONS,
} from "../domain/run-types";
import { playwrightCriterionPlanSchema } from "../evidence/playwright-plan";

const isoTimestampSchema = z.string().datetime({ offset: true });

export const contractStatusSchema = z.enum(["drafted", "signed"]);

export const contractCriterionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  dimension: z.string().min(1),
  threshold: z.number().min(0).max(10),
  evidenceTypes: z.array(z.enum(EVIDENCE_TYPES)).min(1),
  verificationSteps: z.array(z.string().min(1)).min(1),
  playwright: playwrightCriterionPlanSchema.optional(),
});

export const contractSchema = z
  .object({
    runId: z.string().min(3),
    artifact: z.literal("contract"),
    sprint: z.number().int().positive(),
    qualityProfile: z.enum(QUALITY_PROFILES),
    executionMode: z.enum(EXECUTION_MODES),
    deliveryMode: z.enum(DELIVERY_MODES),
    gitMode: z.enum(GIT_MODES),
    status: contractStatusSchema,
    decision: z.enum(SPRINT_DECISIONS),
    negotiationRound: z.number().int().positive(),
    generatorSigned: z.boolean(),
    evaluatorSigned: z.boolean(),
    createdAt: isoTimestampSchema,
    updatedAt: isoTimestampSchema,
    scope: z.array(z.string().min(1)).min(1),
    outOfScope: z.array(z.string().min(1)).min(1),
    criteria: z.array(contractCriterionSchema).min(1),
    verificationChecklist: z.array(z.string().min(1)).min(1),
    knownConstraints: z.array(z.string().min(1)),
  })
  .superRefine((contract, ctx) => {
    if (contract.status === "signed" && (!contract.generatorSigned || !contract.evaluatorSigned)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A signed contract requires both signatures.",
        path: ["status"],
      });
    }

    const criterionIds = contract.criteria.map((criterion) => criterion.id);
    if (new Set(criterionIds).size !== criterionIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Contract criterion ids must be unique.",
        path: ["criteria"],
      });
    }
  });

export type ContractInput = z.input<typeof contractSchema>;
export type ContractData = z.output<typeof contractSchema>;
