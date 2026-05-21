import {
  DEMO_PROTOCOL,
  buildRunPlan,
  computeModelFrameGap,
  formatProtocolYaml,
  summarizePreview,
} from "./experiment.mjs";

const protocol = DEMO_PROTOCOL;
const runPlan = buildRunPlan(protocol);
const summary = summarizePreview(protocol);

const steps = ["intake", "copilot", "breakdown", "prompt", "preview", "results"];
const state = {
  activeStep: "intake",
  protocolGenerated: false,
  previewRun: false,
};

const labels = {
  gain: "收益",
  loss: "损失",
  low: "低概率",
  high: "高概率",
};

function init() {
  renderAll();
  bindEvents();
}

function bindEvents() {
  document.querySelectorAll("[data-step]").forEach((button) => {
    button.addEventListener("click", () => {
      activateStep(button.dataset.step);
    });
  });

  document.querySelector("[data-action='generate']").addEventListener("click", () => {
    state.protocolGenerated = true;
    activateStep("copilot");
    renderAll();
  });

  document.querySelector("[data-action='breakdown']").addEventListener("click", () => {
    activateStep("breakdown");
    renderAll();
  });

  document.querySelector("[data-action='prompt']").addEventListener("click", () => {
    activateStep("prompt");
    renderAll();
  });

  document.querySelectorAll("[data-action='preview']").forEach((button) => {
    button.addEventListener("click", () => {
      state.previewRun = true;
      activateStep("preview");
      renderAll();
      animatePreview();
    });
  });

  document.querySelectorAll("[data-export]").forEach((button) => {
    button.addEventListener("click", () => {
      button.dataset.done = "true";
      button.textContent = "已加入导出包";
    });
  });
}

function activateStep(step) {
  state.activeStep = step;
  document.querySelectorAll(".view").forEach((view) => {
    view.hidden = view.id !== `view-${step}`;
  });
  document.querySelectorAll("[data-step]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.step === step);
  });
}

function renderAll() {
  renderStatus();
  renderIntake();
  renderCopilot();
  renderBreakdown();
  renderPromptLab();
  renderRun();
  renderResults();
  activateStep(state.activeStep);
}

function renderStatus() {
  document.querySelector("[data-total-calls]").textContent = runPlan.totalCalls;
  document.querySelector("[data-cost]").textContent = `$${runPlan.estimatedMaxCostUsd.toFixed(2)}`;
  document.querySelector("[data-parse-rate]").textContent = `${Math.round(summary.overall.parseRate * 100)}%`;
  document.querySelector("[data-protocol-state]").textContent = state.protocolGenerated
    ? "protocol v0.1 ready"
    : "draft";
  document.querySelector("[data-run-state]").textContent = state.previewRun ? "preview complete" : "idle";
}

function renderIntake() {
  document.querySelector("[data-intent]").value = protocol.intent;

  const intakeModes = document.querySelector("[data-intake-modes]");
  intakeModes.innerHTML = protocol.intakeModes
    .map(
      (mode, index) => `
        <button class="${index === 0 ? "is-selected" : ""}" type="button">
          <strong>${mode.label}</strong>
          <small>${mode.description}</small>
        </button>
      `,
    )
    .join("");
}

function renderCopilot() {
  document.querySelector("[data-understood]").textContent = protocol.copilotSummary.understood;
  document.querySelector("[data-hypothesis]").textContent = protocol.hypothesis;
  document.querySelector("[data-top-question]").textContent = protocol.copilotSummary.topQuestion;

  document.querySelector("[data-question-options]").innerHTML = protocol.copilotSummary.options
    .map((option, index) => `<button class="${index === 0 ? "is-selected" : ""}" type="button">${option}</button>`)
    .join("");

  document.querySelector("[data-missing-list]").innerHTML = protocol.copilotSummary.missing
    .map((item) => `<li>${item}</li>`)
    .join("");
}

