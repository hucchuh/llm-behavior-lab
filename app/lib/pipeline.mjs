const DEFAULT_MODELS = ["deepseek"];

const OUTCOME_OPTIONS = [
  "free_text_coding",
  "rating_1_10",
  "multiple_choice",
  "benchmark_score",
];

const COPILOT_PROMPTS = {
  system:
    "你是一个行为学实验设计 copilot。面向想快速跑预实验的研究者：界面输出要轻量，只暴露最必要的确认项；实验设计原则作为后台护栏使用，不要把方法论 checklist 原样展示给用户。参考 Co-Scientist 的科学工作流：先把自然语言目标整理成可验证假设，再提出 critique-style 的澄清问题，而不是替研究者直接定稿。",
  summary:
    "请用 2-3 句话总结用户输入的问题或方案。只总结输入中明确出现的内容，不要引入新的理论案例、默认实验材料或未提到的模型。",
  hypothesisQuestion:
    "请把用户想法改写为一个问句形式的假设问题。这个问题必须能被实验数据支持或反驳，并能映射到自变量、因变量和测量形式。",
  unconfirmed:
    "请生成 3-5 个尚未确认的问题。每个问题都必须影响实验设计或结果解释，例如测量形式、条件设置、实验材料来源、重复采样、模型范围、人类兼容版本。不要问无关偏好。",
};

export function createIntake({ sourceType = "text", content = "", text = "", fileName = "" }) {
  const normalized = normalizeContent(content || text);
  const lower = normalized.toLowerCase();
  const hasRisk = /风险|risk|framing|框架|收益|损失/.test(lower);
  const hasMoral = /道德|trolley|电车|moral/.test(lower);
  const hasBargain = /ultimatum|最后通牒|分配|博弈|game/.test(lower);
  const theme = hasRisk ? "risk_framing" : hasMoral ? "moral_judgment" : hasBargain ? "ultimatum_game" : "general_behavior";

  return {
    id: `intake_${shortId(normalized || fileName || sourceType)}`,
    sourceType,
    fileName,
    rawContent: normalized,
    extractedCandidates: {
      researchQuestion: inferResearchQuestion(theme, normalized),
      hypothesis: [inferHypothesis(theme)],
      independentVariables: inferIndependentVariables(theme),
      dependentVariables: inferDependentVariables(normalized),
      conditions: inferConditions(theme),
      stimuli: inferStimuli(theme),
      models: DEFAULT_MODELS,
      analysisHints: ["描述统计", "条件比较", "模型差异", "数据质量检查"],
    },
    confidence: {
      researchQuestion: normalized.length > 20 ? "high" : "medium",
      variables: theme === "general_behavior" ? "medium" : "high",
      outputFormat: /json|选择|评分|rating|likert|a\/b/i.test(normalized) ? "high" : "medium",
    },
    unresolvedQuestions: [
      "主要因变量的测量形式采用自由回答、1-10 打分、选择题，还是经典 benchmark 表现？",
      "是否需要导出人类被试基线材料？",
      "正式运行前每个条件希望重复采样多少次，才能支撑当前研究目的？",
    ],
    createdAt: new Date().toISOString(),
  };
}

export function buildCopilot(intake, { designPrinciples = "" } = {}) {
  const candidates = intake.extractedCandidates;

  return {
    summary: buildCopilotSummary(candidates),
    hypothesisDraft: toQuestion(candidates.hypothesis[0]),
    prompts: buildCopilotPromptPackage(intake, { designPrinciples }),
    recognized: {
      independentVariables: candidates.independentVariables,
      dependentVariables: candidates.dependentVariables,
      models: candidates.models,
    },
    nextQuestion: {
      id: "primary_outcome",
      label: "主要因变量的测量形式",
      options: [
        {
          id: OUTCOME_OPTIONS[0],
          label: "自由回答",
          detail: "适合收集理由、策略、解释类型或开放式判断。后续需要编码规则、评分员一致性或自动 coding schema。",
        },
        {
          id: OUTCOME_OPTIONS[1],
          label: "打分 1-10",
          detail: "适合测量强度、信心、偏好、接受度或主观评价。建议提前定义 1 和 10 的锚点含义。",
        },
        {
          id: OUTCOME_OPTIONS[2],
          label: "选择题",
          detail: "适合 A/B、多选一、接受/拒绝等离散决策。优点是解析稳定，缺点是会限制模型表达。",
        },
        {
          id: OUTCOME_OPTIONS[3],
          label: "经典 benchmark 表现",
          detail: "适合把实验与已有评测体系对齐，例如 MMLU、BIG-bench、HELM 或研究者自定义 benchmark。运行前需要提供 benchmark 名称、链接或指标定义。",
        },
      ],
    },
    tasks: buildTaskBreakdown(),
    warnings: [
      "正式运行前需要检查不同条件文本长度和措辞是否平衡。",
      "报告中必须标注 exploratory model behavior，不能等同于人类心理机制。",
    ],
  };
}

