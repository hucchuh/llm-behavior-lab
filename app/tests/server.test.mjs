import assert from "node:assert/strict";

import { createAppServer } from "../server.mjs";

let capturedLlmRequest = null;
const capturedResearchUrls = [];
const server = createAppServer({
  env: {
    MINIMAX_API_KEY: "test-key",
    MINIMAX_ENDPOINT: "https://lightingtheword.com/v1/chat/completions",
    MINIMAX_MODEL: "MiniMax-M2.7",
  },
  fetch: async (url, options) => {
    const href = String(url);
    if (href.startsWith("https://api.openalex.org/works")) {
      capturedResearchUrls.push(href);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          results: [
            {
              id: "https://openalex.org/W123",
              display_name: "Prompting Large Language Models for Behavioral Experiments",
              publication_year: 2024,
              cited_by_count: 42,
              doi: "https://doi.org/10.1234/example",
              primary_location: {
                landing_page_url: "https://example.org/prompting-llm-behavior",
                source: { display_name: "Journal of LLM Behavior" },
              },
              authorships: [
                { author: { display_name: "Ada Researcher" } },
                { author: { display_name: "Bo Methodologist" } },
              ],
              abstract_inverted_index: {
                This: [0],
                paper: [1],
                studies: [2],
                prompt: [3],
                conditions: [4],
              },
            },
          ],
        }),
      };
    }
    capturedLlmRequest = {
      url,
      authorization: options.headers.authorization,
      body: JSON.parse(options.body),
    };
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                researchQuestion: "分配公平性是否影响模型接受提案？",
                researchGoalSummary: "比较公平与不公平分配条件下，大语言模型是否更容易接受公平提案。",
                hypothesisBreakdown: {
                  question: "分配公平性是否会影响模型接受提案的概率？",
                  constructs: ["公平偏好", "接受倾向"],
                  independentVariables: [
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
                  plannedComparisons: ["比较公平与不公平条件的接受率"],
                },
                literatureResearch: {
                  needed: true,
                  reason: "需要参考类似 LLM 行为实验和 benchmark。",
                  queries: ["LLM behavioral experiment prompt conditions"],
                  expectedUse: "用于选择条件分组和评分指标。",
                },
                detailFields: {
                  variablesAndConditions: "自变量是分配公平性，条件为公平与不公平。",
                  stimuliAndMaterials: "使用合作任务中的分配方案作为刺激材料。",
                  outputAndCoding: "模型返回是否接受、信心和理由。",
                  samplingAndRandomization: "先 preview 每格 3 次，正式运行再增加重复试次。",
                  analysisAndQA: "比较条件接受率并检查解析失败。",
                },
                confirmationDetails: ["确认具体分配金额", "确认是否收集信心评分"],
                primaryOutcomeRecommendation: "multiple_choice",
              }),
            },
          },
        ],
      }),
    };
  },
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

try {
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const intakeResponse = await post(`${baseUrl}/api/intake`, {
    sourceType: "text",
    content: "我想比较公平和不公平分配对大语言模型接受提案概率的影响。",
  });
  assert.equal(intakeResponse.ok, true);
  assert.ok(intakeResponse.data.intake.id);
  assert.ok(intakeResponse.data.copilot.nextQuestion);
  assert.ok(intakeResponse.data.copilot.hypothesisDraft);
  assert.equal(capturedLlmRequest.url, "https://lightingtheword.com/v1/chat/completions");
  assert.equal(capturedLlmRequest.authorization, "Bearer test-key");
  assert.equal(capturedLlmRequest.body.model, "MiniMax-M2.7");
  assert.equal(capturedLlmRequest.body.response_format.type, "json_object");
  assert.ok(capturedLlmRequest.body.messages[0].content.includes("Behavior Task Breakdown System Prompt"));
  assert.equal(capturedLlmRequest.body.max_tokens, 1100);
  assert.equal(intakeResponse.data.copilot.generation.source, "llm");
  assert.equal(intakeResponse.data.copilot.generation.logicChain, "behavior_task_breakdown_v1");
  assert.equal(Number.isFinite(intakeResponse.data.copilot.generation.latencyMs), true);
  assert.equal(intakeResponse.data.copilot.generation.promptChars > 0, true);
  assert.equal(intakeResponse.data.copilot.recommendedOutcome, "multiple_choice");
  assert.equal(capturedResearchUrls.length, 0, "intake should not block on external literature search");
  assert.equal(intakeResponse.data.copilot.agents.length, 3);
  assert.ok(intakeResponse.data.copilot.agents.some((agent) => agent.id === "research_scout_agent"));
  assert.ok(intakeResponse.data.copilot.agents.some((agent) => agent.id === "design_critic_agent"));
  assert.equal(intakeResponse.data.copilot.confirmationDetails.length >= 4, true);
  assert.ok(intakeResponse.data.copilot.confirmationDetails.some((detail) => detail.includes("公平")));
  assert.ok(intakeResponse.data.copilot.detailFields.variablesAndConditions.includes("公平性"));
  assert.ok(
    intakeResponse.data.copilot.nextQuestion.options.some((option) => option.id === "benchmark_score"),
  );
  assert.ok(intakeResponse.data.copilot.prompts.system.includes("内部实验设计原则"));
  assert.ok(intakeResponse.data.copilot.prompts.system.includes("repetitions_per_cell"));

  const researchResponse = await post(`${baseUrl}/api/research-search`, {
    intake: intakeResponse.data.intake,
    copilot: intakeResponse.data.copilot,
  });
  assert.equal(researchResponse.ok, true);
  assert.equal(capturedResearchUrls.length > 0, true);
  assert.equal(researchResponse.data.literatureResearch.source, "openalex");
  assert.equal(researchResponse.data.literatureResearch.results.length, 1);
  assert.ok(researchResponse.data.literatureResearch.results[0].title.includes("Prompting"));
  assert.equal(researchResponse.data.literatureResearch.results[0].evidence.strength, "high");
  assert.equal(Number.isFinite(researchResponse.data.literatureResearch.results[0].evidence.score), true);
  assert.ok(researchResponse.data.literatureResearch.results[0].evidence.reasons.some((reason) => reason.includes("prompt")));
  assert.ok(researchResponse.data.copilot.agents.find((agent) => agent.id === "research_scout_agent").outputs.some((item) => item.includes("已检索")));

  const protocolResponse = await post(`${baseUrl}/api/protocol`, {
    intake: intakeResponse.data.intake,
    decisions: {
      primaryOutcome: "target_choice",
      repetitionsPerCell: 2,
      models: ["Model A"],
    },
  });
  assert.equal(protocolResponse.ok, true);
  assert.equal(protocolResponse.data.protocol.models.length, 1);
  assert.equal(protocolResponse.data.runPlan.totalCalls, 4);

  const runResponse = await post(`${baseUrl}/api/run`, {
    protocol: protocolResponse.data.protocol,
    runSettings: {
      provider: "simulator",
      mode: "preview",
      repetitionsPerCell: 2,
    },
  });
  assert.equal(runResponse.ok, true);
  assert.equal(runResponse.data.run.responses.length, 4);
  assert.equal(runResponse.data.analysis.parseRate, 1);

  const materialResponse = await post(`${baseUrl}/api/parse-material`, {
    fileName: "proposal.md",
    mimeType: "text/markdown",
    text: "# Study\nCompare two model behaviors.",
  });
  assert.equal(materialResponse.ok, true);
  assert.equal(materialResponse.data.material.parsed, true);
  assert.equal(materialResponse.data.material.kind, "markdown");
  assert.ok(materialResponse.data.material.summary.includes("Study"));
} finally {
  await new Promise((resolve) => server.close(resolve));
}

