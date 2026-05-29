import assert from "node:assert/strict";

import {
  analyzeRun,
  buildCopilot,
  buildCopilotGenerationMessages,
  buildPromptLab,
  buildRunPlan,
  compileProtocol,
  createIntake,
  exportReportMarkdown,
  exportHumanBaselineMarkdown,
  mergeCopilotResearchResults,
  mergeCopilotDraft,
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

const cooperationIntake = createIntake({
  sourceType: "text",
  content: "我想比较不同大语言模型在合作任务中的公平偏好。",
});

assert.equal(cooperationIntake.extractedCandidates.conditions[0].name, "allocation_fairness");
assert.equal(cooperationIntake.extractedCandidates.conditions[1].name, "partner_contribution");

const impossibleManipulationIntake = createIntake({
  sourceType: "text",
  content: "我想知道喝咖啡对大语言模型表现是否有影响。",
});
const impossibleManipulationCopilot = buildCopilot(impossibleManipulationIntake);

assert.ok(impossibleManipulationIntake.extractedCandidates.researchQuestion.includes("咖啡"));
assert.ok(impossibleManipulationIntake.extractedCandidates.researchQuestion.includes("喝咖啡提示"));
assert.ok(impossibleManipulationIntake.extractedCandidates.researchQuestion.includes("不喝咖啡提示"));
assert.equal(impossibleManipulationIntake.extractedCandidates.conditions[0].name, "caffeine_prompt_condition");
assert.equal(impossibleManipulationIntake.extractedCandidates.conditions[0].label, "咖啡提示条件");
assert.equal(impossibleManipulationIntake.extractedCandidates.conditions[0].levels[0].label, "喝咖啡提示");
assert.equal(impossibleManipulationIntake.extractedCandidates.conditions[0].levels[1].label, "不喝咖啡提示");
assert.ok(
  impossibleManipulationIntake.extractedCandidates.dependentVariables.some((variable) =>
    variable.name === "benchmark_score"),
  "coffee effect questions should default to downstream benchmark performance",
);
assert.ok(impossibleManipulationCopilot.detailFields.variablesAndConditions.includes("模型不能真的喝咖啡"));
assert.ok(impossibleManipulationCopilot.detailFields.variablesAndConditions.includes("喝咖啡提示"));
assert.ok(impossibleManipulationCopilot.detailFields.stimuliAndMaterials.includes("不喝咖啡提示"));
assert.equal(impossibleManipulationCopilot.detailFields.variablesAndConditions.includes("模型状态"), false);
assert.ok(impossibleManipulationCopilot.confirmationDetails.some((detail) => detail.includes("benchmark")));
assert.ok(impossibleManipulationCopilot.confirmationDetails.some((detail) => detail.includes("喝咖啡提示")));
assert.equal(impossibleManipulationCopilot.confirmationDetails.some((detail) => detail.includes("角色状态")), false);
assert.equal(impossibleManipulationCopilot.literatureResearch.queries.length > 0, true);

const humanOnlyTreatmentIntake = createIntake({
  sourceType: "text",
  content: "我想知道睡眠不足会不会影响大语言模型的推理表现。",
});
const humanOnlyTreatmentCopilot = buildCopilot(humanOnlyTreatmentIntake);

assert.ok(humanOnlyTreatmentIntake.extractedCandidates.researchQuestion.includes("睡眠不足"));
assert.ok(humanOnlyTreatmentIntake.extractedCandidates.researchQuestion.includes("睡眠不足提示"));
assert.ok(humanOnlyTreatmentIntake.extractedCandidates.researchQuestion.includes("正常休息提示"));
assert.equal(humanOnlyTreatmentIntake.extractedCandidates.conditions[0].name, "sleep_deprivation_prompt_condition");
assert.equal(humanOnlyTreatmentIntake.extractedCandidates.conditions[0].levels[0].label, "睡眠不足提示");
assert.equal(humanOnlyTreatmentIntake.extractedCandidates.conditions[0].levels[1].label, "正常休息提示");
assert.ok(
  humanOnlyTreatmentIntake.extractedCandidates.dependentVariables.some((variable) =>
    variable.name === "benchmark_score"),
);
assert.ok(humanOnlyTreatmentCopilot.detailFields.variablesAndConditions.includes("模型不能真的经历"));
assert.ok(humanOnlyTreatmentCopilot.confirmationDetails.some((detail) => detail.includes("睡眠不足提示")));

const copilot = buildCopilot(intake);

assert.ok(copilot.summary.includes("分配博弈"));
assert.equal(copilot.nextQuestion.options.length, 4);
assert.ok(copilot.hypothesisDraft);
assert.ok(copilot.hypothesisDraft.includes("核心假设问题"));
assert.ok(copilot.confirmationDetails.every((detail) => !detail.includes("人类基线")));
assert.ok(copilot.detailFields.variablesAndConditions.includes("条件分组"));
assert.ok(copilot.literatureResearch.queries.length > 0);
assert.equal(copilot.agents.length, 3);
assert.deepEqual(
  copilot.agents.map((agent) => agent.id),
  ["intake_agent", "research_scout_agent", "design_critic_agent"],
);
assert.ok(copilot.agents.find((agent) => agent.id === "research_scout_agent").outputs.some((item) => item.includes("检索式")));
assert.ok(copilot.agents.find((agent) => agent.id === "design_critic_agent").outputs.some((item) => item.includes("模型不是实验条件")));
assert.ok(copilot.prompts.summary.includes("用户输入"));
assert.equal(copilot.nextQuestion.options[0].label, "自由回答");
assert.equal(copilot.nextQuestion.options[3].label, "经典 benchmark 表现");
assert.equal(copilot.tasks[0].status, "needs_review");

const evidenceRankedCopilot = mergeCopilotResearchResults(intake, copilot, {
  source: "openalex",
  searchedQueries: ["LLM behavioral experiment prompt conditions"],
  results: [
    {
      id: "low",
      title: "A general artificial intelligence essay",
      year: 2010,
      citedByCount: 1,
      query: "LLM behavioral experiment prompt conditions",
      abstractSnippet: "A broad essay about technology trends.",
    },
    {
      id: "high",
      title: "Prompting Large Language Models for Behavioral Experiments",
      year: 2024,
      citedByCount: 42,
      query: "LLM behavioral experiment prompt conditions",
      abstractSnippet: "This paper studies prompt conditions in LLM behavioral experiments.",
    },
  ],
});
const rankedResearchResults = evidenceRankedCopilot.literatureResearch.results;
assert.equal(rankedResearchResults[0].id, "high");
assert.equal(rankedResearchResults[0].evidence.strength, "high");
assert.ok(rankedResearchResults[0].evidence.score > rankedResearchResults[1].evidence.score);
assert.ok(rankedResearchResults[0].evidence.reasons.some((reason) => reason.includes("prompt")));

const guidedCopilot = buildCopilot(intake, {
  designPrinciples: "# Internal Guide\n- 操作化定义\n- 计划比较",
});

assert.ok(guidedCopilot.prompts.system.includes("内部实验设计原则"));
assert.ok(guidedCopilot.prompts.system.includes("操作化定义"));

const copilotMessages = buildCopilotGenerationMessages(intake, {
  designPrinciples: "# Internal Guide\n- operationalization\n- planned_comparisons",
});

assert.equal(copilotMessages.length, 2);
assert.ok(copilotMessages[0].content.includes("只返回一个 JSON object"));
assert.ok(copilotMessages[0].content.includes("不要把模型名单当作 condition_matrix"));
assert.ok(copilotMessages[0].content.includes("不要使用 condition_type"));
assert.ok(copilotMessages[0].content.includes("最小可运行实验草案"));
assert.ok(copilotMessages[0].content.includes("轻量相关研究调研建议"));
assert.ok(copilotMessages[1].content.includes("researchGoalSummary"));
assert.ok(copilotMessages[1].content.includes("detailFields"));

const externalPromptMessages = buildCopilotGenerationMessages(intake, {
  designPrinciples: "# Very long guide that should not be sent when a dedicated system prompt exists",
  behaviorTaskSystemPrompt: "Dedicated behavior task breakdown system prompt.",
});

assert.equal(externalPromptMessages[0].content, "Dedicated behavior task breakdown system prompt.");
assert.equal(externalPromptMessages[0].content.includes("Very long guide"), false);

const llmIntake = createIntake({
  sourceType: "text",
  content: idea,
});
const llmCopilot = mergeCopilotDraft(llmIntake, copilot, {
  researchQuestion: "公平性是否影响模型接受分配提案？",
  researchGoalSummary: "比较公平与不公平分配条件下，模型作为回应者是否更容易接受提案。",
  hypothesisBreakdown: {
    question: "公平性是否会影响模型接受分配提案的概率？",
    constructs: ["公平偏好", "接受倾向"],
    independentVariables: [
      {
        name: "model",
        label: "大语言模型",
        levels: [
          { id: "deepseek", label: "DeepSeek" },
          { id: "minimax", label: "MiniMax" },
        ],
      },
      {
        name: "fairness",
        label: "分配公平性",
        levels: [
          { id: "fair", label: "公平分配" },
          { id: "unfair", label: "不公平分配" },
        ],
      },
    ],
    dependentVariables: [
      { name: "acceptance", label: "接受提案", measurementType: "multiple_choice" },
    ],
    operationalization: ["用 A/B 选择记录是否接受提案"],
    plannedComparisons: ["比较公平和不公平条件下的接受率"],
  },
  detailFields: {
    variablesAndConditions: "自变量是分配公平性，因变量是是否接受提案。",
    stimuliAndMaterials: "使用不同分配比例的合作任务情境。",
    outputAndCoding: "要求模型返回 accept/reject、confidence 和 rationale。",
    samplingAndRandomization: "先 preview 每格 3 次，正式运行前确认每格重复试次。",
    analysisAndQA: "比较公平与不公平条件接受率，并检查解析率。",
  },
  confirmationDetails: ["确认提案金额和分配比例", "确认是否收集信心评分"],
  literatureResearch: {
    needed: true,
    reason: "需要确认经典任务范式",
    queries: ["ultimatum game fairness preference LLM"],
    expectedUse: "补充刺激模板",
  },
  primaryOutcomeRecommendation: "multiple_choice",
});

assert.equal(llmCopilot.summary.includes("公平与不公平"), true);
assert.equal(llmCopilot.recommendedOutcome, "multiple_choice");
assert.ok(llmCopilot.hypothesisDraft.includes("核心假设问题"));
assert.equal(llmCopilot.confirmationDetails.length >= 4, true);
assert.ok(llmCopilot.confirmationDetails.some((detail) => detail.includes("公平")));
assert.ok(llmCopilot.detailFields.outputAndCoding.includes("accept/reject"));
assert.equal(llmCopilot.literatureResearch.needed, true);
assert.equal(llmCopilot.agents.length, 3);
assert.ok(llmCopilot.agents.find((agent) => agent.id === "design_critic_agent").summary.includes("检查"));
assert.equal(llmIntake.extractedCandidates.conditions[0].name, "fairness");
assert.equal(llmIntake.extractedCandidates.conditions.some((condition) => condition.name === "model"), false);

const genericLlmIntake = createIntake({
  sourceType: "text",
  content: "我想比较不同大语言模型在合作任务中的公平偏好。",
});
const genericLlmCopilot = mergeCopilotDraft(genericLlmIntake, buildCopilot(genericLlmIntake), {
  researchQuestion: "不同模型是否存在公平偏好差异？",
  researchGoalSummary: "比较模型在合作任务中的公平偏好。",
  hypothesisBreakdown: {
    question: "不同模型是否存在公平偏好差异？",
    independentVariables: [
      { name: "condition", label: "实验条件", levels: [{ id: "control", label: "控制条件" }, { id: "treatment", label: "实验条件" }] },
      { name: "model", label: "模型", levels: [{ id: "a", label: "模型 A" }, { id: "b", label: "模型 B" }] },
    ],
    dependentVariables: [{ name: "choice", label: "A/B 选择", measurementType: "multiple_choice" }],
  },
  detailFields: {
    variablesAndConditions: "当前包含 condition × model，待用户提供具体实验情境后替换。",
  },
  primaryOutcomeRecommendation: "multiple_choice",
});

assert.equal(genericLlmIntake.extractedCandidates.conditions[0].name, "allocation_fairness");
assert.equal(genericLlmIntake.extractedCandidates.conditions.some((condition) => condition.name === "condition"), false);
assert.ok(genericLlmCopilot.detailFields.variablesAndConditions.includes("分配公平性"));

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