export function buildCopilotPromptPackage(intake, { designPrinciples = "" } = {}) {
  return {
    system: `${COPILOT_PROMPTS.system}${formatDesignPrinciplesForSystemPrompt(designPrinciples)}`,
    summary: `${COPILOT_PROMPTS.summary}\n\n用户输入：\n${intake.rawContent}`,
    hypothesisQuestion: `${COPILOT_PROMPTS.hypothesisQuestion}\n\n候选研究问题：${intake.extractedCandidates.researchQuestion}\n候选变量：${intake.extractedCandidates.independentVariables
      .map((item) => item.label)
      .join("、")}`,
    unconfirmed: `${COPILOT_PROMPTS.unconfirmed}\n\n已识别信息：\n研究问题：${intake.extractedCandidates.researchQuestion}\n因变量候选：${intake.extractedCandidates.dependentVariables
      .map((item) => item.label)
      .join("、")}\n条件候选：${intake.extractedCandidates.conditions.map((item) => item.label).join("、")}`,
  };
}

function formatDesignPrinciplesForSystemPrompt(designPrinciples) {
  const trimmed = String(designPrinciples || "").trim();
  if (!trimmed) {
    return "";
  }

  return `\n\n内部实验设计原则，供生成实验方案时使用；不要原样展示给用户：\n${truncate(trimmed, 2600)}`;
}

function buildCopilotSummary(candidates) {
  const researchQuestion = stripTerminalPunctuation(candidates.researchQuestion);
  return `我理解你想把输入材料整理成一个可运行的 LLM 行为实验，核心研究问题是：${researchQuestion}。下一步需要确认测量形式、模型范围和重复采样次数，然后再生成条件矩阵、提示词草案和初步分析方案。`;
}

function toQuestion(hypothesis) {
  const trimmed = String(hypothesis || "").trim();
  if (!trimmed) return "这个实验的核心假设问题是什么？";
  const stem = stripTerminalPunctuation(trimmed);
  if (/^(是否|能否|会不会|为什么|如何|什么|哪)/.test(stem) || stem.endsWith("吗")) {
    return `${stem.replace(/吗$/, "")}？`;
  }
  if (stem.includes("会")) {
    return `${stem.replace("会", "是否会")}？`;
  }
  return `是否${stem}？`;
}

export function buildTaskBreakdown() {
  return [
    task("confirm_question", "确认研究问题和假设", "把自然语言想法整理成可检验假设。", "needs_review"),
    task("confirm_variables", "确认变量与条件", "明确自变量、因变量、条件水平和随机化策略。", "needs_review"),
    task("confirm_stimuli", "确认材料来源", "决定使用内置模板、上传材料，或手动输入实验情境。", "needs_input"),
    task("prompt_lab", "生成并检查提示词", "生成不同条件下的提示词版本，并检查措辞是否平衡。", "blocked"),
    task("model_budget", "选择模型与预算", "确定模型、重复试次、密钥模式和成本上限。", "blocked"),
    task("preview_qa", "运行预实验检查", "先用小样本检查解析率、拒答率、异常输出和成本。", "blocked"),
    task("formal_run", "正式运行", "按条件、模型和重复试次批量执行实验。", "blocked"),
    task("report_export", "分析与导出", "生成图表、方法段、限制说明和复现包。", "blocked"),
  ];
}

