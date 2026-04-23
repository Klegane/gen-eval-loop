import { z } from "zod";

const isoTimestampSchema = z.string().datetime({ offset: true });

export const reportStatusSchema = z.enum(["done", "done_with_concerns", "blocked", "needs_context"]);

export const reportCheckSchema = z.object({
  label: z.string().min(1),
  passed: z.boolean(),
  note: z.string().min(1),
});

export const reportSchema = z.object({
  runId: z.string().min(3),
  artifact: z.literal("report"),
  sprint: z.number().int().positive(),
  status: reportStatusSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
  whatIBuilt: z.array(z.string().min(1)).min(1),
  selfCheck: z.array(reportCheckSchema).min(1),
  changeLog: z.array(z.string().min(1)).min(1),
  knownConcerns: z.array(z.string().min(1)),
  filesChanged: z.array(z.string().min(1)).min(1),
});

export type ReportInput = z.input<typeof reportSchema>;
export type ReportData = z.output<typeof reportSchema>;
