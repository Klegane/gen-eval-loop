import { z } from "zod";

import {
  PREFLIGHT_STATUSES,
  PROVIDER_HEALTH_ERROR_CATEGORIES,
  PROVIDER_HEALTH_STATUSES,
  QUALITY_PROFILES,
  RUNTIME_HEALTH_STATUSES,
} from "../domain/run-types";
import { ADAPTER_PROVIDERS } from "../roles/adapter-factory";

const isoTimestampSchema = z.string().datetime({ offset: true });
const providerSchema = z.enum(ADAPTER_PROVIDERS);

export const runtimeHealthCheckSchema = z.object({
  id: z.string().min(1),
  status: z.enum(RUNTIME_HEALTH_STATUSES),
  summary: z.string().min(1),
  details: z.array(z.string()),
  remediation: z.array(z.string()),
});

export const runtimeHealthReportSchema = z.object({
  generatedAt: isoTimestampSchema,
  provider: providerSchema,
  profile: z.enum(QUALITY_PROFILES),
  overallStatus: z.enum(RUNTIME_HEALTH_STATUSES),
  checks: z.array(runtimeHealthCheckSchema),
});

export const providerHealthErrorSchema = z.object({
  category: z.enum(PROVIDER_HEALTH_ERROR_CATEGORIES),
  message: z.string().min(1),
  remediation: z.array(z.string()),
});

export const providerHealthOutputSchema = z
  .object({
    status: z.literal("ok"),
    providerEcho: z.string().min(1),
    message: z.string().min(1),
  })
  .strict();

export const providerHealthReportSchema = z
  .object({
    generatedAt: isoTimestampSchema,
    provider: providerSchema,
    model: z.string().nullable(),
    adapterName: z.string().min(1),
    status: z.enum(PROVIDER_HEALTH_STATUSES),
    roundTripMs: z.number().int().nonnegative(),
    output: providerHealthOutputSchema.optional(),
    error: providerHealthErrorSchema.optional(),
  })
  .superRefine((report, ctx) => {
    if (report.status === "PASS" && report.output == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A passing provider health report must include output.",
        path: ["output"],
      });
    }

    if (report.status === "FAIL" && report.error == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A failing provider health report must include an error.",
        path: ["error"],
      });
    }
  });

export const preflightReportSchema = z
  .object({
    status: z.enum(PREFLIGHT_STATUSES),
    provider: providerSchema,
    profile: z.enum(QUALITY_PROFILES),
    model: z.string().nullable(),
    runtimeHealth: runtimeHealthReportSchema,
    providerHealth: providerHealthReportSchema.optional(),
    blockingReasons: z.array(z.string().min(1)),
    remediation: z.array(z.string().min(1)),
  })
  .superRefine((report, ctx) => {
    if (report.status === "FAIL" && report.blockingReasons.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A failing preflight report must include at least one blocking reason.",
        path: ["blockingReasons"],
      });
    }

    if (report.provider !== report.runtimeHealth.provider) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "runtimeHealth.provider must match preflight provider.",
        path: ["runtimeHealth", "provider"],
      });
    }

    if (report.profile !== report.runtimeHealth.profile) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "runtimeHealth.profile must match preflight profile.",
        path: ["runtimeHealth", "profile"],
      });
    }

    if (report.providerHealth != null && report.providerHealth.provider !== report.provider) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "providerHealth.provider must match preflight provider.",
        path: ["providerHealth", "provider"],
      });
    }
  });

export type PreflightReportInput = z.input<typeof preflightReportSchema>;
export type PreflightReportData = z.output<typeof preflightReportSchema>;
