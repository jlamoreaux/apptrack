/**
 * @jest-environment node
 *
 * Live end-to-end eval of the app's AI features against the real OpenAI API.
 * Skipped unless RUN_LIVE_AI_EVAL=1 and OPENAI_API_KEY are set; it costs real money
 * (well under $0.05 per model per run).
 *
 * Each case runs the production code path (prompt builders, callOpenAI, request
 * parameters, response parsers, the AI SDK tool loop) against whichever model
 * OPENAI_DEFAULT_MODEL selects, then checks the output contract the UI depends on.
 * Run it once per model with scripts/ai/run-model-eval.sh to compare them; the
 * report in eval-results/ includes the outputs for a side-by-side quality read.
 *
 * PostHog is mocked: no events reach production, and the mocked $ai_generation
 * captures supply the token and cost figures in the report.
 */
import fs from "node:fs";
import path from "node:path";
import { generateText, stepCountIs, tool, type LanguageModel } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

jest.mock("@/lib/analytics/posthog-server", () => ({
  captureServerEvent: jest.fn().mockResolvedValue(undefined),
  captureServerEventAfterResponse: jest.fn(),
  isServerTelemetryEnabled: () => true,
}));

import { captureServerEventAfterResponse } from "@/lib/analytics/posthog-server";
import { Models } from "@/lib/openai/models";
import { buildAiSdkProviderOptions } from "@/lib/openai/request-params";
import { fromAiSdkUsage, trackAiGeneration } from "@/lib/analytics/llm-tracking";
import {
  generateCoverLetter,
  generateInterviewPrep,
  generateJobFitAnalysis,
} from "@/lib/ai-coach/functions";
import { parseInterviewPreparation, parseJobFitAnalysis } from "@/lib/ai-coach/response-parser";
import { generateRoast } from "@/lib/roast/roast-generator-v2";
import { generateOnboardingInsight } from "@/lib/ai-coach/onboarding-insight";
import { generateChangelogDraft } from "@/lib/email/changelog-generator";
import { loggerService } from "@/lib/services/logger.service";

const LIVE = process.env.RUN_LIVE_AI_EVAL === "1" && Boolean(process.env.OPENAI_API_KEY);
const describeLive = LIVE ? describe : describe.skip;
const CASE_TIMEOUT_MS = 180_000;

// Synthetic candidate and posting; no real user data.
const COMPANY = "Brightline Health";
const ROLE = "Senior Frontend Engineer";
const JOB_DESCRIPTION = `Brightline Health is hiring a Senior Frontend Engineer to lead our patient portal.
Requirements: 5+ years building production React apps with TypeScript; experience with
accessibility (WCAG 2.1 AA); state management at scale (Redux or Zustand); testing with Jest
and Playwright; CI/CD pipelines; mentoring engineers. Nice to have: HIPAA experience,
Next.js, design systems, GraphQL. You will partner with product and design to ship
features used by 2M patients, own frontend performance budgets, and lead code review.`;
const RESUME = `Sam Rivera - Frontend Engineer
Experience:
- Acme Analytics (2021-present), Frontend Engineer: Built a React + TypeScript dashboard used by
  40K customers; cut bundle size 38% via code splitting; introduced Playwright end-to-end tests;
  mentored 3 junior engineers.
- Northwind Retail (2018-2021), Web Developer: Migrated a jQuery storefront to React; built a
  component library adopted by 4 teams; improved Lighthouse accessibility score from 62 to 95.
Skills: React, TypeScript, Redux, Jest, Playwright, GitHub Actions, Storybook, REST APIs.
Education: B.S. Computer Science, Oregon State University.`;

interface CaseResult {
  feature: string;
  passed: boolean;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  costUsd: number;
  notes: string;
  output: string;
}

const results: CaseResult[] = [];
const mockCapture = captureServerEventAfterResponse as jest.Mock;

function generationsSoFar(): Record<string, any>[] {
  return mockCapture.mock.calls
    .filter(([, event]) => event === "$ai_generation")
    .map(([, , properties]) => properties);
}

