#!/usr/bin/env bash
# Runs the live AI eval (__tests__/evals/openai-model-eval.test.ts) once per model and
# prints a side-by-side summary. Reports land in eval-results/<model>.md with full outputs.
#
#   ./scripts/ai/run-model-eval.sh                      # gpt-4o-mini vs gpt-6-luna
#   ./scripts/ai/run-model-eval.sh gpt-6-luna gpt-6.1-terra
#
# Needs OPENAI_API_KEY in the environment or .env/.env.local (next/jest loads them).
# Costs real money: well under $0.05 per model.
set -uo pipefail
cd "$(dirname "$0")/../.."

models=("$@")
[ ${#models[@]} -eq 0 ] && models=(gpt-4o-mini gpt-6-luna)

status=0
for model in "${models[@]}"; do
  echo "=== $model"
  # A skipped run (no key) writes no report; never let the summary show an old one.
  rm -f "eval-results/$model.json" "eval-results/$model.md"
  OPENAI_DEFAULT_MODEL="$model" RUN_LIVE_AI_EVAL=1 DISABLE_LOGGING=true \
    npx jest __tests__/evals/openai-model-eval.test.ts --runInBand || status=1
done

node -e '
const fs = require("fs");
const models = process.argv.slice(1);
const runs = models
  .map((m) => `eval-results/${m}.json`)
  .filter((f) => fs.existsSync(f))
  .map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
if (!runs.length) process.exit(0);
const features = [...new Set(runs.flatMap((r) => r.results.map((x) => x.feature)))];
const cell = (r, f) => {
  const x = r.results.find((y) => y.feature === f);
  return x ? `${x.passed ? "pass" : "FAIL"} ${(x.latencyMs / 1000).toFixed(1)}s $${x.costUsd.toFixed(5)}` : "-";
};
console.log(["feature", ...runs.map((r) => r.model)].join("\t"));
for (const f of features) console.log([f, ...runs.map((r) => cell(r, f))].join("\t"));
for (const r of runs) {
  const cost = r.results.reduce((a, x) => a + x.costUsd, 0);
  console.log(`${r.model}: total $${cost.toFixed(4)}`);
}
' "${models[@]}"

exit $status
