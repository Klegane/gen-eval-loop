import { z } from "zod";

const isoTimestampSchema = z.string().datetime({ offset: true });

export const contractReviewStatusSchema = z.enum(["SIGNED", "CHANGES_REQUESTED"]);

export const contractReviewSchema = z
  .object({
    status: contractReviewStatusSchema,
    approved: z.boolean(),
    updatedAt: isoTimestampSchema,
    summary: z.string().min(1),
    requestedChanges: z.array(z.string().min(1)),
  })
  .superRefine((review, ctx) => {
    if (review.status === "SIGNED" && !review.approved) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SIGNED reviews must be approved.",
        path: ["approved"],
      });
    }

    if (review.status === "CHANGES_REQUESTED" && review.approved) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CHANGES_REQUESTED reviews cannot be approved.",
        path: ["approved"],
      });
    }

    if (review.status === "SIGNED" && review.requestedChanges.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SIGNED reviews cannot include requested changes.",
        path: ["requestedChanges"],
      });
    }

    if (review.status === "CHANGES_REQUESTED" && review.requestedChanges.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CHANGES_REQUESTED reviews must include at least one requested change.",
        path: ["requestedChanges"],
      });
    }
  });

export type ContractReviewInput = z.input<typeof contractReviewSchema>;
export type ContractReviewData = z.output<typeof contractReviewSchema>;
