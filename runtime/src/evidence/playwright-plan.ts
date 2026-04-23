import { z } from "zod";

export const PLAYWRIGHT_BROWSERS = ["chromium", "firefox", "webkit"] as const;
export const PLAYWRIGHT_WAIT_UNTIL = ["load", "domcontentloaded", "networkidle", "commit"] as const;
export const PLAYWRIGHT_SELECTOR_STATES = ["attached", "detached", "visible", "hidden"] as const;
export const PLAYWRIGHT_CONSOLE_LEVELS = ["error", "warning"] as const;

export const playwrightGotoStepSchema = z.object({
  type: z.literal("goto"),
  url: z.string().min(1),
  waitUntil: z.enum(PLAYWRIGHT_WAIT_UNTIL).optional(),
});

export const playwrightClickStepSchema = z.object({
  type: z.literal("click"),
  selector: z.string().min(1),
});

export const playwrightFillStepSchema = z.object({
  type: z.literal("fill"),
  selector: z.string().min(1),
  value: z.string(),
});

export const playwrightPressStepSchema = z.object({
  type: z.literal("press"),
  selector: z.string().min(1),
  key: z.string().min(1),
});

export const playwrightWaitForSelectorStepSchema = z.object({
  type: z.literal("waitForSelector"),
  selector: z.string().min(1),
  state: z.enum(PLAYWRIGHT_SELECTOR_STATES).optional(),
  timeoutMs: z.number().int().positive().optional(),
});

export const playwrightAssertSelectorStepSchema = z.object({
  type: z.literal("assertSelector"),
  selector: z.string().min(1),
  minCount: z.number().int().nonnegative().optional(),
  maxCount: z.number().int().positive().optional(),
});

export const playwrightScreenshotStepSchema = z.object({
  type: z.literal("screenshot"),
  name: z.string().min(1),
  fullPage: z.boolean().optional(),
});

export const playwrightCheckConsoleStepSchema = z.object({
  type: z.literal("checkConsole"),
  level: z.enum(PLAYWRIGHT_CONSOLE_LEVELS).optional(),
  allowMessages: z.array(z.string().min(1)).optional(),
});

export const playwrightStepSchema = z.discriminatedUnion("type", [
  playwrightGotoStepSchema,
  playwrightClickStepSchema,
  playwrightFillStepSchema,
  playwrightPressStepSchema,
  playwrightWaitForSelectorStepSchema,
  playwrightAssertSelectorStepSchema,
  playwrightScreenshotStepSchema,
  playwrightCheckConsoleStepSchema,
]);

export const playwrightCriterionPlanSchema = z.object({
  steps: z.array(playwrightStepSchema).min(1),
  stopOnFailure: z.boolean().optional(),
});

export type PlaywrightBrowserName = (typeof PLAYWRIGHT_BROWSERS)[number];
export type PlaywrightWaitUntil = (typeof PLAYWRIGHT_WAIT_UNTIL)[number];
export type PlaywrightSelectorState = (typeof PLAYWRIGHT_SELECTOR_STATES)[number];
export type PlaywrightConsoleLevel = (typeof PLAYWRIGHT_CONSOLE_LEVELS)[number];
export type PlaywrightStep = z.output<typeof playwrightStepSchema>;
export type PlaywrightCriterionPlanConfig = z.output<typeof playwrightCriterionPlanSchema>;

export function describePlaywrightStep(step: PlaywrightStep): string {
  switch (step.type) {
    case "goto":
      return `goto ${step.url}${step.waitUntil == null ? "" : ` (${step.waitUntil})`}`;
    case "click":
      return `click ${step.selector}`;
    case "fill":
      return `fill ${step.selector}`;
    case "press":
      return `press ${step.selector} with ${step.key}`;
    case "waitForSelector":
      return `wait for ${step.selector}${step.state == null ? "" : ` (${step.state})`}`;
    case "assertSelector":
      return `assert ${step.selector}${step.minCount == null ? "" : ` min=${step.minCount}`}${
        step.maxCount == null ? "" : ` max=${step.maxCount}`
      }`;
    case "screenshot":
      return `screenshot ${step.name}${step.fullPage ? " (full page)" : ""}`;
    case "checkConsole":
      return `check console ${step.level ?? "error"}`;
  }
}