const repairServer = createAppServer({
  env: {
    MINIMAX_API_KEY: "test-key",
    MINIMAX_ENDPOINT: "https://lightingtheword.com/v1/chat/completions",
    MINIMAX_MODEL: "MiniMax-M2.7",
  },
  fetch: async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [
        {
          message: {
            content:
              '{\n' +
              '  "researchQuestion": "合作任务中的公平偏好是否影响模型选择",\n' +
              '  "researchGoalSummary": "比较模型在合作收益分配任务中的公平选择倾向。"\n' +
              '  "hypothesisBreakdown": {\n' +
              '    "question": "分配公平性是否影响模型选择公平方案的概率？",\n' +
              '    "constructs": ["公平偏好"],\n' +
              '    "independentVariables": [{"name": "allocation_fairness", "label": "分配公平性", "levels": [{"id": "fair", "label": "公平分配"}, {"id": "self_favoring", "label": "自利分配"}]}],\n' +
              '    "dependentVariables": [{"name": "choice", "label": "公平方案选择", "measurementType": "multiple_choice"}],\n' +
              '    "operationalization": ["用合作分配情境作为 prompt 条件"],\n' +
              '    "plannedComparisons": ["比较公平与自利分配条件下的选择率"]\n' +
              '  },\n' +
              '  "detailFields": {\n' +
              '    "variablesAndConditions": "自变量为分配公平性；因变量为公平方案选择。",\n' +
              '    "stimuliAndMaterials": "建议默认，可编辑：每个条件生成 2 个合作分配短情境。",\n' +
              '    "outputAndCoding": "返回 choice、confidence、rationale。",\n' +
              '    "samplingAndRandomization": "建议默认，可编辑：preview 每格 3 次。",\n' +
              '    "analysisAndQA": "检查解析率、拒答率和条件文本平衡。"\n' +
              '  },\n' +
              '  "confirmationDetails": ["确认分配金额", "确认是否收集理由", "确认选择题选项", "确认材料来源"],\n' +
              '  "primaryOutcomeRecommendation": "multiple_choice",\n' +
              '  "literatureResearch": {"needed": false, "reason": "当前输入足以形成预实验草案", "queries": [], "expectedUse": ""},\n' +
              '  "warnings": ["结果只代表模型行为"]\n' +
              '}',
          },
        },
      ],
    }),
  }),
});

await new Promise((resolve) => repairServer.listen(0, "127.0.0.1", resolve));

try {
  const { port } = repairServer.address();
  const repairResponse = await post(`http://127.0.0.1:${port}/api/intake`, {
    sourceType: "text",
    content: "我想比较不同大语言模型在合作任务中的公平偏好。",
  });
  assert.equal(repairResponse.ok, true);
  assert.equal(repairResponse.data.copilot.generation.source, "llm");
  assert.ok(repairResponse.data.copilot.detailFields.variablesAndConditions.includes("分配公平性"));
} finally {
  await new Promise((resolve) => repairServer.close(resolve));
}

async function post(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  return response.json();
}
