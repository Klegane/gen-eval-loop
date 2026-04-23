import { z } from "zod";

import {
  DELIVERY_MODES,
  EXECUTION_MODES,
  GIT_MODES,
  QUALITY_PROFILES,
} from "../domain/run-types";

const isoTimestampSchema = z.string().datetime({ offset: true });

export const specStatusSchema = z.enum(["draft", "ready"]);

export const specSchema = z.object({
  runId: z.string().min(3),
  artifact: z.literal("spec"),
  qualityProfile: z.enum(QUALITY_PROFILES),
  executionMode: z.enum(EXECUTION_MODES),
  deliveryMode: z.enum(DELIVERY_MODES),
  gitMode: z.enum(GIT_MODES),
  model: z.string().min(1),
  status: specStatusSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
  request: z.string().min(1),
  vision: z.string().min(1),
  primaryUser: z.string().min(1),
  successMoment: z.string().min(1),
  qualityIntent: z.string().min(1),
  coreFunctionality: z.array(z.string().min(1)).min(1),
  qualityPrinciples: z.array(z.string().min(1)).min(1),
  constraints: z.array(z.string().min(1)),
  successCriteria: z.array(z.string().min(1)).min(1),
  nonGoals: z.array(z.string().min(1)).min(1),
});

export type SpecInput = z.input<typeof specSchema>;
export type SpecData = z.output<typeof specSchema>;
