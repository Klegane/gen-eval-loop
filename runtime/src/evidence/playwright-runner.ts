import { mkdir } from "node:fs/promises";
import path from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

import {
  chromium,
  firefox,
  webkit,
  type Browser,
  type BrowserContext,
  type ConsoleMessage,
  type Page,
} from "playwright";

import type {
  PlaywrightBrowserName,
  PlaywrightConsoleLevel,
  PlaywrightSelectorState,
  PlaywrightStep,
  PlaywrightWaitUntil,
} from "./playwright-plan";
import type { EvidenceData } from "../schemas/evidence";

export interface PlaywrightCriterionPlan {
  criterionId: string;
  steps: PlaywrightStep[];
  stopOnFailure?: boolean;
}

export interface PlaywrightStartCommand {
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  shell?: boolean;
  startupDelayMs?: number;
  readyUrl?: string;
  readyTimeoutMs?: number;
}

export interface PlaywrightRunnerInput {
  runId: string;
  sprint: number;
  criteria: PlaywrightCriterionPlan[];
  outputDir: string;
  browser?: PlaywrightBrowserName;
  headless?: boolean;
  baseUrl?: string;
  defaultTimeoutMs?: number;
  startCommand?: PlaywrightStartCommand;
}

export interface PlaywrightRunnerResult {
  evidence: EvidenceData;
  criterionFailures: Record<string, string[]>;
  startupLogs: string[];
}

interface ConsoleEntry {
  level: PlaywrightConsoleLevel | "log";
  text: string;
}

interface MutableCriterionResult {
  criterionId: string;
  status: "PASS" | "FAIL" | "UNVERIFIED";
  evidence: EvidenceData["criteria"][number]["evidence"];
  errors: string[];
}

