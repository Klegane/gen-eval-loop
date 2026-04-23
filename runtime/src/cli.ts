import "dotenv/config";

import path from "node:path";

import { buildContractSkeleton } from "./app/contract-skeleton";
import { checkRuntimeHealth } from "./app/check-runtime-health";
import { checkProviderHealth } from "./app/check-provider-health";
import { buildEvaluationSkeleton } from "./app/evaluation-skeleton";
import { buildReportSkeleton } from "./app/report-skeleton";
import { resumeRun } from "./app/resume-run";
import { runPreflight, shouldRunPreflightForStatus } from "./app/run-preflight";
import { buildSpecSkeleton } from "./app/spec-skeleton";
import { RunController } from "./app/run-controller";
import { ADAPTER_PROVIDERS, createLlmAdapter, type AdapterProvider } from "./roles/adapter-factory";
import { EvaluatorRole } from "./roles/evaluator-role";
import { GeneratorRole } from "./roles/generator-role";
import { PlannerRole } from "./roles/planner-role";

interface ParsedArgs {
  command: string | undefined;
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const flags: Record<string, string | boolean> = {};

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];

    if (!token?.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = rest[index + 1];

    if (next == null || next.startsWith("--")) {
      flags[key] = true;
      continue;
    }

    flags[key] = next;
    index += 1;
  }

  return { command, flags };
}

function printUsage(): void {
  console.log(`Usage:
  npm run start -- check-runtime-health [--provider ${ADAPTER_PROVIDERS.join("|")}] [--profile ui|backend|agentic|content]
  npm run start -- check-provider-health [--provider ${ADAPTER_PROVIDERS.join("|")}] [--model <model>]
  npm run start -- init-run --prompt "build a premium homepage" --model "claude-opus-4-7"
  npm run start -- write-spec-skeleton --run-id "<run-id>" --request "build a premium homepage"
  npm run start -- write-contract-skeleton --run-id "<run-id>" [--decision initial|refine|pivot] [--sprint 1]
  npm run start -- sign-contract --run-id "<run-id>" --sprint 1
  npm run start -- write-report-skeleton --run-id "<run-id>" --sprint 1
  npm run start -- write-evaluation-skeleton --run-id "<run-id>" --sprint 1 --result PASS|FAIL|INFRA_FAIL
  npm run start -- run-playwright-evidence --run-id "<run-id>" --sprint 1 [--base-url http://127.0.0.1:3000]
  npm run start -- run-planner-role --run-id "<run-id>" --request "build a premium homepage"
  npm run start -- run-generator-contract-role --run-id "<run-id>" --sprint 1 [--decision initial|refine|pivot]
  npm run start -- run-evaluator-review-role --run-id "<run-id>" --sprint 1
  npm run start -- run-generator-implement-role --run-id "<run-id>" --sprint 1
  npm run start -- run-evaluator-score-role --run-id "<run-id>" --sprint 1
  npm run start -- resume-run --run-id "<run-id>"
  npm run start -- run-full-loop --prompt "build a premium homepage" --model "gpt-5.2"

Optional flags:
  --repo-root <path>
  --provider <${ADAPTER_PROVIDERS.join("|")}>
  --profile <ui|backend|agentic|content>
  --execution-mode <full-loop|plan-only|evaluate-only>
  --delivery-mode <single-pass|short-sprint>
  --git-mode <workspace-mode|commit-mode>
  --playwright-available <true|false>
  --browser <chromium|firefox|webkit>
  --headless <true|false>
  --skip-browser-launch
  --skip-preflight
  --skip-preflight-browser-launch
  --default-timeout-ms <number>
  --start-command <command>
  --start-cwd <path>
  --ready-url <url>
  --ready-timeout-ms <number>
  --startup-delay-ms <number>`);
}

function getStringFlag(flags: Record<string, string | boolean>, key: string): string | undefined {
  const value = flags[key];
  return typeof value === "string" ? value : undefined;
}

function getBooleanFlag(
  flags: Record<string, string | boolean>,
  key: string,
  fallback: boolean,
): boolean {
  const value = flags[key];

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }

  return fallback;
}