function renderBreakdown() {
  const conditionGrid = document.querySelector("[data-condition-grid]");
  conditionGrid.innerHTML = protocol.previewCells
    .filter((cell) => cell.model === protocol.models[0].name)
    .map(
      (cell) => `
        <div class="condition-cell">
          <span>${labels[cell.frame]}</span>
          <strong>${labels[cell.probability]}</strong>
          <small>${protocol.design.repetitionsPerCell} reps/model</small>
        </div>
      `,
    )
    .join("");

  const modelList = document.querySelector("[data-model-list]");
  modelList.innerHTML = protocol.models
    .map(
      (model) => `
        <li>
          <span>${model.name}</span>
          <small>${model.provider} · temp ${model.temperature} · ${model.maxTokens} tokens</small>
        </li>
      `,
    )
    .join("");

  document.querySelector("[data-yaml]").textContent = formatProtocolYaml(protocol);

  const taskList = document.querySelector("[data-task-list]");
  taskList.innerHTML = protocol.tasks
    .map(
      (task) => `
        <li class="task-card" data-status="${task.status}">
          <div>
            <span>${task.owner}</span>
            <strong>${task.title}</strong>
            <small>${task.goal}</small>
          </div>
          <em>${task.status}</em>
        </li>
      `,
    )
    .join("");
}

function renderPromptLab() {
  document.querySelector("[data-system-prompt]").textContent = protocol.prompts.system;
  document.querySelector("[data-user-template]").textContent = protocol.prompts.userTemplate;
  document.querySelector("[data-prompt-hash]").textContent = protocol.prompts.hash;

  const checkList = document.querySelector("[data-check-list]");
  checkList.innerHTML = protocol.prompts.checks
    .map(
      (check) => `
        <li class="check-row" data-status="${check.status}">
          <span>${check.label}</span>
          <strong>${check.value}</strong>
        </li>
      `,
    )
    .join("");

  document.querySelector("[data-stage-prompts]").innerHTML = protocol.stagePrompts
    .map(
      (item) => `
        <li>
          <span>${item.stage}</span>
          <strong>${item.prompt}</strong>
        </li>
      `,
    )
    .join("");
}

function renderRun() {
  const runCards = document.querySelector("[data-run-cards]");
  runCards.innerHTML = summary.models
    .map(
      (model) => `
        <div class="run-card">
          <div>
            <span>${model.name}</span>
            <strong>${Math.round(model.parseRate * 100)}% parsed</strong>
          </div>
          <div class="progress-track">
            <span style="width: ${state.previewRun ? 100 : 0}%"></span>
          </div>
          <small>${runPlan.conditionCells} cells · ${runPlan.repetitionsPerCell} reps/cell</small>
        </div>
      `,
    )
    .join("");

  const responseRows = document.querySelector("[data-response-rows]");
  responseRows.innerHTML = protocol.sampleResponses
    .map(
      (row) => `
        <tr>
          <td>${row.model}</td>
          <td>${row.condition}</td>
          <td>${row.choice}</td>
          <td>${row.confidence}</td>
          <td>${row.rationale}</td>
        </tr>
      `,
    )
    .join("");
}

function renderResults() {
  const metrics = document.querySelector("[data-result-metrics]");
  metrics.innerHTML = summary.models
    .map(
      (model) => `
        <div class="metric">
          <span>${model.name}</span>
          <strong>${Math.round(model.riskSeeking * 100)}%</strong>
          <small>risk-seeking · frame gap ${Math.round(computeModelFrameGap(summary, model.name) * 100)} pp</small>
        </div>
      `,
    )
    .join("");

  const bars = document.querySelector("[data-risk-bars]");
  bars.innerHTML = summary.models
    .map(
      (model) => `
        <div class="bar-row">
          <span>${model.name}</span>
          <div class="bar-track">
            <i style="width: ${Math.round(model.riskSeeking * 100)}%"></i>
          </div>
          <strong>${Math.round(model.riskSeeking * 100)}%</strong>
        </div>
      `,
    )
    .join("");

  const heatmap = document.querySelector("[data-heatmap]");
  heatmap.innerHTML = protocol.previewCells
    .map(
      (cell) => `
        <div class="heat-cell" style="--heat: ${cell.riskSeeking}">
          <span>${cell.model}</span>
          <strong>${labels[cell.frame]} / ${labels[cell.probability]}</strong>
          <em>${Math.round(cell.riskSeeking * 100)}%</em>
        </div>
      `,
    )
    .join("");

  document.querySelector("[data-failed-parses]").textContent = summary.overall.failedParses;
}

function animatePreview() {
  document.querySelectorAll(".progress-track span").forEach((bar, index) => {
    bar.style.width = "0%";
    window.setTimeout(() => {
      bar.style.width = "100%";
    }, 80 + index * 120);
  });
}

init();
