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

const BEHAVIOR_TASK_LOGIC_CHAIN = "behavior_task_breakdown_v1";

const HUMAN_ONLY_TREATMENTS = [
  {
    pattern: /咖啡|coffee|caffeine|咖啡因/i,
    key: "caffeine",
    treatmentLabel: "喝咖啡",
    cueLabel: "喝咖啡提示",
    conditionLabel: "咖啡提示条件",
    experimentalGroupLabel: "喝咖啡提示",
    controlGroupLabel: "不喝咖啡提示",
    impossiblePhrase: "真的喝咖啡",
  },
  {
    pattern: /睡眠不足|缺觉|熬夜|睡眠|sleep deprivation|sleep/i,
    key: "sleep_deprivation",
    treatmentLabel: "睡眠不足",
    cueLabel: "睡眠不足提示",
    conditionLabel: "睡眠提示条件",
    experimentalGroupLabel: "睡眠不足提示",
    controlGroupLabel: "正常休息提示",
    impossiblePhrase: "真的经历睡眠不足",
  },
  {
    pattern: /压力|stress|焦虑|anxiety/i,
    key: "stress",
    treatmentLabel: "压力",
    cueLabel: "压力提示",
    conditionLabel: "压力提示条件",
    experimentalGroupLabel: "压力提示",
    controlGroupLabel: "无压力提示",
    impossiblePhrase: "真的感到压力",
  },
  {
    pattern: /饥饿|饥饿感|hunger|hungry/i,
    key: "hunger",
    treatmentLabel: "饥饿",
    cueLabel: "饥饿提示",
    conditionLabel: "饥饿提示条件",
    experimentalGroupLabel: "饥饿提示",
    controlGroupLabel: "无饥饿提示",
    impossiblePhrase: "真的感到饥饿",
  },
  {
    pattern: /药物|服药|酒精|alcohol|兴奋剂|stimulant|drug/i,
    key: "substance",
    treatmentLabel: "物质摄入",
    cueLabel: "物质摄入提示",
    conditionLabel: "物质摄入提示条件",
    experimentalGroupLabel: "物质摄入提示",
    controlGroupLabel: "无物质摄入提示",
    impossiblePhrase: "真的摄入物质",
  },
  {
    pattern: /开心|悲伤|愤怒|恐惧|情绪|emotion|mood|happy|sad|angry/i,
    key: "mood",
    treatmentLabel: "情绪",
    cueLabel: "情绪提示",
    conditionLabel: "情绪提示条件",
    experimentalGroupLabel: "情绪提示",
    controlGroupLabel: "中性情绪提示",
    impossiblePhrase: "真的产生人类情绪",
  },
];

export function createIntake({ sourceType = "text", content = "", text = "", fileName = "" }) {
  const normalized = normalizeContent(content || text);
  const lower = normalized.toLowerCase();
  const humanOnlyTreatment = inferHumanOnlyTreatment(normalized);
  const hasRisk = /风险|risk|framing|框架|收益|损失/.test(lower);
  const hasMoral = /道德|trolley|电车|moral/.test(lower);
  const hasBargain = /ultimatum|最后通牒|分配|博弈|game/.test(lower);
  const hasFairness = /公平|公正|合作|互惠|fairness|cooperation|collaboration/.test(lower);
  const theme = humanOnlyTreatment
    ? "prompt_manipulation_benchmark"
    : hasRisk
      ? "risk_framing"
      : hasMoral
        ? "moral_judgment"
        : hasBargain
          ? "ultimatum_game"
          : hasFairness
            ? "fairness_cooperation"
            : "general_behavior";

  return {
    id: `intake_${shortId(normalized || fileName || sourceType)}`,
    sourceType,
    fileName,
    rawContent: normalized,
    extractedCandidates: {
      researchQuestion: inferResearchQuestion(theme, normalized),
      hypothesis: [inferHypothesis(theme, normalized)],
      independentVariables: inferIndependentVariables(theme, normalized),
      dependentVariables: inferDependentVariables(theme, normalized),
      conditions: inferConditions(theme, normalized),
      stimuli: inferStimuli(theme, normalized),
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
      "实验材料来自上传方案、手动输入情境、自动生成情境，还是已有 benchmark？",
      "正式运行前每个条件希望重复采样多少次，才能支撑当前研究目的？",
    ],
    createdAt: new Date().toISOString(),
  };
}

