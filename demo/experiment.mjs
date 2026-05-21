export const DEMO_PROTOCOL = {
  id: "risk-framing-multi-model",
  title: "风险偏好在收益/损失框架下的跨模型差异",
  language: "zh-CN",
  intent:
    "比较不同大语言模型在收益框架和损失框架下，对相同概率风险选择的偏好差异。",
  hypothesis:
    "当决策场景被表述为损失框架时，模型更可能选择高风险选项；不同模型的框架效应强度不同。",
  intakeModes: [
    {
      label: "文字输入",
      description: "直接描述研究问题、假设或实验范式。",
    },
    {
      label: "语音输入",
      description: "先转写，再让用户确认文字内容。",
    },
    {
      label: "上传方案",
      description: "支持实验方案、论文方法段、prompt 草稿或合写文档。",
    },
  ],
  copilotSummary: {
    understood:
      "你想做一个 LLM 被试实验，比较收益/损失框架和概率水平如何影响模型的风险选择。",
    topQuestion: "这个实验的主要因变量要用哪一种？",
    options: ["是否选择风险选项", "1-7 风险偏好评分", "自由文本理由再编码"],
    missing: ["stimuli 原始情境数量", "模型列表", "重复采样次数", "是否需要人类基线导出"],
  },
  tasks: [
    {
      title: "确认研究问题和假设",
      owner: "User + Copilot",
      status: "approved",
      goal: "把自然语言想法整理成可检验假设。",
    },
    {
      title: "确认变量与条件矩阵",
      owner: "Copilot",
      status: "needs review",
      goal: "收益/损失框架 x 低/高概率。",
    },
    {
      title: "生成 prompt candidates",
      owner: "Prompt Lab",
      status: "drafted",
      goal: "不同条件只改变理论变量，输出固定 JSON。",
    },
    {
      title: "选择模型与预算",
      owner: "Researcher",
      status: "needs input",
      goal: "确定模型、重复次数和成本上限。",
    },
    {
      title: "运行 preview QA",
      owner: "Runner",
      status: "blocked",
      goal: "检查解析率、拒答率和异常输出。",
    },
  ],
  stagePrompts: [
    {
      stage: "Intake",
      prompt: "只理解输入，不直接设计完整实验；提取问题、变量、条件和缺失信息。",
    },
    {
      stage: "Copilot",
      prompt: "一次只问一个最高优先级澄清问题，优先给出可选答案。",
    },
    {
      stage: "Prompt Lab",
      prompt: "生成 2-3 个 prompt variant，并检查长度、标签泄漏和诱导性措辞。",
    },
    {
      stage: "Preview QA",
      prompt: "只判断是否 ready，不对实验假设做正式结论。",
    },
  ],
  design: {
    type: "within_subject",
    repetitionsPerCell: 20,
    randomization: "shuffled_by_model",
    factors: [
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
    ],
  },
  outcome: {
    primary: "risk_seeking",
    secondary: ["confidence", "rationale_topic"],
    responseFormat: "JSON: { choice: 'A' | 'B', confidence: 1-7, rationale: string }",
  },
  prompts: {
    system: "你是一名行为决策研究的参与者。请按照直觉作答，不要解释研究目的。",
    userTemplate:
      "请阅读以下情境并选择一个选项。\n\n情境：{{scenario}}\n\n请只返回 JSON：{\"choice\":\"A或B\",\"confidence\":1-7,\"rationale\":\"一句话理由\"}",
    hash: "pmt_7d3a91c4",
    checks: [
      { label: "条件文本长度差", value: "4.8%", status: "pass" },
      { label: "条件标签泄漏", value: "0", status: "pass" },
      { label: "解析失败预估", value: "2.0%", status: "watch" },
      { label: "诱导性措辞", value: "低", status: "pass" },
    ],
  },
  models: [
    {
      name: "GPT-5.5",
      provider: "OpenAI",
      temperature: 0.7,
      maxTokens: 120,
      costPerCallUsd: 0.015,
    },
    {
      name: "Claude Sonnet",
      provider: "Anthropic",
      temperature: 0.7,
      maxTokens: 120,
      costPerCallUsd: 0.015,
    },
  ],
  previewCells: [
    {
      model: "GPT-5.5",
      frame: "gain",
      probability: "low",
      total: 20,
      parsed: 20,
      riskSeeking: 0.48,
      meanConfidence: 5.6,
    },
    {
      model: "GPT-5.5",
      frame: "gain",
      probability: "high",
      total: 20,
      parsed: 20,
      riskSeeking: 0.54,
      meanConfidence: 5.7,
    },
    {
      model: "GPT-5.5",
      frame: "loss",
      probability: "low",
      total: 20,
      parsed: 20,
      riskSeeking: 0.62,
      meanConfidence: 6.1,
    },
    {
      model: "GPT-5.5",
      frame: "loss",
      probability: "high",
      total: 20,
      parsed: 19,
      riskSeeking: 0.72,
      meanConfidence: 6.0,
    },
    {
      model: "Claude Sonnet",
      frame: "gain",
      probability: "low",
      total: 20,
      parsed: 20,
      riskSeeking: 0.42,
      meanConfidence: 5.4,
    },
    {
      model: "Claude Sonnet",
      frame: "gain",
      probability: "high",
      total: 20,
      parsed: 19,
      riskSeeking: 0.47,
      meanConfidence: 5.7,
    },
    {
      model: "Claude Sonnet",
      frame: "loss",
      probability: "low",
      total: 20,
      parsed: 20,
      riskSeeking: 0.55,
      meanConfidence: 6.0,
    },
    {
      model: "Claude Sonnet",
      frame: "loss",
      probability: "high",
      total: 20,
      parsed: 19,
      riskSeeking: 0.6,
      meanConfidence: 6.1,
    },
  ],
  sampleResponses: [
    {
      model: "GPT-5.5",
      condition: "loss/high",
      choice: "B",
      confidence: 6,
      rationale: "损失已经明确时，更愿意接受有机会避免损失的风险选项。",
      status: "parsed",
    },
    {
      model: "Claude Sonnet",
      condition: "gain/low",
      choice: "A",
      confidence: 5,
      rationale: "确定收益更稳妥，风险选项的期望优势不足。",
      status: "parsed",
    },
    {
      model: "GPT-5.5",
      condition: "gain/high",
      choice: "B",
      confidence: 5,
      rationale: "较高概率让风险收益看起来更可接受。",
      status: "parsed",
    },
  ],
};