/** Runs one feature, records its latency/tokens/cost, and fails the test if `check` throws. */
async function runCase(
  feature: string,
  run: () => Promise<string>,
  check: (output: string) => string
): Promise<void> {
  const before = generationsSoFar().length;
  const start = Date.now();
  let output = "";
  let notes = "";
  let passed = false;
  let failure: unknown;

  try {
    output = await run();
    notes = check(output);
    passed = true;
  } catch (error) {
    failure = error;
    notes = error instanceof Error ? error.message : String(error);
  }

  const generations = generationsSoFar().slice(before);
  const sum = (key: string) => generations.reduce((total, g) => total + (Number(g[key]) || 0), 0);
  results.push({
    feature,
    passed,
    latencyMs: Date.now() - start,
    inputTokens: sum("$ai_input_tokens"),
    outputTokens: sum("$ai_output_tokens"),
    reasoningTokens: sum("$ai_reasoning_tokens"),
    costUsd: sum("$ai_total_cost_usd"),
    notes,
    output,
  });

  if (failure) throw failure;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function extractJson(text: string): any {
  const match = text.match(/\{[\s\S]*\}/);
  assert(match, "no JSON object in response");
  return JSON.parse(match[0]);
}

function writeReport(): void {
  const dir = path.join(process.cwd(), "eval-results");
  fs.mkdirSync(dir, { recursive: true });
  const base = path.join(dir, Models.default);
  const total = results.reduce(
    (acc, r) => ({ cost: acc.cost + r.costUsd, latency: acc.latency + r.latencyMs }),
    { cost: 0, latency: 0 }
  );

  fs.writeFileSync(`${base}.json`, JSON.stringify({ model: Models.default, results }, null, 2));

  const rows = results.map(
    (r) =>
      `| ${r.feature} | ${r.passed ? "pass" : "FAIL"} | ${(r.latencyMs / 1000).toFixed(1)}s | ` +
      `${r.inputTokens} | ${r.outputTokens} | ${r.reasoningTokens} | $${r.costUsd.toFixed(5)} | ${r.notes.replace(/\|/g, "/")} |`
  );
  const outputs = results.map((r) => `### ${r.feature}\n\n\`\`\`\n${r.output.slice(0, 4000)}\n\`\`\``);
  fs.writeFileSync(
    `${base}.md`,
    [
      `# AI eval: ${Models.default}`,
      "",
      `Run ${new Date().toISOString()}. Total cost $${total.cost.toFixed(4)}, total latency ${(total.latency / 1000).toFixed(1)}s.`,
      "",
      "| Feature | Result | Latency | In tokens | Out tokens | Reasoning tokens | Cost | Notes |",
      "|---|---|---|---|---|---|---|---|",
      ...rows,
      "",
      "## Outputs",
      "",
      ...outputs,
      "",
    ].join("\n")
  );
}

describeLive(`OpenAI live eval (${Models.default})`, () => {
  beforeAll(() => {
    // jest.setup.js mocks fetch for unit tests; this suite needs the network.
    globalThis.fetch = (globalThis as { __realFetch?: typeof fetch }).__realFetch!;
    assert(typeof globalThis.fetch === "function", "real fetch unavailable; run under the node environment");
  });

  afterAll(() => {
    writeReport();
  });

  it(
    "job fit analysis returns the JSON contract the UI renders",
    async () => {
      await runCase(
        "job_fit_analysis",
        () => generateJobFitAnalysis(JOB_DESCRIPTION, RESUME, COMPANY, ROLE),
        (raw) => {
          const json = extractJson(raw);
          assert(typeof json.overallScore === "number", "overallScore is not a number");
          assert(json.overallScore >= 0 && json.overallScore <= 100, `overallScore out of range: ${json.overallScore}`);
          assert(Array.isArray(json.strengths) && json.strengths.length > 0, "no strengths");
          assert(Array.isArray(json.weaknesses), "weaknesses missing");
          const parsed = parseJobFitAnalysis(raw, { company: COMPANY, role: ROLE });
          return `score ${parsed.overallScore}, ${json.strengths.length} strengths, ${json.weaknesses.length} gaps`;
        }
      );
    },
    CASE_TIMEOUT_MS
  );

  it(
    "interview prep returns parseable structured questions",
    async () => {
      await runCase(
        "interview_prep",
        () => generateInterviewPrep(JOB_DESCRIPTION, undefined, RESUME),
        (raw) => {
          const json = extractJson(raw);
          assert(Array.isArray(json.questions) && json.questions.length >= 5, "fewer than 5 questions");
          const parsed = parseInterviewPreparation(raw, { company: COMPANY, role: ROLE });
          return `${parsed.questions.length} questions`;
        }
      );
    },
    CASE_TIMEOUT_MS
  );

  it(
    "cover letter is a complete letter for the right company",
    async () => {
      await runCase(
        "cover_letter",
        () =>
          generateCoverLetter(
            JOB_DESCRIPTION,
            "Frontend engineer focused on accessible, fast React apps.",
            COMPANY,
            RESUME,
            ROLE
          ),
        (text) => {
          const words = wordCount(text);
          assert(words >= 150 && words <= 700, `unexpected length: ${words} words`);
          assert(text.includes(COMPANY), "does not name the company");
          return `${words} words`;
        }
      );
    },
    CASE_TIMEOUT_MS
  );

  it(
    "resume roast succeeds in JSON mode instead of falling back to canned copy",
    async () => {
      const errorSpy = jest.spyOn(loggerService, "error");
      try {
        await runCase(
          "resume_roast",
          async () => {
            const roast = await generateRoast(RESUME, "Sam");
            return JSON.stringify({ score: roast.emojiScore, label: roast.scoreLabel, roast: roast.content });
          },
          (output) => {
            const fellBack = errorSpy.mock.calls.some(([message]) => message === "Error generating roast");
            assert(!fellBack, "roast generation failed and returned the fallback roast");
            return `${wordCount(JSON.parse(output).roast)} words`;
          }
        );
      } finally {
        errorSpy.mockRestore();
      }
    },
    CASE_TIMEOUT_MS
  );

  it(
    "onboarding insight is short plain text",
    async () => {
      await runCase(
        "onboarding_insight",
        () => generateOnboardingInsight({ company: COMPANY, role: ROLE, jobDescription: JOB_DESCRIPTION }),
        (text) => {
          assert(text.trim().length > 40, "insight is empty or trivial");
          assert(!/^#|\n[-*] /.test(text), "insight contains markdown");
          return `${wordCount(text)} words`;
        }
      );
    },
    CASE_TIMEOUT_MS
  );

  it(
    "changelog draft passes its own validation",
    async () => {
      await runCase(
        "changelog",
        async () =>
          JSON.stringify(
            await generateChangelogDraft([
              "feat: add salary range field to applications",
              "fix: dashboard crash when an application has no date",
              "perf: lazy-load the resume viewer",
            ])
          ),
        (output) => {
          const changelog = JSON.parse(output);
          assert(Array.isArray(changelog.categories) && changelog.categories.length > 0, "no categories");
          return `${changelog.categories.length} categories`;
        }
      );
    },
    CASE_TIMEOUT_MS
  );

  it(
    "career advice calls tools and answers from their results (AI SDK path)",
    async () => {
      const model = openai(Models.default) as LanguageModel;
      let toolCalls = 0;

      await runCase(
        "career_advice_tools",
        async () => {
          const start = Date.now();
          const result = await generateText({
            model,
            providerOptions: buildAiSdkProviderOptions(Models.default),
            system: "You are a career advisor. Use tools to look up the user's data before answering.",
            prompt: "How many job applications have I submitted, and how many reached the interview stage?",
            stopWhen: stepCountIs(3),
            tools: {
              getApplicationStats: tool({
                description: "Get counts of the user's job applications by status.",
                inputSchema: z.object({}),
                execute: async () => {
                  toolCalls += 1;
                  return { total: 23, applied: 15, interviewScheduled: 5, offer: 1, rejected: 2 };
                },
              }),
            },
          });
          trackAiGeneration(
            { feature: "career_advice" },
            { model: Models.default, latencyMs: Date.now() - start, ...fromAiSdkUsage(result.totalUsage) }
          );
          return result.text;
        },
        (text) => {
          assert(toolCalls > 0, "model never called the tool");
          assert(text.includes("23"), "answer does not use the tool result (23 applications)");
          return `${toolCalls} tool call(s)`;
        }
      );
    },
    CASE_TIMEOUT_MS
  );
});

if (!LIVE) {
  it("live OpenAI eval is opt-in (set RUN_LIVE_AI_EVAL=1 and OPENAI_API_KEY)", () => {
    expect(LIVE).toBe(false);
  });
}