export class PlaywrightRunner {
  async run(input: PlaywrightRunnerInput): Promise<PlaywrightRunnerResult> {
    const browserName = input.browser ?? "chromium";
    const headless = input.headless ?? true;
    const defaultTimeoutMs = input.defaultTimeoutMs ?? 10_000;
    const startupLogs: string[] = [];
    const consoleEntries: ConsoleEntry[] = [];
    let child: ChildProcessWithoutNullStreams | undefined;
    let browser: Browser | undefined;
    let context: BrowserContext | undefined;
    let page: Page | undefined;

    await mkdir(input.outputDir, { recursive: true });

    try {
      if (input.startCommand != null) {
        child = await this.startServer(input.startCommand, startupLogs);
      }

      browser = await this.launchBrowser(browserName, headless);
      context = await browser.newContext();
      page = await context.newPage();
      page.setDefaultTimeout(defaultTimeoutMs);
      page.on("console", (message) => {
        consoleEntries.push(this.mapConsoleMessage(message));
      });

      const criteriaResults: MutableCriterionResult[] = [];

      for (const criterion of input.criteria) {
        const criterionResult = await this.runCriterion({
          criterion,
          page,
          consoleEntries,
          outputDir: input.outputDir,
          ...(input.baseUrl == null ? {} : { baseUrl: input.baseUrl }),
        });
        criteriaResults.push(criterionResult);
      }

      return {
        evidence: {
          runId: input.runId,
          sprint: input.sprint,
          evaluationMode: "live",
          criteria: criteriaResults.map(({ criterionId, status, evidence }) => ({
            criterionId,
            status,
            evidence,
          })),
          infraFailures: [],
        },
        criterionFailures: Object.fromEntries(
          criteriaResults.map((result) => [result.criterionId, result.errors]),
        ),
        startupLogs,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      return {
        evidence: {
          runId: input.runId,
          sprint: input.sprint,
          evaluationMode: "static-fallback",
          criteria: input.criteria.map((criterion) => ({
            criterionId: criterion.criterionId,
            status: "UNVERIFIED",
            evidence: [],
          })),
          infraFailures: [message],
        },
        criterionFailures: Object.fromEntries(
          input.criteria.map((criterion) => [criterion.criterionId, [message]]),
        ),
        startupLogs,
      };
    } finally {
      await page?.close().catch(() => undefined);
      await context?.close().catch(() => undefined);
      await browser?.close().catch(() => undefined);
      await this.stopServer(child);
    }
  }

  private async runCriterion(input: {
    criterion: PlaywrightCriterionPlan;
    page: Page;
    consoleEntries: ConsoleEntry[];
    baseUrl?: string;
    outputDir: string;
  }): Promise<MutableCriterionResult> {
    const criterionStartConsoleIndex = input.consoleEntries.length;
    const result: MutableCriterionResult = {
      criterionId: input.criterion.criterionId,
      status: "PASS",
      evidence: [],
      errors: [],
    };

    for (const step of input.criterion.steps) {
      try {
        switch (step.type) {
          case "goto": {
            const url = this.resolveUrl(step.url, input.baseUrl);
            await input.page.goto(url, { waitUntil: step.waitUntil ?? "load" });
            break;
          }

          case "click":
            await input.page.click(step.selector);
            break;

          case "fill":
            await input.page.fill(step.selector, step.value);
            break;

          case "press":
            await input.page.press(step.selector, step.key);
            break;

          case "waitForSelector":
            await input.page.waitForSelector(step.selector, {
              state: step.state ?? "visible",
              ...(step.timeoutMs == null ? {} : { timeout: step.timeoutMs }),
            });
            break;

          case "assertSelector": {
            const count = await input.page.locator(step.selector).count();
            const minCount = step.minCount ?? 1;

            if (count < minCount) {
              throw new Error(
                `Selector ${step.selector} matched ${count} elements, expected at least ${minCount}.`,
              );
            }

            if (step.maxCount != null && count > step.maxCount) {
              throw new Error(
                `Selector ${step.selector} matched ${count} elements, expected at most ${step.maxCount}.`,
              );
            }

            result.evidence.push({
              type: "selector_assertion",
              value: JSON.stringify({
                selector: step.selector,
                count,
                minCount: step.minCount,
                maxCount: step.maxCount,
              }),
              note: `Selector assertion passed for ${step.selector}.`,
            });
            break;
          }

          case "screenshot": {
            const screenshotFileName = path.extname(step.name).length > 0 ? step.name : `${step.name}.png`;
            const screenshotPath = path.join(input.outputDir, screenshotFileName);
            await mkdir(path.dirname(screenshotPath), { recursive: true });
            await input.page.screenshot({
              path: screenshotPath,
              fullPage: step.fullPage ?? false,
            });
            result.evidence.push({
              type: "screenshot",
              path: screenshotPath,
              note: `Captured screenshot ${screenshotFileName}.`,
            });
            break;
          }

          case "checkConsole": {
            const newConsoleEntries = input.consoleEntries.slice(criterionStartConsoleIndex);
            const level = step.level ?? "error";
            const matchingMessages = newConsoleEntries.filter((entry) => {
              if (!this.matchesConsoleLevel(entry.level, level)) {
                return false;
              }

              if (step.allowMessages == null || step.allowMessages.length === 0) {
                return true;
              }

              return !step.allowMessages.some((allowed) => entry.text.includes(allowed));
            });

            if (matchingMessages.length > 0) {
              throw new Error(
                `Console ${level} messages detected: ${matchingMessages
                  .map((entry) => entry.text)
                  .join(" | ")}`,
              );
            }

            result.evidence.push({
              type: "console_check",
              value: JSON.stringify({ level, matches: 0 }),
              note: `No disallowed console ${level} messages detected.`,
            });
            break;
          }
        }
      } catch (error) {
        result.status = "FAIL";
        result.errors.push(error instanceof Error ? error.message : String(error));

        if (input.criterion.stopOnFailure !== false) {
          break;
        }
      }
    }

    if (result.evidence.length === 0) {
      result.evidence.push({
        type: "manual_observation",
        note:
          result.status === "PASS"
            ? "Criterion completed without artifact-specific evidence; no failing condition was observed."
            : "Criterion failed before any artifact-specific evidence could be captured.",
      });
    }

    return result;
  }

  private async launchBrowser(browserName: PlaywrightBrowserName, headless: boolean): Promise<Browser> {
    switch (browserName) {
      case "firefox":
        return firefox.launch({ headless });
      case "webkit":
        return webkit.launch({ headless });
      case "chromium":
      default:
        return chromium.launch({ headless });
    }
  }

  private mapConsoleMessage(message: ConsoleMessage): ConsoleEntry {
    const type = message.type();

    if (type === "error") {
      return { level: "error", text: message.text() };
    }

    if (type === "warning") {
      return { level: "warning", text: message.text() };
    }

    return { level: "log", text: message.text() };
  }

  private matchesConsoleLevel(
    currentLevel: ConsoleEntry["level"],
    expectedLevel: PlaywrightConsoleLevel,
  ): boolean {
    if (expectedLevel === "error") {
      return currentLevel === "error";
    }

    return currentLevel === "warning" || currentLevel === "error";
  }

  private resolveUrl(url: string, baseUrl?: string): string {
    if (/^https?:\/\//i.test(url)) {
      return url;
    }

    if (baseUrl == null) {
      throw new Error(`Relative url "${url}" requires baseUrl in PlaywrightRunnerInput.`);
    }

    return new URL(url, baseUrl).toString();
  }

  private async startServer(
    command: PlaywrightStartCommand,
    startupLogs: string[],
  ): Promise<ChildProcessWithoutNullStreams> {
    const child = spawn(command.command, {
      cwd: command.cwd,
      env: {
        ...process.env,
        ...command.env,
      },
      shell: command.shell ?? true,
      stdio: "pipe",
      windowsHide: true,
    });

    child.stdout.on("data", (chunk: Buffer) => {
      startupLogs.push(chunk.toString("utf8").trim());
    });

    child.stderr.on("data", (chunk: Buffer) => {
      startupLogs.push(chunk.toString("utf8").trim());
    });

    if (command.startupDelayMs != null && command.startupDelayMs > 0) {
      await delay(command.startupDelayMs);
    }

    if (command.readyUrl != null) {
      await this.waitForReadyUrl(command.readyUrl, command.readyTimeoutMs ?? 20_000);
    }

    return child;
  }

  private async waitForReadyUrl(url: string, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let lastError: string | undefined;

    while (Date.now() < deadline) {
      try {
        const response = await fetch(url);

        if (response.ok) {
          return;
        }

        lastError = `Ready url responded with status ${response.status}.`;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }

      await delay(500);
    }

    throw new Error(`Timed out waiting for ready url ${url}. Last error: ${lastError ?? "unknown"}`);
  }

  private async stopServer(child: ChildProcessWithoutNullStreams | undefined): Promise<void> {
    if (child == null || child.killed) {
      return;
    }

    child.kill();
    await delay(250);
  }
}
