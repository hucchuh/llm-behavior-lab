import assert from "node:assert/strict";

import {
  analyzeRun,
  buildCopilot,
  buildPromptLab,
  buildRunPlan,
  compileProtocol,
  createIntake,
  exportReportMarkdown,
  exportHumanBaselineMarkdown,
  runExperiment,
} from "../lib/pipeline.mjs";

const idea =
  "我想比较不同大语言模型在公平和不公平分配情境下，作为回应者是否会接受提案，并收集1-7信心评分。";

const intake = createIntake({
  sourceType: "text",
  content: idea,
});

assert.equal(intake.sourceType, "text");
assert.equal(intake.confidence.researchQuestion, "high");
assert.ok(intake.extractedCandidates.researchQuestion.includes("分配博弈"));
assert.ok(intake.unresolvedQuestions.length > 0);

const copilot = buildCopilot(intake);

assert.ok(copilot.summary.includes("分配博弈"));
assert.equal(copilot.nextQuestion.options.length, 4);
assert.ok(copilot.hypothesisDraft);
assert.ok(copilot.hypothesisDraft.endsWith("？"));
assert.ok(copilot.prompts.summary.includes("用户输入"));
assert.equal(copilot.nextQuestion.options[0].label, "自由回答");
assert.equal(copilot.nextQuestion.options[3].label, "经典 benchmark 表现");
assert.equal(copilot.tasks[0].status, "needs_review");

const guidedCopilot = buildCopilot(intake, {
  designPrinciples: "# Internal Guide\n- 操作化定义\n- 计划比较",
});

assert.ok(guidedCopilot.prompts.system.includes("内部实验设计原则"));
assert.ok(guidedCopilot.prompts.system.includes("操作化定义"));

const benchmarkProtocol = compileProtocol({
  intake,
  decisions: {
    primaryOutcome: "benchmark_score",
    benchmarkReference: "MMLU-Pro",
    models: ["deepseek"],
  },
});

assert.equal(benchmarkProtocol.summary.benchmarkReference, "MMLU-Pro");
assert.ok(benchmarkProtocol.outputSchema.required.includes("score"));

const protocol = compileProtocol({
  intake,
  decisions: {
    primaryOutcome: "target_choice",
    repetitionsPerCell: 4,
    models: ["Model A", "Model B"],
    useHumanBaseline: true,
  },
});

assert.equal(protocol.design.factors.length, 2);
assert.equal(protocol.models.length, 2);
assert.equal(protocol.design.repetitionsPerCell, 4);
assert.equal(protocol.outputSchema.required.includes("choice"), true);
assert.equal(protocol.design.factors[0].name, "fairness");

const promptLab = buildPromptLab(protocol);

assert.equal(promptLab.variants.length, 3);
assert.equal(promptLab.checks.every((check) => check.status !== "fail"), true);
assert.ok(promptLab.recommendedVariantId);

const runPlan = buildRunPlan(protocol, {
  mode: "preview",
  repetitionsPerCell: 3,
});

assert.equal(runPlan.conditionCells, 4);
assert.equal(runPlan.totalCalls, 24);
assert.equal(runPlan.maxBudgetUsd > 0, true);

const run = await runExperiment({
  protocol,
  runSettings: {
    provider: "simulator",
    mode: "preview",
    repetitionsPerCell: 3,
  },
});

assert.equal(run.responses.length, 24);
assert.equal(run.responses.every((response) => response.rawPrompt && response.rawResponse), true);
assert.equal(run.metadata.mode, "preview");

const analysis = analyzeRun(run);

assert.equal(analysis.totalResponses, 24);
assert.equal(analysis.parseRate, 1);
assert.equal(analysis.modelSummaries.length, 2);
assert.equal(analysis.conditionCells.length, 8);

const report = exportReportMarkdown({ protocol, run, analysis });

assert.ok(report.includes("# LLM 行为实验报告"));
assert.ok(report.includes("探索性模型行为"));
assert.ok(report.includes("Model A"));

const humanBaseline = exportHumanBaselineMarkdown(protocol);

assert.ok(humanBaseline.includes("# 人类基线材料导出"));
assert.ok(humanBaseline.includes("建议问卷结构"));
assert.ok(humanBaseline.includes("jsPsych"));
