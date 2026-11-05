/**
 * @jest-environment node
 *
 * Live check that no model we rely on is close to its OpenAI shutdown. Skipped unless
 * RUN_LIVE_AI_EVAL=1 and OPENAI_API_KEY are set. Reading model metadata is free.
 *
 * Models serving production and the rollback model fail the check. Other registered
 * models only appear as warnings in eval-results/model-shutdowns.md, because nothing
 * breaks for users when they retire.
 */
import fs from "node:fs";
import path from "node:path";
import { Models, OpenAIModels } from "@/lib/openai/models";
import { assessModelShutdown, type ShutdownAssessment } from "@/lib/openai/model-lifecycle";

const LIVE_REQUESTED = process.env.RUN_LIVE_AI_EVAL === "1";
const LIVE = LIVE_REQUESTED && Boolean(process.env.OPENAI_API_KEY);
const describeLive = LIVE ? describe : describe.skip;

const REQUIRED: ReadonlySet<string> = new Set([Models.default, Models.fast, Models.rollback]);

async function checkModel(model: string, realFetch: typeof fetch): Promise<ShutdownAssessment> {
  const response = await realFetch(`https://api.openai.com/v1/models/${model}`, {
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
  });

  if (response.status === 404) {
    return { model, shutdownDate: null, daysLeft: null, problem: "not available to this API key (404)" };
  }
  // An auth or outage failure says nothing about the model, so it must not read as a pass.
  if (!response.ok) {
    throw new Error(`Could not read ${model} from the OpenAI models API: HTTP ${response.status}`);
  }

  const { shutdown_date: shutdownDate } = (await response.json()) as { shutdown_date?: unknown };
  return assessModelShutdown(model, shutdownDate);
}

function writeReport(assessments: ShutdownAssessment[]): void {
  const dir = path.join(process.cwd(), "eval-results");
  fs.mkdirSync(dir, { recursive: true });
  const rows = assessments.map(
    (a) =>
      `| ${a.model} | ${REQUIRED.has(a.model) ? "yes" : "no"} | ${a.shutdownDate ?? "none announced"} | ` +
      `${a.daysLeft ?? "-"} | ${a.problem ?? "ok"} |`
  );
  fs.writeFileSync(
    path.join(dir, "model-shutdowns.md"),
    [
      "# OpenAI model shutdowns",
      "",
      `Checked ${new Date().toISOString()}.`,
      "",
      "| Model | Required | Shutdown | Days left | Status |",
      "|---|---|---|---|---|",
      ...rows,
      "",
    ].join("\n")
  );
}

describeLive("OpenAI model lifecycle", () => {
  it("no required model is near shutdown", async () => {
    // jest.setup.js mocks fetch for unit tests; this suite needs the network.
    const realFetch = (globalThis as { __realFetch?: typeof fetch }).__realFetch;
    if (!realFetch) throw new Error("real fetch unavailable; run under the node environment");

    const assessments = await Promise.all(
      Object.values(OpenAIModels).map((model) => checkModel(model, realFetch))
    );
    writeReport(assessments);

    const blocking = assessments.filter((a) => a.problem && REQUIRED.has(a.model));
    expect(blocking.map((a) => `${a.model}: ${a.problem}`)).toEqual([]);
  });
});

if (!LIVE) {
  it("live model lifecycle check is opt-in (set RUN_LIVE_AI_EVAL=1 and OPENAI_API_KEY)", () => {
    // A requested run with no key fails instead of passing with no report.
    expect(LIVE_REQUESTED).toBe(false);
  });
}