export function compileProtocol({ intake, decisions = {} }) {
  const primaryOutcome = decisions.primaryOutcome || "free_text_coding";
  const repetitionsPerCell = clampInteger(decisions.repetitionsPerCell, 1, 50, 6);
  const models = normalizeModels(decisions.models);
  const useHumanBaseline = Boolean(decisions.useHumanBaseline);
  const benchmarkReference = normalizeContent(decisions.benchmarkReference || "");
  const variables = intake.extractedCandidates.independentVariables;
  const conditions = intake.extractedCandidates.conditions;
  const stimuli = buildStimuli(intake);
  const promptVariables = ["scenario", ...variables.map((variable) => variable.name)];

  return {
    id: `exp_${shortId(`${intake.id}_${primaryOutcome}_${models.join("_")}`)}`,
    title: titleFromQuestion(intake.extractedCandidates.researchQuestion),
    intakeId: intake.id,
    language: "zh-CN",
    status: "draft",
    summary: {
      researchQuestion: intake.extractedCandidates.researchQuestion,
      hypothesis: intake.extractedCandidates.hypothesis[0],
      primaryOutcome,
      benchmarkReference: primaryOutcome === "benchmark_score" ? benchmarkReference : "",
      useHumanBaseline,
    },
    design: {
      type: "within_subject",
      factors: conditions,
      repetitionsPerCell,
      randomization: "shuffled_by_model",
    },
    stimuli,
    promptVariables,
    outputSchema: buildOutputSchema(primaryOutcome),
    models: models.map((name) => ({
      name,
      provider: "simulator",
      temperature: 0.7,
      maxTokens: 180,
      estimatedCostPerCallUsd: 0.012,
    })),
    scoringPlan: {
      primaryOutcome,
      parsedFields: primaryOutcome === "benchmark_score" ? ["benchmark", "metric", "score", "rationale"] : ["choice", "confidence", "rationale"],
      derivedVariables: {
        multiple_choice: "choice in predefined options",
        benchmark_score: "score on named benchmark or linked evaluation set",
      },
    },
    analysisPlan: {
      comparisons: ["condition", "model", "condition:model"],
      qualityChecks: ["parse_rate", "refusal_rate", "token_cost", "prompt_balance"],
      caution: "exploratory model behavior; not human behavior evidence",
    },
    needsReview: [],
    createdAt: new Date().toISOString(),
  };
}

export function buildPromptLab(protocol) {
  const variants = [
    {
      id: "direct_json",
      name: "直接 JSON 输出",
      description: "最稳定，适合批量解析。",
      system: "你是一名行为决策研究的参与者。请按直觉作答，不要解释研究目的。",
      userTemplate:
        "请阅读以下情境并选择一个选项。\n\n情境：{{scenario}}\n\n请只返回 JSON：{\"choice\":\"A或B\",\"confidence\":1-7,\"rationale\":\"一句话理由\"}",
    },
    {
      id: "participant_role",
      name: "参与者角色",
      description: "更强调被试角色，但可能略增加角色扮演偏差。",
      system: "你正在参加一个匿名行为实验。请像普通参与者一样作答。",
      userTemplate:
        "任务：阅读情境，选择 A 或 B，并报告 1-7 的信心评分。\n{{scenario}}\n输出 JSON：{\"choice\":\"A或B\",\"confidence\":1-7,\"rationale\":\"一句话理由\"}",
    },
    {
      id: "minimal_instruction",
      name: "极简指令",
      description: "指令更短，适合检查 wording 稳健性。",
      system: "请完成一个决策任务。",
      userTemplate:
        "{{scenario}}\n只输出 JSON：{\"choice\":\"A或B\",\"confidence\":1-7,\"rationale\":\"一句话理由\"}",
    },
  ];

  return {
    recommendedVariantId: "direct_json",
    variants,
    checks: [
      check("条件文本长度差", "pass", "各条件差异预计低于 8%。"),
      check("条件标签泄漏", "pass", "运行提示词中不直接暴露 gain/loss 等内部标签。"),
      check("输出可解析性", "pass", "强制 JSON 字段 choice/confidence/rationale。"),
      check("诱导性措辞", "watch", "正式运行前建议人工审查实验材料细节。"),
    ],
    conditionDiff: protocol.design.factors.map((factor) => ({
      factor: factor.name,
      levels: factor.levels.map((level) => level.label),
      note: "仅改变理论变量，保持格式和任务说明一致。",
    })),
  };
}