function getNumberFlag(
  flags: Record<string, string | boolean>,
  key: string,
): number | undefined {
  const value = getStringFlag(flags, key);
  if (value == null) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getProviderFlag(flags: Record<string, string | boolean>): AdapterProvider | undefined {
  const provider = getStringFlag(flags, "provider");
  return provider === "openai" || provider === "development" || provider === "anthropic"
    ? provider
    : undefined;
}

function buildPlaywrightOptions(
  flags: Record<string, string | boolean>,
  repoRoot: string,
): {
  headless: boolean;
  baseUrl?: string;
  browser?: "chromium" | "firefox" | "webkit";
  defaultTimeoutMs?: number;
  startCommand?: {
    command: string;
    cwd: string;
    readyUrl?: string;
    readyTimeoutMs?: number;
    startupDelayMs?: number;
  };
} {
  const startCommandValue = getStringFlag(flags, "start-command");
  const startCwd = getStringFlag(flags, "start-cwd");
  const baseUrl = getStringFlag(flags, "base-url");
  const browser = getStringFlag(flags, "browser") as "chromium" | "firefox" | "webkit" | undefined;
  const defaultTimeoutMs = getNumberFlag(flags, "default-timeout-ms");
  const readyUrl = getStringFlag(flags, "ready-url");
  const readyTimeoutMs = getNumberFlag(flags, "ready-timeout-ms");
  const startupDelayMs = getNumberFlag(flags, "startup-delay-ms");

  return {
    headless: getBooleanFlag(flags, "headless", true),
    ...(baseUrl == null ? {} : { baseUrl }),
    ...(browser == null ? {} : { browser }),
    ...(defaultTimeoutMs == null ? {} : { defaultTimeoutMs }),
    ...(startCommandValue == null
      ? {}
      : {
          startCommand: {
            command: startCommandValue,
            cwd: startCwd == null ? repoRoot : path.resolve(startCwd),
            ...(readyUrl == null ? {} : { readyUrl }),
            ...(readyTimeoutMs == null ? {} : { readyTimeoutMs }),
            ...(startupDelayMs == null ? {} : { startupDelayMs }),
          },
        }),
  };
}

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv.slice(2));
  const repoRootFlag = getStringFlag(flags, "repo-root");
  const repoRoot = repoRootFlag == null ? path.resolve(process.cwd(), "..") : path.resolve(repoRootFlag);
  const controller = new RunController(repoRoot);
  let adapterCache:
    | {
        adapter: ReturnType<typeof createLlmAdapter>;
        plannerRole: PlannerRole;
        generatorRole: GeneratorRole;
        evaluatorRole: EvaluatorRole;
      }
    | undefined;

  const getRoles = () => {
    if (adapterCache != null) {
      return adapterCache;
    }

    const adapter = createLlmAdapter({ provider: getProviderFlag(flags) });
    adapterCache = {
      adapter,
      plannerRole: new PlannerRole(repoRoot, adapter),
      generatorRole: new GeneratorRole(repoRoot, adapter),
      evaluatorRole: new EvaluatorRole(repoRoot, adapter),
    };

    return adapterCache;
  };

  if (command == null) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  switch (command) {
    case "check-runtime-health": {
      const profile = getStringFlag(flags, "profile");
      const report = await checkRuntimeHealth({
        runtimeRoot: process.cwd(),
        provider: getProviderFlag(flags),
        ...(profile == null
          ? {}
          : {
              profile: profile as "ui" | "backend" | "agentic" | "content",
            }),
        model: getStringFlag(flags, "model"),
        playwrightAvailable: getBooleanFlag(flags, "playwright-available", true),
        verifyBrowserLaunch: !getBooleanFlag(flags, "skip-browser-launch", false),
      });

      console.log(JSON.stringify(report, null, 2));
      return;
    }

    case "check-provider-health": {
      const report = await checkProviderHealth({
        provider: getProviderFlag(flags),
        model: getStringFlag(flags, "model"),
      });

      console.log(JSON.stringify(report, null, 2));
      return;
    }

    case "init-run": {
      const prompt = getStringFlag(flags, "prompt");
      const model = getStringFlag(flags, "model");

      if (prompt == null || model == null) {
        printUsage();
        process.exitCode = 1;
        return;
      }

      const profile = getStringFlag(flags, "profile");
      const executionMode = getStringFlag(flags, "execution-mode");
      const deliveryMode = getStringFlag(flags, "delivery-mode");
      const gitMode = getStringFlag(flags, "git-mode");

      const initRunInput = {
        prompt,
        model,
        playwrightAvailable: getBooleanFlag(flags, "playwright-available", false),
        ...(profile == null
          ? {}
          : {
              qualityProfile: profile as "ui" | "backend" | "agentic" | "content",
            }),
        ...(executionMode == null
          ? {}
          : {
              executionMode: executionMode as "full-loop" | "plan-only" | "evaluate-only",
            }),
        ...(deliveryMode == null
          ? {}
          : {
              deliveryMode: deliveryMode as "single-pass" | "short-sprint",
            }),
        ...(gitMode == null
          ? {}
          : {
              gitMode: gitMode as "workspace-mode" | "commit-mode",
            }),
      };

      const result = await controller.initializeRun(initRunInput);

      console.log(
        JSON.stringify(
          {
            runId: result.run.runId,
            status: result.run.status,
            runJsonPath: result.runPaths.runJsonPath,
            docsRunDir: result.runPaths.docsRunDir,
            stateRunDir: result.runPaths.stateRunDir,
          },
          null,
          2,
        ),
      );
      return;
    }

    case "write-spec-skeleton": {
      const runId = getStringFlag(flags, "run-id");
      const request = getStringFlag(flags, "request");

      if (runId == null || request == null) {
        printUsage();
        process.exitCode = 1;
        return;
      }

      const context = await controller.loadRun(runId);
      const spec = buildSpecSkeleton(context.run, request);
      const result = await controller.writeSpec({ runId, spec });

      console.log(
        JSON.stringify(
          {
            runId: result.run.runId,
            status: result.run.status,
            specJsonPath: result.runPaths.specJsonPath,
            specMarkdownPath: result.runPaths.specMarkdownPath,
          },
          null,
          2,
        ),
      );
      return;
    }

    case "write-contract-skeleton": {
      const runId = getStringFlag(flags, "run-id");

      if (runId == null) {
        printUsage();
        process.exitCode = 1;
        return;
      }

      const context = await controller.loadRun(runId);
      const spec = await controller.loadSpec(runId);
      const sprint = Number(getStringFlag(flags, "sprint") ?? String(context.run.currentSprint + 1));
      const decision = (getStringFlag(flags, "decision") ?? (sprint === 1 ? "initial" : "refine")) as
        | "initial"
        | "refine"
        | "pivot";
      const contract = buildContractSkeleton(context.run, spec, sprint, decision);
      const result = await controller.writeContract({ runId, contract });
      const sprintPaths = {
        contractJsonPath: result.runPaths.stateRunDir + `\\sprint-${sprint}\\contract.json`,
        contractMarkdownPath: result.runPaths.stateRunDir + `\\sprint-${sprint}\\contract.md`,
      };

      console.log(
        JSON.stringify(
          {
            runId: result.run.runId,
            status: result.run.status,
            sprint,
            contractJsonPath: sprintPaths.contractJsonPath,
            contractMarkdownPath: sprintPaths.contractMarkdownPath,
          },
          null,
          2,
        ),
      );
      return;
    }

    case "sign-contract": {
      const runId = getStringFlag(flags, "run-id");
      const sprintValue = getStringFlag(flags, "sprint");

      if (runId == null || sprintValue == null) {
        printUsage();
        process.exitCode = 1;
        return;
      }

      const sprint = Number(sprintValue);
      const result = await controller.signContract({ runId, sprint });

      console.log(
        JSON.stringify(
          {
            runId: result.run.runId,
            status: result.run.status,
            sprint,
          },
          null,
          2,
        ),
      );
      return;
    }

    case "write-report-skeleton": {
      const runId = getStringFlag(flags, "run-id");
      const sprintValue = getStringFlag(flags, "sprint");

      if (runId == null || sprintValue == null) {
        printUsage();
        process.exitCode = 1;
        return;
      }

      const sprint = Number(sprintValue);
      const contract = await controller.loadContract(runId, sprint);
      const report = buildReportSkeleton(contract);
      const result = await controller.writeReport({ runId, report });

      console.log(
        JSON.stringify(
          {
            runId: result.run.runId,
            status: result.run.status,
            sprint,
          },
          null,
          2,
        ),
      );
      return;
    }

    case "write-evaluation-skeleton": {
      const runId = getStringFlag(flags, "run-id");
      const sprintValue = getStringFlag(flags, "sprint");
      const evaluationResult = getStringFlag(flags, "result");

      if (runId == null || sprintValue == null || evaluationResult == null) {
        printUsage();
        process.exitCode = 1;
        return;
      }

      const sprint = Number(sprintValue);
      const contract = await controller.loadContract(runId, sprint);
      const evaluation = buildEvaluationSkeleton(
        contract,
        evaluationResult as "PASS" | "FAIL" | "INFRA_FAIL",
      );
      const result = await controller.writeEvaluation({
        runId,
        score: evaluation.score,
        evidence: evaluation.evidence,
      });

      console.log(
        JSON.stringify(
          {
            runId: result.run.runId,
            status: result.run.status,
            sprint,
            verdict: evaluationResult,
          },
          null,
          2,
        ),
      );
      return;
    }

    case "run-playwright-evidence": {
      const runId = getStringFlag(flags, "run-id");
      const sprintValue = getStringFlag(flags, "sprint");

      if (runId == null || sprintValue == null) {
        printUsage();
        process.exitCode = 1;
        return;
      }

      const sprint = Number(sprintValue);
      const result = await controller.runPlaywrightEvidence({
        runId,
        sprint,
        ...buildPlaywrightOptions(flags, repoRoot),
      });

      console.log(
        JSON.stringify(
          {
            runId: result.run.runId,
            status: result.run.status,
            adapter: getProviderFlag(flags) ?? "development",
            sprint,
            evidenceJsonPath: result.evidenceJsonPath,
            screenshotsDir: result.screenshotsDir,
            evaluationMode: result.evidence.evaluationMode,
            infraFailures: result.evidence.infraFailures,
            criterionFailures: result.criterionFailures,
            startupLogs: result.startupLogs,
          },
          null,
          2,
        ),
      );
      return;
    }

    case "run-planner-role": {
      const { adapter, plannerRole } = getRoles();
      const runId = getStringFlag(flags, "run-id");
      const request = getStringFlag(flags, "request");

      if (runId == null || request == null) {
        printUsage();
        process.exitCode = 1;
        return;
      }

      const context = await controller.loadRun(runId);
      const spec = await plannerRole.run({
        run: context.run,
        request,
      });
      const result = await controller.writeSpec({ runId, spec });

      console.log(
        JSON.stringify(
          {
            runId: result.run.runId,
            status: result.run.status,
            adapter: adapter.name,
            specJsonPath: result.runPaths.specJsonPath,
            specMarkdownPath: result.runPaths.specMarkdownPath,
          },
          null,
          2,
        ),
      );
      return;
    }

    case "run-generator-contract-role": {
      const { adapter, generatorRole } = getRoles();
      const runId = getStringFlag(flags, "run-id");

      if (runId == null) {
        printUsage();
        process.exitCode = 1;
        return;
      }

      const context = await controller.loadRun(runId);
      const spec = await controller.loadSpec(runId);
      const sprint = Number(getStringFlag(flags, "sprint") ?? String(context.run.currentSprint + 1));
      const decision = (getStringFlag(flags, "decision") ?? (sprint === 1 ? "initial" : "refine")) as
        | "initial"
        | "refine"
        | "pivot";
      const previousScore = sprint > 1 ? await controller.loadScore(runId, sprint - 1) : undefined;
      const previousEvidence = sprint > 1 ? await controller.loadEvidence(runId, sprint - 1) : undefined;
      const contract = await generatorRole.draftContract({
        run: context.run,
        spec,
        sprint,
        decision,
        previousScore,
        previousEvidence,
      });
      const result = await controller.writeContract({ runId, contract });

      console.log(
        JSON.stringify(
          {
            runId: result.run.runId,
            status: result.run.status,
            adapter: adapter.name,
            sprint,
            contractJsonPath: result.runPaths.stateRunDir + `\\sprint-${sprint}\\contract.json`,
          },
          null,
          2,
        ),
      );
      return;
    }

    case "run-evaluator-review-role": {
      const { adapter, evaluatorRole } = getRoles();
      const runId = getStringFlag(flags, "run-id");
      const sprintValue = getStringFlag(flags, "sprint");

      if (runId == null || sprintValue == null) {
        printUsage();
        process.exitCode = 1;
        return;
      }

      const sprint = Number(sprintValue);
      const context = await controller.loadRun(runId);
      const spec = await controller.loadSpec(runId);
      const contract = await controller.loadContract(runId, sprint);
      const review = await evaluatorRole.reviewContract({
        run: context.run,
        spec,
        contract,
      });

      const result =
        review.approved && review.status === "SIGNED"
          ? await controller.signContract({ runId, sprint, updatedAt: review.updatedAt })
          : context;

      console.log(
        JSON.stringify(
          {
            runId,
            status: result.run.status,
            adapter: adapter.name,
            sprint,
            review,
          },
          null,
          2,
        ),
      );
      return;
    }

    case "run-generator-implement-role": {
      const { adapter, generatorRole } = getRoles();
      const runId = getStringFlag(flags, "run-id");
      const sprintValue = getStringFlag(flags, "sprint");

      if (runId == null || sprintValue == null) {
        printUsage();
        process.exitCode = 1;
        return;
      }

      const sprint = Number(sprintValue);
      const context = await controller.loadRun(runId);
      const spec = await controller.loadSpec(runId);
      const contract = await controller.loadContract(runId, sprint);
      const report = await generatorRole.implement({
        run: context.run,
        spec,
        contract,
      });
      const result = await controller.writeReport({ runId, report });

      console.log(
        JSON.stringify(
          {
            runId,
            status: result.run.status,
            adapter: adapter.name,
            sprint,
          },
          null,
          2,
        ),
      );
      return;
    }

    case "run-evaluator-score-role": {
      const { adapter, evaluatorRole } = getRoles();
      const runId = getStringFlag(flags, "run-id");
      const sprintValue = getStringFlag(flags, "sprint");

      if (runId == null || sprintValue == null) {
        printUsage();
        process.exitCode = 1;
        return;
      }

      const sprint = Number(sprintValue);
      const context = await controller.loadRun(runId);
      const spec = await controller.loadSpec(runId);
      const contract = await controller.loadContract(runId, sprint);
      const report = await controller.loadReport(runId, sprint);
      const evidence = await controller.loadEvidence(runId, sprint);
      const score = await evaluatorRole.score({
        run: context.run,
        spec,
        contract,
        report,
        evidence,
      });
      const result = await controller.writeEvaluation({
        runId,
        score,
        evidence,
      });

      console.log(
        JSON.stringify(
          {
            runId,
            status: result.run.status,
            adapter: adapter.name,
            sprint,
            verdict: score.verdict,
            evaluationMode: score.evaluationMode,
          },
          null,
          2,
        ),
      );
      return;
    }

    case "resume-run": {
      const runId = getStringFlag(flags, "run-id");

      if (runId == null) {
        printUsage();
        process.exitCode = 1;
        return;
      }

      const context = await controller.loadRun(runId);
      const skipPreflight = getBooleanFlag(flags, "skip-preflight", false);

      if (!skipPreflight && shouldRunPreflightForStatus(context.run.status)) {
        const preflight = await runPreflight({
          runtimeRoot: process.cwd(),
          provider: getProviderFlag(flags),
          profile: context.run.qualityProfile,
          model: context.run.model,
          playwrightAvailable: context.run.playwrightAvailable,
          skipBrowserLaunch: getBooleanFlag(flags, "skip-preflight-browser-launch", false),
        });
        await controller.recordPreflight({ runId, preflight });

        if (preflight.status === "FAIL") {
          console.log(
            JSON.stringify(
              {
                status: "PRECHECK_FAILED",
                runId,
                preflight,
              },
              null,
              2,
            ),
          );
          process.exitCode = 1;
          return;
        }
      }

      const { adapter, plannerRole, generatorRole, evaluatorRole } = getRoles();

      const result = await resumeRun({
        controller,
        plannerRole,
        generatorRole,
        evaluatorRole,
        runId,
        playwright: buildPlaywrightOptions(flags, repoRoot),
      });

      console.log(
        JSON.stringify(
          {
            runId: result.run.runId,
            status: result.run.status,
            adapter: adapter.name,
            completed: result.completed,
            lastAction: result.lastAction,
            summaryJsonPath: result.runPaths.summaryJsonPath,
            summaryMarkdownPath: result.runPaths.summaryMarkdownPath,
          },
          null,
          2,
        ),
      );
      return;
    }

    case "run-full-loop": {
      const prompt = getStringFlag(flags, "prompt");
      const model = getStringFlag(flags, "model");

      if (prompt == null || model == null) {
        printUsage();
        process.exitCode = 1;
        return;
      }

      const profile = getStringFlag(flags, "profile");
      const deliveryMode = getStringFlag(flags, "delivery-mode");
      const gitMode = getStringFlag(flags, "git-mode");
      const resolvedProfile = (profile ?? "ui") as "ui" | "backend" | "agentic" | "content";
      const playwrightAvailable = getBooleanFlag(flags, "playwright-available", false);
      const skipPreflight = getBooleanFlag(flags, "skip-preflight", false);
      const initialized = await controller.initializeRun({
        prompt,
        model,
        executionMode: "full-loop",
        playwrightAvailable,
        qualityProfile: resolvedProfile,
        ...(deliveryMode == null
          ? {}
          : {
              deliveryMode: deliveryMode as "single-pass" | "short-sprint",
            }),
        ...(gitMode == null
          ? {}
          : {
              gitMode: gitMode as "workspace-mode" | "commit-mode",
            }),
      });

      if (!skipPreflight) {
        const preflight = await runPreflight({
          runtimeRoot: process.cwd(),
          provider: getProviderFlag(flags),
          profile: resolvedProfile,
          model,
          playwrightAvailable,
          skipBrowserLaunch: getBooleanFlag(flags, "skip-preflight-browser-launch", false),
        });
        await controller.recordPreflight({
          runId: initialized.run.runId,
          preflight,
        });

        if (preflight.status === "FAIL") {
          console.log(
            JSON.stringify(
              {
                status: "PRECHECK_FAILED",
                runId: initialized.run.runId,
                runJsonPath: initialized.runPaths.runJsonPath,
                preflight,
              },
              null,
              2,
            ),
          );
          process.exitCode = 1;
          return;
        }
      }

      const { adapter, plannerRole, generatorRole, evaluatorRole } = getRoles();

      const result = await resumeRun({
        controller,
        plannerRole,
        generatorRole,
        evaluatorRole,
        runId: initialized.run.runId,
        playwright: buildPlaywrightOptions(flags, repoRoot),
      });

      console.log(
        JSON.stringify(
          {
            runId: result.run.runId,
            status: result.run.status,
            adapter: adapter.name,
            completed: result.completed,
            lastAction: result.lastAction,
            runJsonPath: result.runPaths.runJsonPath,
            summaryJsonPath: result.runPaths.summaryJsonPath,
            summaryMarkdownPath: result.runPaths.summaryMarkdownPath,
          },
          null,
          2,
        ),
      );
      return;
    }

    default:
      printUsage();
      process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
