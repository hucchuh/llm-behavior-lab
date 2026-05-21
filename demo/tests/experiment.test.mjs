import assert from "node:assert/strict";

import {
  DEMO_PROTOCOL,
  buildRunPlan,
  computeModelFrameGap,
  formatProtocolYaml,
  summarizePreview,
} from "../experiment.mjs";

const runPlan = buildRunPlan(DEMO_PROTOCOL);

assert.equal(runPlan.conditionCells, 4, "2x2 design should create four condition cells");
assert.equal(runPlan.modelCount, 2, "demo should compare two model configurations");
assert.equal(runPlan.totalCalls, 160, "4 cells x 2 models x 20 repetitions should be 160 calls");
assert.equal(runPlan.estimatedMaxCostUsd, 2.4, "demo budget estimate should stay under the small preview cap");

const summary = summarizePreview(DEMO_PROTOCOL);

assert.equal(summary.overall.parseRate, 0.98, "preview parse rate should round to two decimals");
assert.equal(summary.overall.totalResponses, 160, "summary should preserve the total response count");
assert.equal(summary.models.length, 2, "summary should include both models");
assert.equal(summary.models[0].riskSeeking, 0.59, "risk seeking should be derived from condition cells");
assert.equal(summary.models[1].meanConfidence, 5.8, "confidence should be averaged across cells");

assert.equal(
  computeModelFrameGap(summary, "GPT-5.5"),
  0.16,
  "frame gap should compare loss-frame and gain-frame risk seeking for a model",
);

const yaml = formatProtocolYaml(DEMO_PROTOCOL);

assert.ok(yaml.includes("id: risk-framing-multi-model"));
assert.ok(yaml.includes("primary_outcome: risk_seeking"));
assert.ok(yaml.includes("temperature: 0.7"));