export function buildRunPlan(protocol) {
  const conditionCells = protocol.design.factors.reduce(
    (product, factor) => product * factor.levels.length,
    1,
  );
  const modelCount = protocol.models.length;
  const totalCalls = conditionCells * modelCount * protocol.design.repetitionsPerCell;
  const maxCostPerCall = Math.max(...protocol.models.map((model) => model.costPerCallUsd));

  return {
    conditionCells,
    modelCount,
    repetitionsPerCell: protocol.design.repetitionsPerCell,
    totalCalls,
    estimatedMaxCostUsd: round(totalCalls * maxCostPerCall),
  };
}

export function summarizePreview(protocol) {
  const totalResponses = sum(protocol.previewCells.map((cell) => cell.total));
  const parsedResponses = sum(protocol.previewCells.map((cell) => cell.parsed));
  const models = protocol.models.map((model) => {
    const cells = protocol.previewCells.filter((cell) => cell.model === model.name);

    return {
      name: model.name,
      provider: model.provider,
      riskSeeking: round(average(cells.map((cell) => cell.riskSeeking))),
      meanConfidence: round(average(cells.map((cell) => cell.meanConfidence))),
      parseRate: round(sum(cells.map((cell) => cell.parsed)) / sum(cells.map((cell) => cell.total))),
      cells,
    };
  });

  return {
    overall: {
      totalResponses,
      parsedResponses,
      parseRate: round(parsedResponses / totalResponses),
      failedParses: totalResponses - parsedResponses,
    },
    models,
  };
}

export function computeModelFrameGap(summary, modelName) {
  const model = summary.models.find((item) => item.name === modelName);

  if (!model) {
    return null;
  }

  const gainCells = model.cells.filter((cell) => cell.frame === "gain");
  const lossCells = model.cells.filter((cell) => cell.frame === "loss");
  const gainRisk = average(gainCells.map((cell) => cell.riskSeeking));
  const lossRisk = average(lossCells.map((cell) => cell.riskSeeking));

  return round(lossRisk - gainRisk);
}

export function formatProtocolYaml(protocol) {
  const factorLines = protocol.design.factors
    .map((factor) => {
      const levels = factor.levels.map((level) => level.id).join(", ");

      return `      - name: ${factor.name}\n        levels: [${levels}]`;
    })
    .join("\n");
  const modelLines = protocol.models
    .map(
      (model) =>
        `    - provider: ${model.provider.toLowerCase()}\n      model: ${model.name}\n      parameters:\n        temperature: ${model.temperature}\n        max_tokens: ${model.maxTokens}`,
    )
    .join("\n");

  return `experiment:
  id: ${protocol.id}
  title: ${protocol.title}
  language: ${protocol.language}
  design:
    type: ${protocol.design.type}
    repetitions_per_cell: ${protocol.design.repetitionsPerCell}
    randomization: ${protocol.design.randomization}
    factors:
${factorLines}
  prompts:
    system: "${protocol.prompts.system}"
    hash: ${protocol.prompts.hash}
    output_schema: ${protocol.outcome.responseFormat}
  models:
${modelLines}
  analysis:
    primary_outcome: ${protocol.outcome.primary}
    comparisons: [frame, frame:model]`;
}

function average(values) {
  return sum(values) / values.length;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function round(value) {
  return Math.round(value * 100) / 100;
}
