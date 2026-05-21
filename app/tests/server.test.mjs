import assert from "node:assert/strict";

import { createAppServer } from "../server.mjs";

const server = createAppServer();

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
  assert.ok(
    intakeResponse.data.copilot.nextQuestion.options.some((option) => option.id === "benchmark_score"),
  );
  assert.ok(intakeResponse.data.copilot.prompts.system.includes("内部实验设计原则"));
  assert.ok(intakeResponse.data.copilot.prompts.system.includes("repetitions_per_cell"));

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
  assert.equal(protocolResponse.data.runPlan.totalCalls, 8);

  const runResponse = await post(`${baseUrl}/api/run`, {
    protocol: protocolResponse.data.protocol,
    runSettings: {
      provider: "simulator",
      mode: "preview",
      repetitionsPerCell: 2,
    },
  });
  assert.equal(runResponse.ok, true);
  assert.equal(runResponse.data.run.responses.length, 8);
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

async function post(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  return response.json();
}