export function buildCopilot(intake, { designPrinciples = "" } = {}) {
  const candidates = intake.extractedCandidates;
  const detailFields = buildCopilotDetailFields({
    intake,
    hypothesisBreakdown: {
      plannedComparisons: ["比较不同条件、不同模型及条件 x 模型差异。"],
    },
  });
  const confirmationDetails = buildSpecificConfirmationDetails(intake);
  const literatureResearch = inferLiteratureResearch(intake);

  const copilot = {
    summary: buildCopilotSummary(candidates),
    hypothesisDraft: formatHypothesisBreakdown({
      question: toQuestion(candidates.hypothesis[0]),
      independentVariables: candidates.independentVariables,
      dependentVariables: candidates.dependentVariables,
      operationalization: ["把实验条件映射为提示词变量，把模型输出映射为可解析字段。"],
      plannedComparisons: ["比较不同条件、不同模型及条件 x 模型差异。"],
    }),
    detailFields,
    confirmationDetails,
    recommendedOutcome: "free_text_coding",
    literatureResearch,
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
  return {
    ...copilot,
    agents: buildAgentWorkflow(intake, copilot),
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

export function buildCopilotGenerationMessages(
  intake,
  { designPrinciples = "", behaviorTaskSystemPrompt = "" } = {},
) {
  const candidates = intake.extractedCandidates;
  const systemPrompt = String(behaviorTaskSystemPrompt || "").trim();
  const principles = systemPrompt ? "" : formatDesignPrinciplesForSystemPrompt(designPrinciples);

  return [
    {
      role: "system",
      content:
        systemPrompt ||
        `${COPILOT_PROMPTS.system}${principles}\n\n` +
          "你正在为 02 细节确认页生成可编辑字段。请遵守：\n" +
          "1. 先把用户字面问题翻译成最小可运行实验草案，再决定分组轴；不要一上来展示完整方法学清单。\n" +
          "2. 如果不能直接经历，例如睡眠、咖啡、压力、饥饿、药物、情绪，先说明模型不能真的经历，再转写为提示词、材料或任务层面的可运行条件，例如喝咖啡提示 vs 不喝咖啡提示。\n" +
          "3. 不要引入用户没有提到的实验主题、材料、理论案例或模型。\n" +
          "4. 优先服务快速预实验，只生成必要确认项。\n" +
          "5. 用实验设计原则在后台保证可检验性、操作化、变量角色、条件平衡和预实验质量。\n" +
          "6. 如果用户只说“不同大语言模型”而没有点名模型，不要列 GPT、Claude、DeepSeek 等品牌；写成“模型名单待在 05 模型与预算中选择”。\n" +
          "7. 不要把模型名单当作 condition_matrix 的条件水平；模型是后续运行维度，实验条件只包含任务、刺激或理论变量。\n" +
          "8. 不要使用 condition_type、control/treatment、framing 这类占位变量，除非用户明确研究这些概念。应从用户的构念中提出具体组别，例如咖啡问题可拆成喝咖啡提示/不喝咖啡提示，时间理解可拆成绝对时间/相对时间/顺序判断/持续时间估计。\n" +
          "9. 如果条件水平需要假设，请标为“建议默认，可编辑”，但仍必须贴合用户给出的任务领域。\n" +
          "10. 给出轻量相关研究调研建议：2-4 个检索式和它们会如何帮助确定分组、材料或指标。\n" +
          "11. 只返回一个 JSON object，不要 markdown，不要解释。",
    },
    {
      role: "user",
      content: `用户原始需求：\n${intake.rawContent}\n\n` +
        `本地保底解析：\n${formatCandidateBrief(candidates)}\n\n` +
        "请生成严格 JSON。内容要具体到当前问题，值尽量短，不要在字符串里使用英文双引号：\n" +
        "{\n" +
        '  "researchQuestion": "一句可检验研究问题",\n' +
        '  "researchGoalSummary": "2 句内的研究目标摘要，只保留用户真实意图",\n' +
        '  "hypothesisBreakdown": {\n' +
        '    "question": "能被数据支持或反驳的假设问题，以问号结尾",\n' +
        '    "constructs": ["当前实验近似测量的构念"],\n' +
        '    "independentVariables": [{"name": "snake_case", "label": "中文名", "levels": [{"id": "snake_case", "label": "中文水平"}]}],\n' +
        '    "dependentVariables": [{"name": "snake_case", "label": "中文名", "measurementType": "free_text_coding|rating_1_10|multiple_choice|benchmark_score"}],\n' +
        '    "operationalization": ["构念如何变成 prompt 条件、响应字段、评分或 coding"],\n' +
        '    "plannedComparisons": ["正式运行前最重要的比较"]\n' +
        "  },\n" +
        '  "detailFields": {\n' +
        '    "variablesAndConditions": "用一句话说明推荐条件分组和主要因变量备选",\n' +
        '    "stimuliAndMaterials": "每组材料或提示词版本如何生成，哪些内容保持一致",\n' +
        '    "outputAndCoding": "因变量、评分方式、输出字段或 benchmark 指标",\n' +
        '    "samplingAndRandomization": "preview 计划、重复试次、随机化和平衡检查",\n' +
        '    "analysisAndQA": "计划比较、解析率和拒答率检查、提示词平衡、解释限制"\n' +
        "  },\n" +
        '  "confirmationDetails": ["用户运行前必须确认的具体细节，4-6 条，必须具体到可编辑决策"],\n' +
        '  "primaryOutcomeRecommendation": "free_text_coding|rating_1_10|multiple_choice|benchmark_score",\n' +
        '  "literatureResearch": {"needed": false, "reason": "是否需要快速文献调研", "queries": ["必要时给出检索式"], "expectedUse": "调研会如何改进实验方案"},\n' +
        '  "warnings": ["会影响解释的限制或风险，最多 3 条"]\n' +
        "}",
    },
  ];
}

export function mergeCopilotDraft(intake, fallbackCopilot, draft = {}) {
  const normalizedDraft = normalizeCopilotDraft(draft);
  const hypothesisBreakdown = normalizedDraft.hypothesisBreakdown || {};
  const question = toQuestion(hypothesisBreakdown.question || normalizedDraft.researchQuestion || fallbackCopilot.hypothesisDraft);
  let confirmationDetails = normalizedDraft.confirmationDetails.length
    ? normalizedDraft.confirmationDetails
    : fallbackCopilot.confirmationDetails;

  if (normalizedDraft.researchQuestion) {
    intake.extractedCandidates.researchQuestion = stripTerminalPunctuation(normalizedDraft.researchQuestion);
  }
  intake.extractedCandidates.hypothesis[0] = question;
  intake.unresolvedQuestions = confirmationDetails;

  const independentVariables = normalizeDraftVariables(hypothesisBreakdown.independentVariables);
  const meaningfulIndependentVariables = independentVariables.filter((variable) => !isGenericVariable(variable));
  if (meaningfulIndependentVariables.length) {
    intake.extractedCandidates.independentVariables = meaningfulIndependentVariables.map(({ name, label }) => ({ name, label }));
    const conditions = meaningfulIndependentVariables
      .filter((variable) => !isModelVariable(variable))
      .filter((variable) => variable.levels.length >= 2)
      .map((variable) => ({
        name: variable.name,
        label: variable.label,
        levels: variable.levels,
      }));
    if (conditions.length) {
      intake.extractedCandidates.conditions = conditions;
    }
  }

  const dependentVariables = normalizeDraftDependentVariables(hypothesisBreakdown.dependentVariables);
  if (dependentVariables.length) {
    intake.extractedCandidates.dependentVariables = dependentVariables.map(({ name, label }) => ({ name, label }));
  }

  if (shouldReplaceConfirmationDetails(confirmationDetails, intake)) {
    confirmationDetails = buildSpecificConfirmationDetails(intake);
  }

  const hypothesisDraft = formatHypothesisBreakdown({
    question,
    constructs: hypothesisBreakdown.constructs,
    independentVariables,
    dependentVariables,
    operationalization: hypothesisBreakdown.operationalization,
    plannedComparisons: hypothesisBreakdown.plannedComparisons,
  });

  const recommendedOutcome = OUTCOME_OPTIONS.includes(normalizedDraft.primaryOutcomeRecommendation)
    ? normalizedDraft.primaryOutcomeRecommendation
    : fallbackCopilot.nextQuestion.options[0].id;

  const copilot = {
    ...fallbackCopilot,
    summary: normalizedDraft.researchGoalSummary || fallbackCopilot.summary,
    hypothesisDraft,
    detailFields: buildCopilotDetailFields({
      intake,
      draftFields: sanitizeDraftDetailFields(normalizedDraft.detailFields),
      hypothesisBreakdown,
      independentVariables: meaningfulIndependentVariables,
      dependentVariables,
    }),
    confirmationDetails,
    recommendedOutcome,
    literatureResearch: normalizedDraft.literatureResearch,
    warnings: [
      ...new Set([
        ...(Array.isArray(fallbackCopilot.warnings) ? fallbackCopilot.warnings : []),
        ...normalizedDraft.warnings,
      ]),
    ],
    generation: {
      source: "llm",
      modelDraftApplied: true,
      logicChain: BEHAVIOR_TASK_LOGIC_CHAIN,
    },
  };
  return {
    ...copilot,
    agents: buildAgentWorkflow(intake, copilot),
  };
}

export function mergeCopilotResearchResults(intake, copilot, searchResult = {}) {
  const rankedResults = rankResearchResults({
    results: Array.isArray(searchResult.results) ? searchResult.results : [],
    intake,
    copilot,
  });
  const literatureResearch = {
    ...(copilot.literatureResearch || {}),
    source: searchResult.source || "openalex",
    searchedAt: searchResult.searchedAt || new Date().toISOString(),
    searchedQueries: Array.isArray(searchResult.searchedQueries) ? searchResult.searchedQueries : [],
    results: rankedResults,
    error: normalizeContent(searchResult.error),
  };
  const enriched = {
    ...copilot,
    literatureResearch,
  };
  return {
    ...enriched,
    agents: buildAgentWorkflow(intake, enriched),
  };
}

function rankResearchResults({ results, intake, copilot }) {
  const context = buildResearchEvidenceContext(intake, copilot);
  return results
    .map((result) => ({
      ...result,
      evidence: scoreResearchResult(result, context),
    }))
    .sort((left, right) =>
      right.evidence.score - left.evidence.score ||
      normalizeNumber(right.citedByCount) - normalizeNumber(left.citedByCount),
    );
}

function buildResearchEvidenceContext(intake, copilot) {
  const candidates = intake?.extractedCandidates || {};
  const conditionText = (Array.isArray(candidates.conditions) ? candidates.conditions : [])
    .flatMap((condition) => [
      condition.name,
      condition.label,
      ...(Array.isArray(condition.levels) ? condition.levels.flatMap((level) => [level.id, level.label]) : []),
    ]);
  const outcomeText = (Array.isArray(candidates.dependentVariables) ? candidates.dependentVariables : [])
    .flatMap((variable) => [variable.name, variable.label, variable.measurementType]);
  const queries = Array.isArray(copilot?.literatureResearch?.queries) ? copilot.literatureResearch.queries : [];

  return new Set(extractEvidenceTerms([
    intake?.rawContent,
    candidates.researchQuestion,
    candidates.hypothesis?.[0],
    ...conditionText,
    ...outcomeText,
    ...queries,
  ].join(" ")));
}

function scoreResearchResult(result, contextTerms) {
  const title = normalizeContent(result?.title || "");
  const abstractSnippet = normalizeContent(result?.abstractSnippet || "");
  const venue = normalizeContent(result?.venue || "");
  const haystack = `${title} ${abstractSnippet} ${venue}`.toLowerCase();
  const titleHaystack = title.toLowerCase();
  const matchedTerms = [...contextTerms]
    .filter((term) => haystack.includes(term))
    .slice(0, 8);
  const titleMatches = matchedTerms.filter((term) => titleHaystack.includes(term));
  const citedByCount = normalizeNumber(result?.citedByCount);
  const year = normalizeNumber(result?.year);
  const currentYear = new Date().getUTCFullYear();
  const recencyBonus = year && currentYear - year <= 5
    ? 10
    : year && currentYear - year <= 10
      ? 5
      : 0;
  const citationBonus = citedByCount > 0 ? Math.min(20, Math.log10(citedByCount + 1) * 10) : 0;
  const titleBonus = titleMatches.length >= 2 ? 10 : titleMatches.length ? 5 : 0;
  const score = Math.min(
    100,
    Math.round(20 + Math.min(40, matchedTerms.length * 10) + citationBonus + recencyBonus + titleBonus),
  );
  const reasons = [];
  if (matchedTerms.length) {
    reasons.push(`title/abstract matches ${matchedTerms.slice(0, 4).join(", ")}`);
  }
  if (citedByCount > 0) {
    reasons.push(`cited ${citedByCount} times`);
  }
  if (year && currentYear - year <= 5) {
    reasons.push(`recent publication (${year})`);
  }
  if (!reasons.length) {
    reasons.push("needs manual screening");
  }

  return {
    strength: score >= 70 ? "high" : score >= 45 ? "medium" : "low",
    score,
    reasons,
    matchedTerms,
  };
}

function extractEvidenceTerms(text) {
  const stopWords = new Set([
    "about",
    "after",
    "and",
    "are",
    "benchmark",
    "between",
    "conditions",
    "different",
    "does",
    "for",
    "from",
    "into",
    "large",
    "language",
    "model",
    "models",
    "should",
    "study",
    "that",
    "the",
    "their",
    "this",
    "with",
  ]);
  const terms = String(text || "")
    .toLowerCase()
    .match(/[\p{L}\p{N}][\p{L}\p{N}-]{2,}/gu) || [];
  return [...new Set(terms)]
    .filter((term) => !stopWords.has(term))
    .slice(0, 30);
}

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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
  return `我理解你想把输入想法整理成一个可快速预实验的 LLM 行为实验。核心问题是：${researchQuestion}。`;
}

function normalizeCopilotDraft(draft) {
  const hypothesisBreakdown = draft && typeof draft.hypothesisBreakdown === "object"
    ? draft.hypothesisBreakdown
    : {};

  return {
    researchQuestion: normalizeContent(draft.researchQuestion),
    researchGoalSummary: normalizeContent(draft.researchGoalSummary),
    hypothesisBreakdown: {
      question: normalizeContent(hypothesisBreakdown.question),
      constructs: normalizeStringList(hypothesisBreakdown.constructs),
      independentVariables: Array.isArray(hypothesisBreakdown.independentVariables)
        ? hypothesisBreakdown.independentVariables
        : [],
      dependentVariables: Array.isArray(hypothesisBreakdown.dependentVariables)
        ? hypothesisBreakdown.dependentVariables
        : [],
      operationalization: normalizeStringList(hypothesisBreakdown.operationalization),
      plannedComparisons: normalizeStringList(hypothesisBreakdown.plannedComparisons),
    },
    confirmationDetails: normalizeStringList(draft.confirmationDetails).slice(0, 5),
    detailFields: normalizeDetailFields(draft.detailFields),
    literatureResearch: normalizeLiteratureResearch(draft.literatureResearch),
    primaryOutcomeRecommendation: normalizeContent(draft.primaryOutcomeRecommendation),
    warnings: normalizeStringList(draft.warnings).slice(0, 3),
  };
}

function normalizeLiteratureResearch(value = {}) {
  if (!value || typeof value !== "object") {
    return {
      needed: false,
      reason: "",
      queries: [],
      expectedUse: "",
    };
  }

  return {
    needed: Boolean(value.needed),
    reason: normalizeContent(value.reason),
    queries: normalizeStringList(value.queries).slice(0, 4),
    expectedUse: normalizeContent(value.expectedUse),
  };
}

function normalizeDetailFields(fields = {}) {
  if (!fields || typeof fields !== "object") {
    return {};
  }
  return {
    variablesAndConditions: normalizeContent(fields.variablesAndConditions),
    stimuliAndMaterials: normalizeContent(fields.stimuliAndMaterials),
    outputAndCoding: normalizeContent(fields.outputAndCoding),
    samplingAndRandomization: normalizeContent(fields.samplingAndRandomization),
    analysisAndQA: normalizeContent(fields.analysisAndQA),
  };
}

function buildCopilotDetailFields({
  intake,
  draftFields = {},
  hypothesisBreakdown = {},
  independentVariables = [],
  dependentVariables = [],
}) {
  if (isPromptManipulationBenchmarkIntake(intake)) {
    return buildPromptManipulationBenchmarkDetailFields({ intake, draftFields, hypothesisBreakdown });
  }

  const fallbackVariables = independentVariables.length
    ? independentVariables
    : intake.extractedCandidates.independentVariables.map((variable) => ({
        ...variable,
        levels: intake.extractedCandidates.conditions.find((condition) => condition.name === variable.name)?.levels || [],
      }));
  const fallbackOutcomes = dependentVariables.length
    ? dependentVariables
    : intake.extractedCandidates.dependentVariables;
  const conditionText = intake.extractedCandidates.conditions
    .map((condition) => `${condition.label}: ${condition.levels.map((level) => level.label).join(" / ")}`)
    .join("；");

  return {
    variablesAndConditions:
      draftFields.variablesAndConditions ||
      `建议默认，可编辑：条件分组先按「${conditionText || fallbackVariables.map((item) => item.label).join("、")}」划定；主要因变量可从下方备选项选择。请确认这些组别是否真的对应你的研究问题。`,
    stimuliAndMaterials:
      draftFields.stimuliAndMaterials ||
      `建议默认，可编辑：每个条件先准备 1-2 个短材料或任务版本，用于 preview。材料可以来自上传方案、手动输入、自动生成，或已有 benchmark。`,
    outputAndCoding:
      draftFields.outputAndCoding ||
      `因变量备选：${fallbackOutcomes.map((item) => item.label).join("、")}。若选择自由回答，需要 coding schema；若选择评分，需要量表锚点；若选择 benchmark，需要名称、链接或指标定义。`,
    samplingAndRandomization:
      draftFields.samplingAndRandomization ||
      `建议默认，可编辑：先 preview 每组 3-5 题或材料，检查解析率、拒答率、字段缺失和条件是否平衡；正式运行前再确认重复试次和随机化顺序。`,
    analysisAndQA:
      draftFields.analysisAndQA ||
      `计划比较：${normalizeStringList(hypothesisBreakdown.plannedComparisons).join("；") || "条件主效应、模型差异和条件 x 模型交互"}。\n质量检查：解析率、拒答率、字段缺失、条件文本长度和措辞平衡、成本。`,
  };
}

function buildPromptManipulationBenchmarkDetailFields({ intake, draftFields = {}, hypothesisBreakdown = {} }) {
  const treatment = inferHumanOnlyTreatment(intake.rawContent) || inferHumanOnlyTreatment(
    intake.extractedCandidates?.researchQuestion || "",
  ) || defaultPromptManipulationTreatment();
  const condition = intake.extractedCandidates?.conditions?.[0];
  const levelLabels = condition?.levels?.map((level) => level.label).filter(Boolean) || getTreatmentLevelLabels(treatment);
  const variablesDraftIsUsable = hasPromptManipulationSignals(draftFields.variablesAndConditions, treatment);
  const stimuliDraftIsUsable = hasPromptManipulationSignals(draftFields.stimuliAndMaterials, treatment);
  const samplingDraftIsUsable = hasPromptManipulationSignals(draftFields.samplingAndRandomization, treatment);

  return {
    variablesAndConditions:
      variablesDraftIsUsable
        ? draftFields.variablesAndConditions
        : `模型不能${treatment.impossiblePhrase}，所以这里不是改变模型本身，而是把字面想法落成两组提示条件。建议默认，可编辑：${treatment.conditionLabel} =「${levelLabels[0]}」vs「${levelLabels[1]}」；因变量从下方选择，常见是 benchmark score、正确率或任务得分。`,
    stimuliAndMaterials:
      stimuliDraftIsUsable
        ? draftFields.stimuliAndMaterials
        : `建议默认，可编辑：先选择 1-2 个经典 benchmark 或小型下游任务集合；同一道题生成「${levelLabels[0]}」和「${levelLabels[1]}」两版提示，任务正文、输出格式和评分规则保持一致。`,
    outputAndCoding:
      draftFields.outputAndCoding ||
      "因变量备选：benchmark_score、accuracy/pass_rate、answer、confidence、rationale。若 benchmark 有标准答案，优先自动判分；若是开放任务，需要 scoring rubric 或 coding schema。",
    samplingAndRandomization:
      samplingDraftIsUsable
        ? draftFields.samplingAndRandomization
        : `建议默认，可编辑：preview 每组先跑 3-5 道题；正式运行时按 benchmark item 随机化顺序，并让同一道题在「${levelLabels[0]}」和「${levelLabels[1]}」下配对比较，同时检查两版提示长度和措辞差异。`,
    analysisAndQA:
      draftFields.analysisAndQA ||
      `计划比较：${normalizeStringList(hypothesisBreakdown.plannedComparisons).join("；") || `${levelLabels.join(" vs ")} 的 benchmark score 差异`}。\n质量检查：确认两组材料只改变${getTreatmentCueLabel(treatment)}，不改变任务难度、题目文本、输出格式或评分规则。`,
  };
}

function buildSpecificConfirmationDetails(intake) {
  const conditions = Array.isArray(intake.extractedCandidates?.conditions)
    ? intake.extractedCandidates.conditions
    : [];
  const dependentVariables = Array.isArray(intake.extractedCandidates?.dependentVariables)
    ? intake.extractedCandidates.dependentVariables
    : [];
  const details = [];

  if (isPromptManipulationBenchmarkIntake(intake)) {
    const treatment = inferHumanOnlyTreatment(intake.rawContent) || inferHumanOnlyTreatment(
      intake.extractedCandidates?.researchQuestion || "",
    ) || defaultPromptManipulationTreatment();
    const condition = intake.extractedCandidates?.conditions?.[0];
    const levelLabels = condition?.levels?.map((level) => level.label).filter(Boolean) || getTreatmentLevelLabels(treatment);
    return [
      `是否采用实验组「${levelLabels[0]}」与对照组「${levelLabels[1]}」这两个条件水平？`,
      `两组是否只改变${getTreatmentCueLabel(treatment)}，任务正文、输出格式、评分规则和模型设置都保持一致？`,
      "下游表现用哪个 benchmark 或任务集合衡量？请填写 benchmark 名称、链接，或先使用小型知识问答/推理题集合。",
      "主要指标采用 benchmark score、正确率、通过率，还是模型自评信心？是否保留理由文本作为辅助分析？",
      "同一道 benchmark item 是否在两个 prompt 条件下配对运行，并随机化题目顺序？",
    ];
  }

  for (const condition of conditions.slice(0, 2)) {
    const levels = Array.isArray(condition.levels)
      ? condition.levels.map((level) => level.label).filter(Boolean)
      : [];
    if (condition.label && levels.length >= 2) {
      details.push(`${condition.label}是否采用「${levels.slice(0, 3).join(" / ")}」这组水平？如不合适，请改成更贴近你材料的水平。`);
    }
  }

  const primaryOutcome = dependentVariables[0]?.label || "主因变量";
  const secondaryOutcomes = dependentVariables.slice(1).map((item) => item.label).filter(Boolean);
  details.push(`${primaryOutcome}是否作为主因变量？${secondaryOutcomes.length ? `「${secondaryOutcomes.join("、")}」是否作为辅助字段？` : "是否还需要添加信心、理由或反应类型等辅助字段？"}`);
  details.push("实验材料是由系统先生成每个条件 1-2 条短情境，还是使用你上传/粘贴的方案材料改写？");
  details.push("如果保留自由回答或理由字段，是否需要先生成 coding schema，用于把文本答案转成可统计标签？");

  return details.slice(0, 5);
}

function shouldReplaceConfirmationDetails(details = [], intake) {
  if (!Array.isArray(details) || details.length < 3) {
    return true;
  }

  const conditionLabels = (intake.extractedCandidates?.conditions || [])
    .flatMap((condition) => [
      condition.label,
      ...(Array.isArray(condition.levels) ? condition.levels.map((level) => level.label) : []),
    ])
    .filter(Boolean);
  const joined = details.join("\n");
  const specificHits = conditionLabels.filter((label) => joined.includes(label)).length;
  const genericHits = details.filter((detail) =>
    /主要因变量|测量形式|实验材料来自|重复采样|模型范围|benchmark 表现|上传方案/.test(detail),
  ).length;

  return specificHits === 0 || genericHits >= 2;
}

function inferHumanOnlyTreatment(content) {
  const text = String(content || "");
  return HUMAN_ONLY_TREATMENTS.find((treatment) => treatment.pattern.test(text)) || null;
}

function defaultPromptManipulationTreatment() {
  return {
    key: "state",
    treatmentLabel: "目标状态",
    cueLabel: "目标线索",
    conditionLabel: "目标线索分组",
    experimentalGroupLabel: "目标线索组",
    impossiblePhrase: "真的经历该状态",
  };
}

function conditionNameForTreatment(treatment) {
  return `${treatment.key}_prompt_condition`;
}

function getTreatmentCueLabel(treatment) {
  return treatment.cueLabel || `${treatment.treatmentLabel}线索`;
}

function getTreatmentGroupLabel(treatment) {
  return treatment.experimentalGroupLabel || `${getTreatmentCueLabel(treatment)}组`;
}

function getTreatmentLevelLabels(treatment) {
  return [getTreatmentGroupLabel(treatment), treatment.controlGroupLabel || "中性对照提示"];
}

function inferLiteratureResearch(intake) {
  const raw = normalizeContent(intake?.rawContent || "");
  const question = normalizeContent(intake?.extractedCandidates?.researchQuestion || raw);
  const treatment = inferHumanOnlyTreatment(raw) || inferHumanOnlyTreatment(question);
  const conditions = intake?.extractedCandidates?.conditions || [];
  const conditionLabels = conditions.map((condition) => condition.label).filter(Boolean);
  const outcomeLabels = (intake?.extractedCandidates?.dependentVariables || [])
    .map((variable) => variable.label)
    .filter(Boolean);

  if (treatment) {
    return {
      needed: true,
      reason: "建议在生成最终材料前快速查看类似 prompt 条件、prime 或 benchmark 操作方式，避免提示差异混入任务难度。",
      queries: [
        `LLM prompt priming ${treatment.treatmentLabel} benchmark performance`,
        `large language model prompt condition neutral control benchmark`,
        `${treatment.treatmentLabel} prompt manipulation LLM evaluation`,
      ],
      expectedUse: "用于确定提示版本如何写、哪些 benchmark 更合适，以及两组材料需要保持哪些控制项一致。",
    };
  }

  const construct = conditionLabels[0] || outcomeLabels[0] || truncate(question, 18) || "LLM behavior";
  return {
    needed: true,
    reason: "建议先做轻量调研，确认是否已有类似 LLM 行为实验、常见条件划分和可复用 benchmark。",
    queries: [
      `${construct} large language model behavior experiment`,
      `${construct} LLM evaluation benchmark`,
      `${construct} prompt experiment model behavior`,
    ],
    expectedUse: "用于补充分组轴、材料来源、因变量定义和质量检查，不会替用户自动定稿。",
  };
}

function buildAgentWorkflow(intake, copilot) {
  const candidates = intake.extractedCandidates || {};
  const conditions = Array.isArray(candidates.conditions) ? candidates.conditions : [];
  const dependentVariables = Array.isArray(candidates.dependentVariables) ? candidates.dependentVariables : [];
  const conditionSummary = conditions.length
    ? conditions.map((condition) => `${condition.label}: ${condition.levels.map((level) => level.label).join(" / ")}`).join("；")
    : "等待用户确认条件分组";
  const outcomeSummary = dependentVariables.length
    ? dependentVariables.map((variable) => variable.label).join("、")
    : "等待选择主要因变量";
  const research = copilot.literatureResearch || inferLiteratureResearch(intake);
  const queries = Array.isArray(research.queries) ? research.queries.slice(0, 3) : [];
  const results = Array.isArray(research.results) ? research.results : [];
  const critiqueOutputs = buildDesignCritiqueOutputs(intake, copilot, conditionSummary, outcomeSummary);

  return [
    {
      id: "intake_agent",
      name: "需求理解 Agent",
      role: "把自然语言输入翻译成最小可运行实验草案",
      status: "已完成",
      summary: `已把输入收束为：${stripTerminalPunctuation(candidates.researchQuestion || "待确认研究问题")}。`,
      outputs: [
        `条件草案：${conditionSummary}`,
        `因变量备选：${outcomeSummary}`,
        "下一步：请确认这些分组是否符合你的字面研究意图。",
      ],
    },
    {
      id: "research_scout_agent",
      name: "相关研究调研 Agent",
      role: "给出类似研究、benchmark 或任务范式的检索方向",
      status: research.needed === false ? "可选" : "建议查看",
      summary: research.reason || "建议先做轻量调研，避免重复造材料或选错 benchmark。",
      outputs: [
        ...(results.length ? [`已检索：找到 ${results.length} 条 OpenAlex 结果。`] : []),
        ...(queries.length ? queries.map((query) => `检索式：${query}`) : ["检索式：LLM behavior experiment benchmark"]),
        `用途：${research.expectedUse || "用于修正分组、材料和因变量定义。"}`,
      ],
    },
    {
      id: "design_critic_agent",
      name: "方法审查 Agent",
      role: "检查实验分组、材料差异和结果指标是否可解释",
      status: "待用户确认",
      summary: "检查条件是否只改变目标变量、模型是否被误当成实验条件、因变量是否可统计。",
      outputs: critiqueOutputs,
    },
  ];
}

function buildDesignCritiqueOutputs(intake, copilot, conditionSummary, outcomeSummary) {
  const outputs = [
    "模型不是实验条件：模型选择保留到 05 模型与预算，02 页只确认理论条件和材料差异。",
  ];
  const treatment = inferHumanOnlyTreatment(intake.rawContent || intake.extractedCandidates?.researchQuestion || "");
  if (treatment) {
    outputs.push(`状态不可直接操纵：模型不能${treatment.impossiblePhrase}，因此只比较提示/材料版本。`);
  }
  outputs.push(`条件检查：${conditionSummary}`);
  outputs.push(`因变量检查：${outcomeSummary}`);
  if (copilot?.detailFields?.samplingAndRandomization) {
    outputs.push("预实验检查：先看解析率、拒答率、字段缺失和条件文本是否平衡。");
  }
  return outputs.slice(0, 5);
}

function hasPromptManipulationSignals(value, treatment = defaultPromptManipulationTreatment()) {
  const text = normalizeContent(value).toLowerCase();
  return Boolean(text) &&
    /prompt|prime|上下文|线索|提示|分组|实验组|对照组|neutral|benchmark|正确率|通过率/.test(text) &&
    text.includes(treatment.treatmentLabel.toLowerCase().replace(/\s+/g, ""));
}

function isPromptManipulationBenchmarkIntake(intake) {
  const text = [
    intake?.rawContent,
    intake?.extractedCandidates?.researchQuestion,
    ...(intake?.extractedCandidates?.conditions || []).flatMap((condition) => [
      condition.name,
      condition.label,
      ...(Array.isArray(condition.levels) ? condition.levels.map((level) => level.label) : []),
    ]),
  ].join(" ");
  return Boolean(inferHumanOnlyTreatment(text)) ||
    /prompt_manipulation|prompt_condition|cue_condition|cue_group|neutral_control_group|coffee_prompt|caffeine_prompt|sleep_deprivation_prompt/i.test(text);
}

function formatCandidateBrief(candidates) {
  return [
    `researchQuestion: ${candidates.researchQuestion}`,
    `hypothesis: ${candidates.hypothesis.join("；")}`,
    `independentVariables: ${candidates.independentVariables.map((item) => `${item.name}:${item.label}`).join("；")}`,
    `dependentVariables: ${candidates.dependentVariables.map((item) => `${item.name}:${item.label}`).join("；")}`,
    `conditions: ${candidates.conditions
      .map((condition) => `${condition.name}:${condition.label}=[${condition.levels.map((level) => `${level.id}:${level.label}`).join(", ")}]`)
      .join("；")}`,
    `stimuli: ${candidates.stimuli.join("；")}`,
  ].join("\n");
}

function normalizeDraftVariables(variables = []) {
  return variables
    .map((variable, index) => {
      const label = normalizeContent(variable.label || variable.name);
      const name = snakeCase(variable.name || label || `variable_${index + 1}`);
      const levels = Array.isArray(variable.levels)
        ? variable.levels
            .map((level, levelIndex) => {
              const levelLabel = normalizeContent(level.label || level.id);
              return {
                id: snakeCase(level.id || levelLabel || `level_${levelIndex + 1}`),
                label: levelLabel || `水平 ${levelIndex + 1}`,
              };
            })
            .filter((level) => level.id && level.label)
        : [];
      return label ? { name, label, levels } : null;
    })
    .filter(Boolean);
}

function normalizeDraftDependentVariables(variables = []) {
  return variables
    .map((variable, index) => {
      const label = normalizeContent(variable.label || variable.name);
      const name = snakeCase(variable.name || label || `outcome_${index + 1}`);
      const measurementType = OUTCOME_OPTIONS.includes(variable.measurementType)
        ? variable.measurementType
        : "";
      return label ? { name, label, measurementType } : null;
    })
    .filter(Boolean);
}

function isModelVariable(variable = {}) {
  const text = `${variable.name || ""} ${variable.label || ""}`.toLowerCase();
  return /(^|[_\s])(model|models|llm|llms)([_\s]|$)/.test(text) || /模型|大语言模型/.test(text);
}

function isGenericVariable(variable = {}) {
  const text = `${variable.name || ""} ${variable.label || ""}`.toLowerCase();
  return /(^|[_\s])(condition|condition_type|control|treatment|framing)([_\s]|$)/.test(text) ||
    /实验条件|控制条件|表述方式|中性表述|显著表述/.test(text);
}

function sanitizeDraftDetailFields(fields = {}) {
  const sanitized = { ...fields };
  const variableText = normalizeContent(sanitized.variablesAndConditions);
  if (
    /condition\s*[×x]\s*model/i.test(variableText) ||
    /条件.*模型/.test(variableText) ||
    /待用户提供具体实验情境/.test(variableText)
  ) {
    sanitized.variablesAndConditions = "";
  }
  return sanitized;
}

function formatHypothesisBreakdown({
  question,
  constructs = [],
  independentVariables = [],
  dependentVariables = [],
  operationalization = [],
  plannedComparisons = [],
}) {
  const lines = [`核心假设问题：${question}`];
  const constructText = normalizeStringList(constructs).join("、");
  if (constructText) lines.push(`构念：${constructText}`);
  if (independentVariables.length) {
    lines.push(`自变量：${independentVariables.map((item) => item.label).join("、")}`);
  }
  if (dependentVariables.length) {
    lines.push(`因变量：${dependentVariables.map((item) => item.label).join("、")}`);
  }
  if (operationalization.length) {
    lines.push(`操作化：${operationalization.join("；")}`);
  }
  if (plannedComparisons.length) {
    lines.push(`计划比较：${plannedComparisons.join("；")}`);
  }
  return lines.join("\n");
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
  if (theme === "fairness_cooperation") {
    return "不同大语言模型在合作任务中的公平偏好是否存在可观察差异？";
  }
  if (theme === "moral_judgment") {
    return "不同大语言模型在道德困境中的判断是否呈现系统性差异？";
  }
  if (theme === "ultimatum_game") {
    return "不同大语言模型在分配博弈中的接受/拒绝行为是否不同？";
  }
  if (theme === "prompt_manipulation_benchmark") {
    const treatment = inferHumanOnlyTreatment(content) || defaultPromptManipulationTreatment();
    const [experimentalGroup, controlGroup] = getTreatmentLevelLabels(treatment);
    return `将同一任务拆成${experimentalGroup}与${controlGroup}，是否会影响大语言模型在下游 benchmark 或任务中的表现？`;
  }
  return content ? `围绕“${truncate(content, 36)}”设计一个 LLM 行为实验。` : "设计一个可运行的 LLM 行为实验。";
}

function inferHypothesis(theme, content = "") {
  if (theme === "risk_framing") {
    return "损失框架会提高模型选择风险选项的概率，且不同模型的框架效应强度不同。";
  }
  if (theme === "fairness_cooperation") {
    return "合作任务中的分配公平性会影响模型选择公平方案的概率，且不同模型的公平偏好强度不同。";
  }
  if (theme === "moral_judgment") {
    return "模型在功利主义与义务论表述下的判断会出现稳定差异。";
  }
  if (theme === "ultimatum_game") {
    return "分配比例越不公平，模型越可能拒绝提案。";
  }
  if (theme === "prompt_manipulation_benchmark") {
    const treatment = inferHumanOnlyTreatment(content) || defaultPromptManipulationTreatment();
    const [experimentalGroup, controlGroup] = getTreatmentLevelLabels(treatment);
    return `${experimentalGroup}相比${controlGroup}可能改变模型输出或任务表现；需要比较两组在同一批 benchmark item 上的得分差异。`;
  }
  return "不同实验条件会导致模型输出分布出现可观察差异。";
}

function inferIndependentVariables(theme, content = "") {
  if (theme === "risk_framing") {
    return [
      { name: "frame", label: "决策框架" },
      { name: "probability", label: "概率水平" },
    ];
  }
  if (theme === "fairness_cooperation") {
    return [
      { name: "allocation_fairness", label: "分配公平性" },
      { name: "partner_contribution", label: "伙伴贡献比例" },
      { name: "model", label: "模型" },
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
  if (theme === "prompt_manipulation_benchmark") {
    const treatment = inferHumanOnlyTreatment(content) || defaultPromptManipulationTreatment();
    return [
      { name: conditionNameForTreatment(treatment), label: treatment.conditionLabel },
      { name: "benchmark_item", label: "下游任务题目" },
    ];
  }
  return [
    { name: "condition", label: "实验条件" },
    { name: "model", label: "模型" },
  ];
}

function inferDependentVariables(theme, content) {
  if (theme === "prompt_manipulation_benchmark") {
    return [
      { name: "benchmark_score", label: "benchmark 得分" },
      { name: "accuracy", label: "正确率/通过率" },
      { name: "rationale", label: "一句话理由" },
    ];
  }

  const fields = [{ name: "choice", label: "A/B 选择" }];
  if (/信心|confidence|评分|rating|likert/i.test(content)) {
    fields.push({ name: "confidence", label: "1-7 信心评分" });
  } else {
    fields.push({ name: "confidence", label: "1-7 信心评分" });
  }
  fields.push({ name: "rationale", label: "一句话理由" });
  return fields;
}

function inferConditions(theme, content = "") {
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
  if (theme === "fairness_cooperation") {
    return [
      {
        name: "allocation_fairness",
        label: "分配公平性",
        levels: [
          { id: "fair_split", label: "公平分配" },
          { id: "self_favoring_split", label: "自利分配" },
        ],
      },
      {
        name: "partner_contribution",
        label: "伙伴贡献比例",
        levels: [
          { id: "equal_contribution", label: "双方贡献相当" },
          { id: "unequal_contribution", label: "伙伴贡献更高" },
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
  if (theme === "prompt_manipulation_benchmark") {
    const treatment = inferHumanOnlyTreatment(content) || defaultPromptManipulationTreatment();
    const [experimentalGroup, controlGroup] = getTreatmentLevelLabels(treatment);
    return [
      {
        name: conditionNameForTreatment(treatment),
        label: treatment.conditionLabel,
        levels: [
          { id: `${treatment.key}_cue_group`, label: experimentalGroup },
          { id: "neutral_control_group", label: controlGroup },
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

function inferStimuli(theme, content = "") {
  if (theme === "risk_framing") {
    return ["疾病防控决策", "投资收益/损失决策"];
  }
  if (theme === "fairness_cooperation") {
    return ["合作收益分配任务", "伙伴贡献与回报分配情境"];
  }
  if (theme === "moral_judgment") {
    return ["电车困境", "资源分配困境"];
  }
  if (theme === "ultimatum_game") {
    return ["10 元分配方案", "100 元分配方案"];
  }
  if (theme === "prompt_manipulation_benchmark") {
    return ["经典 benchmark 题目", "小型下游任务题集"];
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
    const response = await fetch(resolveChatCompletionsUrl(endpoint), {
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

function resolveChatCompletionsUrl(endpoint) {
  const normalized = String(endpoint || "").replace(/\/+$/, "");
  return normalized.endsWith("/chat/completions")
    ? normalized
    : `${normalized}/chat/completions`;
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

function normalizeStringList(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return values
    .map((value) => normalizeContent(value))
    .filter(Boolean);
}

function snakeCase(value) {
  const text = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, "_")
    .replace(/[^\w\u4e00-\u9fa5]+/g, "")
    .replace(/^_+|_+$/g, "");
  if (!text) {
    return "field";
  }
  return /^[a-z_]/.test(text) ? text : `field_${shortId(text)}`;
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