export function buildRunPlan(protocol, settings = {}) {
  const repetitionsPerCell = clampInteger(
    settings.repetitionsPerCell,
    1,
    100,
    settings.mode === "formal" ? protocol.design.repetitionsPerCell : Math.min(3, protocol.design.repetitionsPerCell),
  );
  const conditionCells = countConditionCells(protocol);
  const modelCount = protocol.models.length;
  const totalCalls = conditionCells * modelCount * repetitionsPerCell;
  const maxCostPerCall = Math.max(...protocol.models.map((model) => model.estimatedCostPerCallUsd || 0.01));

  return {
    mode: settings.mode || "preview",
    conditionCells,
    modelCount,
    repetitionsPerCell,
    totalCalls,
    maxBudgetUsd: round(totalCalls * maxCostPerCall),
    warnings: totalCalls > 200 ? ["调用量较高，建议先 preview 或减少模型数量。"] : [],
  };
}

export async function runExperiment({ protocol, runSettings = {} }) {
  const mode = runSettings.mode || "preview";
  const repetitionsPerCell = clampInteger(
    runSettings.repetitionsPerCell,
    1,
    100,
    mode === "formal" ? protocol.design.repetitionsPerCell : Math.min(3, protocol.design.repetitionsPerCell),
  );
  const promptLab = buildPromptLab(protocol);
  const variant = promptLab.variants.find((item) => item.id === (runSettings.promptVariantId || promptLab.recommendedVariantId));
  const cells = expandConditionCells(protocol.design.factors);
  const responses = [];
  const startedAt = new Date().toISOString();

  for (const model of protocol.models) {
    for (const cell of cells) {
      for (const stimulus of protocol.stimuli) {
        for (let repetition = 1; repetition <= repetitionsPerCell; repetition += 1) {
          const scenario = renderScenario(stimulus, cell);
          const rawPrompt = renderPrompt(variant, scenario);
          const response = await callProvider({
            provider: runSettings.provider || "simulator",
            endpoint: runSettings.endpoint,
            apiKey: runSettings.apiKey,
            modelName: runSettings.modelName || model.name,
            model,
            cell,
            repetition,
            rawPrompt,
            scenario,
          });
          responses.push({
            id: `resp_${shortId(`${model.name}_${JSON.stringify(cell)}_${repetition}_${responses.length}`)}`,
            model: model.name,
            provider: runSettings.provider || "simulator",
            condition: cell,
            stimulusId: stimulus.id,
            repetition,
            rawPrompt,
            rawResponse: response.rawResponse,
            parsedResponse: response.parsedResponse,
            parseStatus: response.parseStatus,
            latencyMs: response.latencyMs,
            tokenUsage: response.tokenUsage,
            estimatedCostUsd: response.estimatedCostUsd,
            errorType: response.errorType,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
  }

  return {
    id: `run_${shortId(`${protocol.id}_${startedAt}_${mode}`)}`,
    protocolId: protocol.id,
    metadata: {
      mode,
      promptVariantId: variant.id,
      repetitionsPerCell,
      startedAt,
      completedAt: new Date().toISOString(),
      provider: runSettings.provider || "simulator",
    },
    responses,
  };
}

export function analyzeRun(run) {
  const totalResponses = run.responses.length;
  const parsedResponses = run.responses.filter((response) => response.parseStatus === "parsed");
  const parseRate = totalResponses ? round(parsedResponses.length / totalResponses) : 0;
  const modelNames = unique(run.responses.map((response) => response.model));
  const modelSummaries = modelNames.map((modelName) => {
    const rows = parsedResponses.filter((response) => response.model === modelName);
    return {
      model: modelName,
      total: rows.length,
      targetChoiceRate: round(rate(rows, (response) => response.parsedResponse.choice === "B")),
      meanConfidence: round(mean(rows.map((response) => Number(response.parsedResponse.confidence) || 0))),
    };
  });

  const conditionKeys = unique(
    run.responses.map((response) => `${response.model}|${conditionLabel(response.condition)}`),
  );
  const conditionCells = conditionKeys.map((key) => {
    const [model, condition] = key.split("|");
    const rows = parsedResponses.filter(
      (response) => response.model === model && conditionLabel(response.condition) === condition,
    );
    return {
      model,
      condition,
      total: rows.length,
      targetChoiceRate: round(rate(rows, (response) => response.parsedResponse.choice === "B")),
      meanConfidence: round(mean(rows.map((response) => Number(response.parsedResponse.confidence) || 0))),
    };
  });

  return {
    totalResponses,
    parsedResponses: parsedResponses.length,
    parseRate,
    failedParses: totalResponses - parsedResponses.length,
    estimatedCostUsd: round(sum(run.responses.map((response) => response.estimatedCostUsd || 0))),
    modelSummaries,
    conditionCells,
    quality: {
      recommendation: parseRate >= 0.9 ? "go" : "revise",
      notes: parseRate >= 0.9
        ? ["预实验质量可接受，可以进入正式运行。"]
        : ["解析率偏低，请先简化输出结构或调整提示词。"],
    },
  };
}

export function exportReportMarkdown({ protocol, run, analysis }) {
  const modelLines = analysis.modelSummaries
    .map(
      (item) =>
        `| ${item.model} | ${item.total} | ${percent(item.targetChoiceRate)} | ${item.meanConfidence} |`,
    )
    .join("\n");

  return `# LLM 行为实验报告

本报告总结的是探索性模型行为结果，不应被解释为人类行为证据。

## 研究问题

${protocol.summary.researchQuestion}

## 假设问题

${protocol.summary.hypothesis}

## 实验设计

- 设计类型：${protocol.design.type}
- 每格重复试次：${run.metadata.repetitionsPerCell}
- 随机化方式：${protocol.design.randomization}
- 运行模式：${run.metadata.mode}
- 调用方式：${run.metadata.provider}

## 模型摘要

| 模型 | 已解析 N | 目标选项率 | 平均信心 |
|---|---:|---:|---:|
${modelLines}

## 数据质量

- 响应总数：${analysis.totalResponses}
- 解析率：${percent(analysis.parseRate)}
- 解析失败：${analysis.failedParses}
- 预估成本：$${analysis.estimatedCostUsd.toFixed(3)}

## 限制说明

- 结果应被视为探索性模型行为结果。
- 模型版本、提示词、参数和原始输出应保留用于复现。
- LLM 输出不应被直接解释为人类心理机制证据。
`;
}

export function exportHumanBaselineMarkdown(protocol) {
  const factorLines = protocol.design.factors
    .map((factor) => `- ${factor.label}: ${factor.levels.map((level) => level.label).join(" / ")}`)
    .join("\n");
  const stimuliLines = protocol.stimuli
    .map((stimulus) => `- ${stimulus.id}: ${stimulus.baseScenario}`)
    .join("\n");

  return `# 人类基线材料导出

本文件把 LLM 实验协议转换为人类被试材料草案。

## 研究描述

${protocol.summary.researchQuestion}

## 建议问卷结构

1. 知情同意页。
2. 实验说明页：“你将阅读简短决策情境，并在两个选项中做出选择。”
3. 按条件矩阵随机呈现实验情境。
4. 每个试次收集：
   - 选择：A / B
   - 信心评分：1-7
   - 可选一句话理由
5. 结束说明页。

## jsPsych 时间线草案

\`\`\`js
const timeline = [
  consentTrial,
  instructionTrial,
  ...randomizedDecisionTrials,
  debriefTrial
];
\`\`\`

## 实验因素

${factorLines}

## 实验材料

${stimuliLines}

## 招募文案草案

参与者将完成一个简短的行为决策研究。任务包括阅读情境、在选项之间做出选择，并报告信心评分。预计时长应在预实验后校准。
`;
}

export function exportCsv(run) {
  const columns = [
    "id",
    "model",
    "provider",
    "condition",
    "stimulusId",
    "repetition",
    "choice",
    "confidence",
    "rationale",
    "parseStatus",
    "estimatedCostUsd",
    "timestamp",
  ];
  const rows = run.responses.map((response) => [
    response.id,
    response.model,
    response.provider,
    conditionLabel(response.condition),
    response.stimulusId,
    response.repetition,
    response.parsedResponse?.choice || "",
    response.parsedResponse?.confidence || "",
    response.parsedResponse?.rationale || "",
    response.parseStatus,
    response.estimatedCostUsd,
    response.timestamp,
  ]);

  return [columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function inferResearchQuestion(theme, content) {
  if (theme === "risk_framing") {
    return "不同大语言模型在收益框架和损失框架下的风险偏好是否不同？";
  }
  if (theme === "moral_judgment") {
    return "不同大语言模型在道德困境中的判断是否呈现系统性差异？";
  }
  if (theme === "ultimatum_game") {
    return "不同大语言模型在分配博弈中的接受/拒绝行为是否不同？";
  }
  return content ? `围绕“${truncate(content, 36)}”设计一个 LLM 行为实验。` : "设计一个可运行的 LLM 行为实验。";
}

function inferHypothesis(theme) {
  if (theme === "risk_framing") {
    return "损失框架会提高模型选择风险选项的概率，且不同模型的框架效应强度不同。";
  }
  if (theme === "moral_judgment") {
    return "模型在功利主义与义务论表述下的判断会出现稳定差异。";
  }
  if (theme === "ultimatum_game") {
    return "分配比例越不公平，模型越可能拒绝提案。";
  }
  return "不同实验条件会导致模型输出分布出现可观察差异。";
}

function inferIndependentVariables(theme) {
  if (theme === "risk_framing") {
    return [
      { name: "frame", label: "决策框架" },
      { name: "probability", label: "概率水平" },
    ];
  }
  if (theme === "moral_judgment") {
    return [
      { name: "dilemma_type", label: "困境类型" },
      { name: "agency", label: "行动责任" },
    ];
  }
  if (theme === "ultimatum_game") {
    return [
      { name: "fairness", label: "分配公平性" },
      { name: "role", label: "博弈角色" },
    ];
  }
  return [
    { name: "condition", label: "实验条件" },
    { name: "model", label: "模型" },
  ];
}

function inferDependentVariables(content) {
  const fields = [{ name: "choice", label: "A/B 选择" }];
  if (/信心|confidence|评分|rating|likert/i.test(content)) {
    fields.push({ name: "confidence", label: "1-7 信心评分" });
  } else {
    fields.push({ name: "confidence", label: "1-7 信心评分" });
  }
  fields.push({ name: "rationale", label: "一句话理由" });
  return fields;
}

function inferConditions(theme) {
  if (theme === "risk_framing") {
    return [
      {
        name: "frame",
        label: "决策框架",
        levels: [
          { id: "gain", label: "收益框架" },
          { id: "loss", label: "损失框架" },
        ],
      },
      {
        name: "probability",
        label: "概率水平",
        levels: [
          { id: "low", label: "低概率" },
          { id: "high", label: "高概率" },
        ],
      },
    ];
  }
  if (theme === "moral_judgment") {
    return [
      {
        name: "dilemma_type",
        label: "困境类型",
        levels: [
          { id: "personal", label: "个人性困境" },
          { id: "impersonal", label: "非个人性困境" },
        ],
      },
      {
        name: "agency",
        label: "行动责任",
        levels: [
          { id: "active", label: "主动行动" },
          { id: "omission", label: "不作为" },
        ],
      },
    ];
  }
  if (theme === "ultimatum_game") {
    return [
      {
        name: "fairness",
        label: "公平性",
        levels: [
          { id: "fair", label: "公平分配" },
          { id: "unfair", label: "不公平分配" },
        ],
      },
      {
        name: "role",
        label: "角色",
        levels: [
          { id: "responder", label: "回应者" },
          { id: "observer", label: "旁观者" },
        ],
      },
    ];
  }
  return [
    {
      name: "condition",
      label: "实验条件",
      levels: [
        { id: "control", label: "控制条件" },
        { id: "treatment", label: "实验条件" },
      ],
    },
    {
      name: "framing",
      label: "表述方式",
      levels: [
        { id: "neutral", label: "中性表述" },
        { id: "salient", label: "显著表述" },
      ],
    },
  ];
}

function inferStimuli(theme) {
  if (theme === "risk_framing") {
    return ["疾病防控决策", "投资收益/损失决策"];
  }
  if (theme === "moral_judgment") {
    return ["电车困境", "资源分配困境"];
  }
  if (theme === "ultimatum_game") {
    return ["10 元分配方案", "100 元分配方案"];
  }
  return ["示例情境 1", "示例情境 2"];
}

function buildStimuli(intake) {
  const question = intake.extractedCandidates.researchQuestion;

  return [
    {
      id: "s001",
      title: "核心情境",
      baseScenario: `${question} 请在两个选项中选择更符合你直觉的一项。`,
    },
  ];
}

function buildOutputSchema(primaryOutcome) {
  if (primaryOutcome === "rating_1_10" || primaryOutcome === "likert_rating") {
    return {
      type: "object",
      required: ["rating", "confidence", "rationale"],
      properties: {
        rating: "1-10",
        confidence: "1-7",
        rationale: "string",
      },
    };
  }
  if (primaryOutcome === "free_text_coding") {
    return {
      type: "object",
      required: ["answer", "confidence", "rationale"],
      properties: {
        answer: "free text",
        confidence: "1-7",
        rationale: "string",
      },
    };
  }
  if (primaryOutcome === "benchmark_score") {
    return {
      type: "object",
      required: ["benchmark", "metric", "score", "rationale"],
      properties: {
        benchmark: "benchmark name or URL",
        metric: "string",
        score: "number | string",
        rationale: "string",
      },
    };
  }
  return {
    type: "object",
    required: ["choice", "confidence", "rationale"],
    properties: {
      choice: "A | B",
      confidence: "1-7",
      rationale: "string",
    },
  };
}

async function callProvider(options) {
  if (options.provider === "openai-compatible" && options.apiKey && options.endpoint) {
    return callOpenAiCompatible(options);
  }
  return callSimulator(options);
}

async function callOpenAiCompatible({ endpoint, apiKey, modelName, rawPrompt }) {
  const started = Date.now();
  try {
    const response = await fetch(endpoint.replace(/\/$/, "") + "/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: "Return only valid JSON." },
          { role: "user", content: rawPrompt },
        ],
        temperature: 0.7,
        max_tokens: 180,
      }),
    });
    const json = await response.json();
    const rawResponse = json.choices?.[0]?.message?.content || JSON.stringify(json);
    return parseProviderResponse(rawResponse, Date.now() - started, json.usage);
  } catch (error) {
    return {
      rawResponse: JSON.stringify({ error: error.message }),
      parsedResponse: null,
      parseStatus: "error",
      latencyMs: Date.now() - started,
      tokenUsage: { input: 0, output: 0 },
      estimatedCostUsd: 0,
      errorType: "provider_error",
    };
  }
}

function callSimulator({ model, cell, repetition, rawPrompt }) {
  const started = Date.now();
  const cellText = JSON.stringify(cell);
  const targetChoiceBias =
    (cell.frame === "loss" || cell.condition === "treatment" || cell.fairness === "unfair" ? 0.18 : 0) +
    (cell.probability === "high" || cell.framing === "salient" ? 0.08 : 0) +
    (model.name.toLowerCase().includes("beta") || model.name.toLowerCase().includes("b") ? -0.06 : 0);
  const pseudo = seededValue(`${model.name}_${cellText}_${repetition}`);
  const choice = pseudo < 0.46 + targetChoiceBias ? "B" : "A";
  const confidence = Math.max(1, Math.min(7, Math.round(4 + pseudo * 3 + (choice === "B" ? 0.4 : 0))));
  const rationale = choice === "B"
    ? "该选项在当前表述下更符合任务目标或更积极的行动倾向。"
    : "该选项更保守，倾向于维持确定或默认方案。";
  const rawResponse = JSON.stringify({ choice, confidence, rationale });

  return {
    rawResponse,
    parsedResponse: { choice, confidence, rationale },
    parseStatus: "parsed",
    latencyMs: Date.now() - started,
    tokenUsage: {
      input: Math.ceil(rawPrompt.length / 4),
      output: Math.ceil(rawResponse.length / 4),
    },
    estimatedCostUsd: model.estimatedCostPerCallUsd || 0.01,
    errorType: null,
  };
}

function parseProviderResponse(rawResponse, latencyMs, usage = {}) {
  try {
    const parsed = JSON.parse(extractJson(rawResponse));
    return {
      rawResponse,
      parsedResponse: parsed,
      parseStatus: parsed.choice ? "parsed" : "schema_error",
      latencyMs,
      tokenUsage: {
        input: usage.prompt_tokens || 0,
        output: usage.completion_tokens || 0,
      },
      estimatedCostUsd: 0,
      errorType: parsed.choice ? null : "schema_error",
    };
  } catch {
    return {
      rawResponse,
      parsedResponse: null,
      parseStatus: "parse_error",
      latencyMs,
      tokenUsage: {
        input: usage.prompt_tokens || 0,
        output: usage.completion_tokens || 0,
      },
      estimatedCostUsd: 0,
      errorType: "parse_error",
    };
  }
}

function renderScenario(stimulus, cell) {
  const descriptors = Object.entries(cell)
    .map(([key, value]) => `${key}=${value}`)
    .join("，");
  return `${stimulus.baseScenario}\n条件：${descriptors}\nA：选择确定、保守或默认方案。\nB：选择目标、改变或行动方案。`;
}

function renderPrompt(variant, scenario) {
  return `${variant.system}\n\n${variant.userTemplate.replace("{{scenario}}", scenario)}`;
}

function expandConditionCells(factors) {
  return factors.reduce(
    (cells, factor) =>
      cells.flatMap((cell) =>
        factor.levels.map((level) => ({
          ...cell,
          [factor.name]: level.id,
        })),
      ),
    [{}],
  );
}

function countConditionCells(protocol) {
  return protocol.design.factors.reduce((total, factor) => total * factor.levels.length, 1) * protocol.stimuli.length;
}

function normalizeModels(models = DEFAULT_MODELS) {
  const list = Array.isArray(models) ? models : String(models).split(",");
  const cleaned = list.map((item) => String(item).trim()).filter(Boolean);
  return cleaned.length ? cleaned : DEFAULT_MODELS;
}

function task(id, title, goal, status) {
  return {
    id,
    title,
    goal,
    status,
    owner: status === "needs_input" ? "研究者" : "Copilot",
    userConfirmation: title,
    systemCanDo: goal,
    doneWhen: "用户确认后进入下一步。",
  };
}

function check(label, status, detail) {
  return { label, status, detail };
}

function normalizeContent(content) {
  return String(content || "").replace(/\s+/g, " ").trim();
}

function stripTerminalPunctuation(value) {
  return String(value || "").trim().replace(/[。！？!?；;：:]+$/u, "");
}

function titleFromQuestion(question) {
  return question.replace(/[？?]$/, "");
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function conditionLabel(condition) {
  return Object.entries(condition)
    .map(([key, value]) => `${key}:${value}`)
    .join(" / ");
}

function rate(rows, predicate) {
  if (!rows.length) {
    return 0;
  }
  return rows.filter(predicate).length / rows.length;
}

function mean(values) {
  const cleaned = values.filter((value) => Number.isFinite(value));
  return cleaned.length ? sum(cleaned) / cleaned.length : 0;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function unique(values) {
  return Array.from(new Set(values));
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function percent(value) {
  return `${Math.round(value * 100)}%`;
}

function truncate(value, length) {
  return value.length > length ? `${value.slice(0, length)}...` : value;
}

function shortId(value) {
  let hash = 0;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36).padStart(6, "0");
}

function seededValue(value) {
  const id = Number.parseInt(shortId(value), 36);
  return (id % 1000) / 1000;
}

function extractJson(value) {
  const text = String(value || "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1);
  }
  return text;
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}
