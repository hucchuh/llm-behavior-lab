const SESSION_STORAGE_KEY = "llm-behavior-lab.session.v1";

const state = {
  page: "landing",
  authMode: "login",
  mode: "personal",
  user: null,
  activeStep: "intake",
  inputMode: "text",
  attachments: [],
  audioClips: [],
  mediaStream: null,
  mediaRecorder: null,
  audioChunks: [],
  audioStartedAt: null,
  recognizing: false,
  selectedOutcome: "free_text_coding",
  selectedVariantId: null,
  intake: null,
  copilot: null,
  tasks: [],
  protocol: null,
  promptLab: null,
  runPlan: null,
  previewRun: null,
  previewAnalysis: null,
  formalRun: null,
  formalAnalysis: null,
  workspace: {
    name: "LLM 行为实验小组",
    members: [
      { name: "项目负责人", email: "demo@llm-lab.local", role: "负责人", status: "在线" },
      { name: "研究助理", email: "ra@example.edu", role: "编辑", status: "在线" },
      { name: "方法审查员", email: "methods@example.edu", role: "方法审查", status: "离开" },
    ],
    discussion: [
      {
        author: "项目负责人",
        time: "09:12",
        text: "我们想做一个大模型行为实验平台，研究者先描述实验想法，再由细节确认助手整理条件、提示词、模型和分析。",
      },
      {
        author: "研究助理",
        time: "09:24",
        text: "入口最好支持文字、语音和上传方案，但所有材料都先进入细节确认，而不是直接跑实验。",
      },
      {
        author: "方法审查员",
        time: "09:41",
        text: "每一步都应该留出确认关口，尤其是变量、条件矩阵、提示词平衡和预实验质量检查。",
      },
    ],
  },
};

const stepTitles = {
  workspace: "小组工作空间",
  intake: "研究需求输入",
  copilot: "细节确认",
  protocol: "实验协议审查",
  prompt: "提示词检查",
  model: "模型与预算",
  preview: "预实验检查",
  run: "正式运行",
  results: "结果报告",
};

const els = {
  pages: document.querySelectorAll("[data-page]"),
  pageTitle: document.querySelector("[data-page-title]"),
  toast: document.querySelector("[data-toast]"),
  authTitle: document.querySelector("[data-auth-title]"),
  authEmail: document.querySelector("[data-auth-email]"),
  authPassword: document.querySelector("[data-auth-password]"),
  workspaceName: document.querySelector("[data-workspace-name]"),
  memberList: document.querySelector("[data-member-list]"),
  inviteEmail: document.querySelector("[data-invite-email]"),
  discussionFeed: document.querySelector("[data-discussion-feed]"),
  discussionInput: document.querySelector("[data-discussion-input]"),
  inputContent: document.querySelector("[data-input-content]"),
  fileInput: document.querySelector("[data-file-input]"),
  attachmentList: document.querySelector("[data-attachment-list]"),
  voiceButton: document.querySelector("[data-action='voice-hold']"),
  voiceStatus: document.querySelector("[data-voice-status]"),
  copilotSummary: document.querySelector("[data-copilot-summary]"),
  hypothesisDraft: document.querySelector("[data-hypothesis-draft]"),
  detailFields: document.querySelectorAll("[data-detail-field]"),
  confirmationDetails: document.querySelector("[data-confirmation-details]"),
  researchPanel: document.querySelector("[data-research-panel]"),
  researchStatus: document.querySelector("[data-research-status]"),
  researchReason: document.querySelector("[data-research-reason]"),
  researchQueries: document.querySelector("[data-research-queries]"),
  researchResults: document.querySelector("[data-research-results]"),
  researchUse: document.querySelector("[data-research-use]"),
  nextQuestion: document.querySelector("[data-next-question]"),
  outcomeOptions: document.querySelector("[data-outcome-options]"),
  benchmarkField: document.querySelector("[data-benchmark-field]"),
  benchmarkInput: document.querySelector("[data-benchmark-input]"),
  modelsInput: document.querySelector("[data-models-input]"),
  overviewPanel: document.querySelector("[data-overview-panel]"),
  overviewTitle: document.querySelector("[data-overview-title]"),
  overviewSubtitle: document.querySelector("[data-overview-subtitle]"),
  overviewCount: document.querySelector("[data-overview-count]"),
  overviewProgress: document.querySelector("[data-overview-progress]"),
  overviewDetail: document.querySelector("[data-overview-detail]"),
  overviewCurrentStep: document.querySelector("[data-overview-current-step]"),
  overviewProtocol: document.querySelector("[data-overview-protocol]"),
  overviewRun: document.querySelector("[data-overview-run]"),
  taskGrid: document.querySelector("[data-task-grid]"),
  protocolSummary: document.querySelector("[data-protocol-summary]"),
  protocolJson: document.querySelector("[data-protocol-json]"),
  conditionGrid: document.querySelector("[data-condition-grid]"),
  variantList: document.querySelector("[data-variant-list]"),
  promptPreview: document.querySelector("[data-prompt-preview]"),
  promptChecks: document.querySelector("[data-prompt-checks]"),
  conditionDiff: document.querySelector("[data-condition-diff]"),
  provider: document.querySelector("[data-provider]"),
  previewReps: document.querySelector("[data-preview-reps]"),
  formalReps: document.querySelector("[data-formal-reps]"),
  endpoint: document.querySelector("[data-endpoint]"),
  apiKey: document.querySelector("[data-api-key]"),
  runPlan: document.querySelector("[data-run-plan]"),
  previewMetrics: document.querySelector("[data-preview-metrics]"),
  previewTable: document.querySelector("[data-preview-table]"),
  formalMetrics: document.querySelector("[data-formal-metrics]"),
  runLog: document.querySelector("[data-run-log]"),
  resultMetrics: document.querySelector("[data-result-metrics]"),
  modelBars: document.querySelector("[data-model-bars]"),
  heatmap: document.querySelector("[data-heatmap]"),
  reportPreview: document.querySelector("[data-report-preview]"),
};

init();

function init() {
  hydrateSession();
  bindEvents();
  render();
}

function hydrateSession() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(SESSION_STORAGE_KEY) || "{}");
    if (["personal", "team"].includes(stored.mode)) {
      state.mode = stored.mode;
      state.activeStep = defaultStepForMode();
    }
    if (stored.user?.email) {
      state.user = stored.user;
      state.page = "app";
      state.activeStep = defaultStepForMode();
    }
    if (
      stored.workspace &&
      Array.isArray(stored.workspace.members) &&
      Array.isArray(stored.workspace.discussion)
    ) {
      state.workspace = {
        ...state.workspace,
        ...stored.workspace,
      };
    }
  } catch {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  }
  normalizeWorkspaceCopy();
}

function persistSession() {
  try {
    window.localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        mode: state.mode,
        user: state.user,
        workspace: state.workspace,
      }),
    );
  } catch {
    // Local persistence is a convenience for the demo, not a blocker for the workflow.
  }
}

function normalizeWorkspaceCopy() {
  const roleMap = {
    Owner: "负责人",
    Editor: "编辑",
    Reviewer: "方法审查",
    Invited: "已邀请",
  };
  const statusMap = {
    online: "在线",
    away: "离开",
    pending: "待接受",
  };
  const nameMap = {
    "Demo PI": "项目负责人",
    "Research Assistant": "研究助理",
    "Methods Reviewer": "方法审查员",
  };
  const demoTextMap = new Map([
    [
      "我们想做一个大模型行为实验平台，研究者先描述实验想法，再由 Copilot 拆分条件、prompt、模型和分析。",
      "我们想做一个大模型行为实验平台，研究者先描述实验想法，再由细节确认助手整理条件、提示词、模型和分析。",
    ],
    [
      "我们想做一个大模型行为实验平台，研究者先描述实验想法，再由 Copilot 拆分条件、提示词、模型和分析。",
      "我们想做一个大模型行为实验平台，研究者先描述实验想法，再由细节确认助手整理条件、提示词、模型和分析。",
    ],
    [
      "入口最好支持文字、语音和上传方案，但所有材料都先进入 Experiment Copilot，而不是直接跑实验。",
      "入口最好支持文字、语音和上传方案，但所有材料都先进入细节确认，而不是直接跑实验。",
    ],
    [
      "入口最好支持文字、语音和上传方案，但所有材料都先进入实验 Copilot，而不是直接跑实验。",
      "入口最好支持文字、语音和上传方案，但所有材料都先进入细节确认，而不是直接跑实验。",
    ],
    [
      "每一步都应该留出 review gate，尤其是变量、条件矩阵、prompt 平衡和 preview QA。",
      "每一步都应该留出确认关口，尤其是变量、条件矩阵、提示词平衡和预实验质量检查。",
    ],
  ]);

  if (state.workspace.name === "Comparative LLM Behavior Lab") {
    state.workspace.name = "LLM 行为实验小组";
  }
  state.workspace.members = state.workspace.members.map((member) => ({
    ...member,
    name: nameMap[member.name] || member.name,
    role: roleMap[member.role] || member.role,
    status: statusMap[member.status] || member.status,
  }));
  state.workspace.discussion = state.workspace.discussion.map((message) => ({
    ...message,
    author: nameMap[message.author] || message.author,
    text: demoTextMap.get(message.text) || message.text,
  }));
}

function bindEvents() {
  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.mode) {
        setMode(button.dataset.mode, { navigate: false, quiet: true });
      }
      if (button.dataset.authMode) {
        state.authMode = button.dataset.authMode;
      }
      showPage(button.dataset.route);
    });
  });

  document.querySelectorAll("[data-mode-option]").forEach((button) => {
    button.addEventListener("click", () => {
      setMode(button.dataset.modeOption, { navigate: state.page === "app" });
    });
  });

  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.authMode = button.dataset.authTab;
      renderAuth();
    });
  });

  document.querySelectorAll("[data-action='login-demo']").forEach((button) => {
    button.addEventListener("click", loginWithDemo);
  });

  document.querySelector("[data-action='auth-submit']").addEventListener("click", submitAuth);
  document.querySelector("[data-action='logout']").addEventListener("click", logout);
  document.querySelector("[data-action='invite-member']").addEventListener("click", inviteMember);
  document.querySelector("[data-action='post-discussion']").addEventListener("click", postDiscussion);
  document.querySelector("[data-action='use-discussion-as-intake']").addEventListener("click", useDiscussionAsIntake);
  document.querySelectorAll("[data-action='open-overview']").forEach((button) => {
    button.addEventListener("click", openOverview);
  });
  document.querySelectorAll("[data-action='close-overview']").forEach((button) => {
    button.addEventListener("click", closeOverview);
  });
  els.overviewPanel.addEventListener("click", (event) => {
    if (event.target === els.overviewPanel) {
      closeOverview();
    }
  });

  document.querySelectorAll("[data-step-target]").forEach((button) => {
    button.addEventListener("click", () => {
      setStep(button.dataset.stepTarget);
    });
  });

  document.querySelector("[data-action='submit-intake']").addEventListener("click", submitIntake);
  document.querySelector("[data-action='compile-protocol']").addEventListener("click", compileProtocol);
  document.querySelector("[data-action='confirm-protocol']").addEventListener("click", () => setStep("prompt"));
  document.querySelector("[data-action='confirm-prompt']").addEventListener("click", () => {
    updateRunPlan();
    setStep("model");
  });
  document.querySelector("[data-action='run-preview']").addEventListener("click", runPreview);
  document.querySelector("[data-action='run-formal']").addEventListener("click", runFormal);
  document.querySelector("[data-action='show-results']").addEventListener("click", () => setStep("results"));
  document.querySelector("[data-action='export-markdown']").addEventListener("click", () => exportFile("markdown"));
  document.querySelector("[data-action='export-csv']").addEventListener("click", () => exportFile("csv"));
  document.querySelector("[data-action='export-json']").addEventListener("click", exportJson);

  els.fileInput.addEventListener("change", handleFile);
  bindVoiceHold();
  els.provider.addEventListener("change", renderProviderFields);
  els.modelsInput.addEventListener("change", updateRunPlan);
  els.previewReps.addEventListener("input", updateRunPlan);
  els.formalReps.addEventListener("input", updateRunPlan);
}

async function submitIntake() {
  const content = els.inputContent.value.trim();
  const attachmentContent = state.attachments
    .filter((attachment) => attachment.parsed && attachment.text)
    .map((attachment) => `\n\n[上传材料：${attachment.name}]\n${attachment.text}`)
    .join("");
  const combinedContent = `${content}${attachmentContent}`.trim();

  if (!combinedContent) {
    if (state.audioClips.length) {
      showToast("语音已保存。接入转写 API 前，请先补充文字或上传可解析材料。");
      return;
    }
    showToast("请先输入文字或上传可解析材料。");
    return;
  }

  setBusy("submit-intake", true, "正在拆解实验方案...");
  try {
    const response = await api("/api/intake", {
      sourceType: state.inputMode,
      content: combinedContent,
    });
    state.intake = response.intake;
    state.copilot = response.copilot;
    state.selectedOutcome = response.copilot.recommendedOutcome || response.copilot.nextQuestion.options[0].id;
    setStep("copilot");
    showToast("已完成输入解析，请进入细节确认。");
    loadResearchResults();
  } finally {
    setBusy("submit-intake", false);
    render();
  }
}

async function loadResearchResults() {
  if (!state.intake || !state.copilot) {
    return;
  }
  state.copilot.literatureResearch = {
    ...(state.copilot.literatureResearch || {}),
    loading: true,
  };
  renderLiteratureResearch();
  try {
    const response = await api("/api/research-search", {
      intake: state.intake,
      copilot: state.copilot,
    });
    state.copilot = response.copilot;
  } catch (error) {
    state.copilot.literatureResearch = {
      ...(state.copilot.literatureResearch || {}),
      loading: false,
      error: error.message,
    };
  } finally {
    if (state.copilot?.literatureResearch) {
      state.copilot.literatureResearch.loading = false;
    }
    renderLiteratureResearch();
  }
}

async function compileProtocol() {
  if (!state.intake) {
    showToast("请先完成研究需求输入。");
    return;
  }

  syncCopilotEdits();
  setBusy("compile-protocol", true);
  try {
    const models = [els.modelsInput.value].filter(Boolean);
    const response = await api("/api/protocol", {
      intake: state.intake,
      decisions: {
        primaryOutcome: state.selectedOutcome,
        repetitionsPerCell: Number(els.formalReps.value),
        models,
        benchmarkReference: els.benchmarkInput.value.trim(),
        useHumanBaseline: false,
      },
    });
    state.protocol = response.protocol;
    state.tasks = response.tasks;
    state.promptLab = response.promptLab;
    state.runPlan = response.runPlan;
    state.selectedVariantId = response.promptLab.recommendedVariantId;
    setStep("protocol");
    showToast("全局总览已更新，实验协议已生成。");
  } finally {
    setBusy("compile-protocol", false);
    render();
  }
}

async function runPreview() {
  if (!state.protocol) {
    showToast("请先确认实验协议。");
    return;
  }

  syncProtocolModels();
  setBusy("run-preview", true);
  try {
    const response = await api("/api/run", {
      protocol: state.protocol,
      runSettings: readRunSettings("preview"),
    });
    state.previewRun = response.run;
    state.previewAnalysis = response.analysis;
    setStep("preview");
    showToast("预实验检查完成。");
  } finally {
    setBusy("run-preview", false);
    render();
  }
}

async function runFormal() {
  if (!state.previewAnalysis || state.previewAnalysis.quality.recommendation !== "go") {
    showToast("预实验检查尚未通过，建议先修正提示词或模型配置。");
    return;
  }

  syncProtocolModels();
  setBusy("run-formal", true);
  try {
    const response = await api("/api/run", {
      protocol: state.protocol,
      runSettings: readRunSettings("formal"),
    });
    state.formalRun = response.run;
    state.formalAnalysis = response.analysis;
    setStep("run");
    showToast("正式运行已完成。");
  } finally {
    setBusy("run-formal", false);
    render();
  }
}

async function exportFile(format) {
  const run = state.formalRun || state.previewRun;
  const analysis = state.formalAnalysis || state.previewAnalysis;

  if (!run || !analysis) {
    showToast("请先运行实验。");
    return;
  }

  const response = await api("/api/export", {
    format,
    protocol: state.protocol,
    run,
    analysis,
  });
  download(
    format === "csv"
      ? "llm-behavior-results.csv"
      : format === "human-baseline"
        ? "human-baseline-export.md"
        : "llm-behavior-report.md",
    response.content,
    format === "csv" ? "text/csv" : "text/markdown",
  );
}

async function updateRunPlan() {
  if (!state.protocol) {
    return;
  }
  syncProtocolModels();
  state.runPlan = {
    mode: "preview",
    conditionCells: countConditionCells(state.protocol),
    modelCount: state.protocol.models.length,
    repetitionsPerCell: Number(els.previewReps.value),
    totalCalls: countConditionCells(state.protocol) * state.protocol.models.length * Number(els.previewReps.value),
    maxBudgetUsd:
      countConditionCells(state.protocol) *
      state.protocol.models.length *
      Number(els.previewReps.value) *
      0.012,
    warnings: [],
  };
  renderRunPlan();
}

function render() {
  renderPages();
  renderAuth();
  renderMode();
  renderWorkspace();
  renderActiveStep();
  renderSteps();
  renderAttachments();
  renderCopilot();
  renderOverview();
  renderTasks();
  renderProtocol();
  renderPromptLab();
  renderProviderFields();
  renderRunPlan();
  renderPreview();
  renderFormalRun();
  renderResults();
}

function showPage(page) {
  state.page = page;
  if (page === "app" && !state.user) {
    state.page = "auth";
  }
  render();
}

function renderPages() {
  els.pages.forEach((page) => {
    const visible = page.dataset.page === state.page;
    page.hidden = !visible;
    page.classList.toggle("is-visible", visible);
  });
}

function renderAuth() {
  if (!els.authTitle) {
    return;
  }

  els.authTitle.textContent = state.authMode === "register" ? "注册工作空间" : "登录工作空间";
  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.authTab === state.authMode);
  });
}

function renderMode() {
  document.querySelectorAll("[data-mode-option]").forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.modeOption === state.mode);
  });
}

function submitAuth() {
  const email = els.authEmail.value.trim() || "demo@llm-lab.local";
  state.user = {
    name: email.split("@")[0] || "Demo User",
    email,
  };
  persistSession();
  enterApp();
  showToast(
    state.authMode === "register"
      ? state.mode === "team"
        ? "已创建本地演示团队工作空间。"
        : "已创建本地演示个人实验。"
      : "已登录实验流程。",
  );
}

function loginWithDemo(event) {
  const mode = event?.currentTarget?.dataset.mode;
  if (mode) {
    setMode(mode, { navigate: false, quiet: true });
  }
  state.user = {
    name: "项目负责人",
    email: "demo@llm-lab.local",
  };
  els.authEmail.value = "demo@llm-lab.local";
  els.authPassword.value = "demo123";
  persistSession();
  enterApp();
  showToast("已使用演示账号进入工作空间。");
}

function logout() {
  state.user = null;
  persistSession();
  showPage("landing");
  showToast("已退出本地演示账号。");
}

function setStep(step) {
  state.activeStep = step === "workspace" && state.mode !== "team" ? "intake" : step;
  renderActiveStep();
  renderSteps();
}

function renderActiveStep() {
  document.querySelectorAll(".stage").forEach((section) => {
    section.classList.toggle("is-active", section.id === `stage-${state.activeStep}`);
  });
  els.pageTitle.textContent = stepTitles[state.activeStep] || "研究需求输入";
}

function renderSteps() {
  document.querySelectorAll("[data-step-target]").forEach((button) => {
    const target = button.dataset.stepTarget;
    button.hidden = button.dataset.teamOnly === "true" && state.mode !== "team";
    button.classList.toggle("is-active", target === state.activeStep);
    button.disabled = !isStepAvailable(target);
  });
}

function setMode(mode, options = {}) {
  if (!["personal", "team"].includes(mode)) {
    return;
  }

  state.mode = mode;
  if (options.navigate) {
    setStep(defaultStepForMode());
  }
  persistSession();
  if (!options.quiet) {
    render();
  }
}

function defaultStepForMode() {
  return state.mode === "team" ? "workspace" : "intake";
}

function enterApp() {
  state.page = "app";
  setStep(defaultStepForMode());
  render();
}

function renderWorkspace() {
  if (!els.memberList || !els.discussionFeed) {
    return;
  }

  els.workspaceName.textContent = state.mode === "team" ? state.workspace.name : "个人实验";
  els.memberList.innerHTML = state.workspace.members
    .map(
      (member) => `
        <div class="member-card">
          <div>
            <strong>${escapeHtml(member.name)}</strong>
            <span>${escapeHtml(member.email)}</span>
          </div>
          <small>${escapeHtml(member.role)} · ${escapeHtml(member.status)}</small>
        </div>
      `,
    )
    .join("");
  els.discussionFeed.innerHTML = state.workspace.discussion
    .map(
      (message) => `
        <article class="discussion-message">
          <header>
            <strong>${escapeHtml(message.author)}</strong>
            <span>${escapeHtml(message.time)}</span>
          </header>
          <p>${escapeHtml(message.text)}</p>
        </article>
      `,
    )
    .join("");
}

function inviteMember() {
  const email = els.inviteEmail.value.trim();

  if (!email) {
    showToast("请输入要邀请的成员邮箱。");
    return;
  }

  state.workspace.members.push({
    name: email.split("@")[0],
    email,
    role: "已邀请",
    status: "待接受",
  });
  state.workspace.discussion.push({
    author: state.user?.name || "Demo User",
    time: currentTime(),
    text: `邀请了 ${email} 加入这个工作空间。`,
  });
  persistSession();
  els.inviteEmail.value = "";
  renderWorkspace();
  showToast("已添加邀请记录。");
}

function postDiscussion() {
  const text = els.discussionInput.value.trim();

  if (!text) {
    showToast("先写一点讨论内容。");
    return;
  }

  state.workspace.discussion.push({
    author: state.user?.name || "Demo User",
    time: currentTime(),
    text,
  });
  persistSession();
  els.discussionInput.value = "";
  renderWorkspace();
}

function useDiscussionAsIntake() {
  const summary = state.workspace.discussion
    .map((message) => `${message.author}: ${message.text}`)
    .join("\n");
  els.inputContent.value = summary;
  setStep("intake");
  showToast("已把团队讨论带入需求输入框。");
}

function renderAttachments() {
  if (!els.attachmentList) {
    return;
  }

  els.attachmentList.innerHTML = state.attachments
    .map(
      (attachment, index) => `
        <div class="attachment-chip">
          <span>${escapeHtml(attachment.name)}</span>
          <small>${escapeHtml(attachment.kind)} · ${attachment.parsed ? "已解析" : "已保存"} · ${escapeHtml(attachment.summary)}</small>
          <button type="button" data-remove-attachment="${index}">移除</button>
        </div>
      `,
    )
    .join("") + state.audioClips
    .map(
      (clip, index) => `
        <div class="attachment-chip audio-chip">
          <span>语音 ${index + 1}</span>
          <small>${Math.round(clip.durationMs / 1000)}s · ${(clip.blob.size / 1024).toFixed(1)} KB · 等待转写 API</small>
          <button type="button" data-remove-audio="${index}">移除</button>
        </div>
      `,
    )
    .join("");

  els.attachmentList.querySelectorAll("[data-remove-attachment]").forEach((button) => {
    button.addEventListener("click", () => {
      state.attachments.splice(Number(button.dataset.removeAttachment), 1);
      if (!state.attachments.length && state.inputMode === "upload") {
        state.inputMode = "text";
      }
      renderAttachments();
    });
  });

  els.attachmentList.querySelectorAll("[data-remove-audio]").forEach((button) => {
    button.addEventListener("click", () => {
      const clip = state.audioClips.splice(Number(button.dataset.removeAudio), 1)[0];
      if (clip?.url) {
        URL.revokeObjectURL(clip.url);
      }
      if (!state.audioClips.length && state.inputMode === "voice") {
        state.inputMode = "text";
      }
      renderAttachments();
    });
  });
}

function renderCopilot() {
  if (!state.copilot) {
    return;
  }

  els.copilotSummary.value = state.copilot.summary;
  els.hypothesisDraft.value = state.copilot.hypothesisDraft;
  els.detailFields.forEach((field) => {
    field.value = state.copilot.detailFields?.[field.dataset.detailField] || "";
  });
  renderLiteratureResearch();
  els.confirmationDetails.value = formatConfirmationDetails(state.copilot.confirmationDetails);
  els.nextQuestion.textContent = state.copilot.nextQuestion.label;
  els.outcomeOptions.innerHTML = state.copilot.nextQuestion.options
    .map(
      (option) => `
        <button class="${option.id === state.selectedOutcome ? "is-selected" : ""}" type="button" data-outcome="${option.id}">
          <strong>${option.label}</strong>
          <small>${option.detail}</small>
        </button>
      `,
    )
    .join("");
  els.outcomeOptions.querySelectorAll("[data-outcome]").forEach((button) => {
    button.addEventListener("click", () => {
      syncCopilotEdits();
      state.selectedOutcome = button.dataset.outcome;
      renderCopilot();
    });
  });
  els.benchmarkField.hidden = state.selectedOutcome !== "benchmark_score";
}

function renderOverview() {
  if (!els.overviewTitle) {
    return;
  }

  const workflow = state.mode === "team"
    ? ["workspace", "intake", "copilot", "protocol", "prompt", "model", "preview", "run", "results"]
    : ["intake", "copilot", "protocol", "prompt", "model", "preview", "run", "results"];
  const activeIndex = Math.max(workflow.indexOf(state.activeStep), 0);
  const total = state.mode === "team" ? 9 : 8;
  const progress = Math.min(activeIndex + 1, total);
  const nextAction = getOverviewNextAction();

  els.overviewTitle.textContent = nextAction.title;
  els.overviewSubtitle.textContent = nextAction.subtitle;
  els.overviewCount.textContent = `${progress}/${total}`;
  els.overviewProgress.style.width = `${Math.round((progress / total) * 100)}%`;
  els.overviewDetail.textContent = nextAction.detail;
  els.overviewCurrentStep.textContent = stepTitles[state.activeStep] || "研究需求输入";
  els.overviewProtocol.textContent = state.protocol ? "已生成" : "未生成";
  els.overviewRun.textContent = state.formalRun ? "正式运行完成" : state.previewRun ? "预实验完成" : "未运行";
}

function renderLiteratureResearch() {
  const research = state.copilot?.literatureResearch || {};
  if (!els.researchPanel) {
    return;
  }
  const queries = Array.isArray(research.queries) && research.queries.length
    ? research.queries
    : ["LLM behavior experiment similar study", "large language model benchmark prompt condition"];

  els.researchStatus.textContent = research.loading
    ? "检索中"
    : research.needed === false
      ? "可选调研"
      : "建议调研";
  els.researchReason.textContent = research.reason || "先用几条检索式看看是否已有类似实验、benchmark 或条件划分，再决定是否调整方案。";
  els.researchQueries.innerHTML = queries
    .map((query) => `<span>${escapeHtml(query)}</span>`)
    .join("");
  const results = Array.isArray(research.results) ? research.results : [];
  els.researchResults.innerHTML = research.loading
    ? '<div class="research-loading">正在检索 OpenAlex 相关研究...</div>'
    : results.length
    ? results
      .map(
        (result) => `
          <a class="research-result-card" href="${escapeHtml(result.url || "#")}" target="_blank" rel="noreferrer">
            <div class="research-result-head">
              <strong>${escapeHtml(result.title || "未命名结果")}</strong>
              ${formatResearchEvidence(result.evidence)}
            </div>
            <span>${escapeHtml(formatResearchMeta(result))}</span>
            ${formatResearchEvidenceReason(result.evidence)}
            ${result.abstractSnippet ? `<small>${escapeHtml(result.abstractSnippet)}</small>` : ""}
          </a>
        `,
      )
      .join("")
    : research.error
      ? `<div class="research-loading">检索暂时不可用：${escapeHtml(research.error)}</div>`
      : "";
  els.researchUse.textContent = research.expectedUse || "调研结果会用于修正条件分组、材料来源、因变量定义和质量检查。";
}

function formatResearchMeta(result) {
  const bits = [
    result.source || "OpenAlex",
    result.year,
    Array.isArray(result.authors) && result.authors.length ? result.authors.join(", ") : "",
    result.venue,
    Number.isFinite(result.citedByCount) ? `被引 ${result.citedByCount}` : "",
  ].filter(Boolean);
  return bits.join(" · ");
}

function formatResearchEvidence(evidence) {
  if (!evidence || typeof evidence !== "object") {
    return "";
  }
  const score = Number(evidence.score);
  if (!Number.isFinite(score)) {
    return "";
  }
  const labels = {
    high: "高相关",
    medium: "可参考",
    low: "待筛选",
  };
  const strength = ["high", "medium", "low"].includes(evidence.strength) ? evidence.strength : "low";
  return `<span class="research-evidence-badge" data-evidence-strength="${strength}">${labels[strength]} ${Math.round(score)}</span>`;
}

function formatResearchEvidenceReason(evidence) {
  const reason = Array.isArray(evidence?.reasons) ? evidence.reasons[0] : "";
  return reason ? `<small class="research-evidence-reason">${escapeHtml(reason)}</small>` : "";
}

function getOverviewNextAction() {
  if (!state.intake) {
    return {
      title: "等待研究需求",
      subtitle: "先输入研究想法，后续状态会自动更新。",
      detail: "这里不会占用主流程步骤，只帮助你随时确认当前进度、待补充项和下一步。",
    };
  }
  if (!state.protocol) {
    return {
      title: "等待细节确认",
      subtitle: "确认摘要、假设问题和测量形式后生成实验协议。",
      detail: "当前重点是把研究意图收束成可运行的协议输入。",
    };
  }
  if (!state.previewRun) {
    return {
      title: "协议已生成",
      subtitle: "下一步检查提示词、模型预算，并运行预实验。",
      detail: "总览只显示状态，具体编辑仍在当前流程页面完成。",
    };
  }
  if (!state.formalRun) {
    return {
      title: "预实验已完成",
      subtitle: "检查解析率、拒答率和异常输出后进入正式运行。",
      detail: "优先关注预实验暴露的阻塞项，再决定是否进入正式运行。",
    };
  }
  return {
    title: "正式运行已完成",
    subtitle: "可以查看结果报告并导出复现材料。",
    detail: "总览会保留运行、报告和导出状态，方便团队复核。",
  };
}

function openOverview() {
  renderOverview();
  renderTasks();
  els.overviewPanel.hidden = false;
}

function closeOverview() {
  els.overviewPanel.hidden = true;
}

function syncCopilotEdits() {
  if (!state.copilot || !state.intake) {
    return;
  }

  state.copilot.summary = els.copilotSummary.value.trim();
  state.copilot.hypothesisDraft = els.hypothesisDraft.value.trim();
  state.copilot.detailFields = readDetailFields();
  state.copilot.confirmationDetails = parseConfirmationDetails(els.confirmationDetails.value);
  state.intake.extractedCandidates.hypothesis[0] = state.copilot.hypothesisDraft;
  state.intake.unresolvedQuestions = state.copilot.confirmationDetails;
}

function readDetailFields() {
  const detailFields = { ...(state.copilot?.detailFields || {}) };
  els.detailFields.forEach((field) => {
    detailFields[field.dataset.detailField] = field.value.trim();
  });
  return detailFields;
}

function formatConfirmationDetails(details = []) {
  return details.map((detail) => `- ${detail}`).join("\n");
}

function parseConfirmationDetails(value) {
  return String(value || "")
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

function renderTasks() {
  if (!els.taskGrid) {
    return;
  }

  const tasks = buildOverviewTasks();
  els.taskGrid.innerHTML = tasks
    .map(
      (task, index) => `
        <article class="task-step" data-status="${task.status}">
          <span>${String(index + 1).padStart(2, "0")}</span>
          <div>
            <strong>${task.title}</strong>
            <p>${task.goal}</p>
            <dl>
              <dt>需要确认</dt>
              <dd>${task.userConfirmation}</dd>
              <dt>完成标准</dt>
              <dd>${task.doneWhen}</dd>
            </dl>
            <small>${statusLabel(task.status)}</small>
          </div>
        </article>
      `,
    )
    .join("");
}

function buildOverviewTasks() {
  return [
    {
      status: state.intake ? "ready" : "needs_input",
      title: "需求输入",
      goal: state.intake ? "已收到研究想法或材料线索。" : "等待输入研究想法、语音记录或上传材料。",
      userConfirmation: state.intake ? "已确认，可进入细节确认。" : "补充一段尽量具体的实验需求。",
      doneWhen: "形成可供系统解析的研究输入。",
    },
    {
      status: state.copilot ? "ready" : "blocked",
      title: "细节确认",
      goal: state.copilot ? "已生成摘要、假设问题和测量形式建议。" : "等待研究需求输入完成。",
      userConfirmation: state.copilot ? "确认摘要、假设问题和测量形式。" : "先完成 01 需求输入。",
      doneWhen: "用户确认系统没有误解研究目标。",
    },
    {
      status: state.protocol ? "ready" : "blocked",
      title: "实验协议",
      goal: state.protocol ? "实验协议草案已生成。" : "等待细节确认后生成。",
      userConfirmation: state.protocol ? "检查协议摘要和条件矩阵。" : "先完成 02 细节确认。",
      doneWhen: "协议可进入提示词与条件检查。",
    },
    {
      status: state.promptLab ? "ready" : "blocked",
      title: "提示词检查",
      goal: state.promptLab ? "提示词草案和条件差异检查已生成。" : "等待实验协议生成。",
      userConfirmation: state.promptLab ? "检查不同条件只改变理论变量。" : "先完成 03 实验协议。",
      doneWhen: "提示词和输出格式可进入模型设置。",
    },
    {
      status: state.runPlan ? "ready" : "blocked",
      title: "模型与预算",
      goal: state.runPlan ? "模型、重复试次和预算估算已形成。" : "等待提示词检查完成。",
      userConfirmation: state.runPlan ? "确认模型、provider、API key 模式、重复试次和成本上限。" : "先完成 04 提示词检查。",
      doneWhen: "运行设置足以开始预实验。",
    },
    {
      status: state.previewRun ? "ready" : "blocked",
      title: "预实验检查",
      goal: state.previewRun ? "预实验已有结果，可判断是否进入正式运行。" : "等待模型与预算确认。",
      userConfirmation: state.previewRun ? "检查解析率、拒答率和异常输出。" : "按流程推进到预实验检查。",
      doneWhen: "预实验质量足以支持正式运行。",
    },
    {
      status: state.formalRun ? "ready" : "blocked",
      title: "正式运行",
      goal: state.formalRun ? "正式运行已完成，结果进入报告页。" : "等待预实验检查通过。",
      userConfirmation: state.formalRun ? "检查运行日志和总调用量。" : "先完成 06 预实验检查。",
      doneWhen: "正式运行完成且结果可分析。",
    },
    {
      status: state.formalAnalysis || state.previewAnalysis ? "ready" : "blocked",
      title: "结果报告",
      goal: state.formalAnalysis || state.previewAnalysis ? "分析摘要和导出材料已可查看。" : "等待预实验或正式运行结果。",
      userConfirmation: state.formalAnalysis || state.previewAnalysis ? "查看报告、CSV 和复现 JSON。" : "先完成运行步骤。",
      doneWhen: "报告和复现材料可以导出。",
    },
  ];
}

function statusLabel(status) {
  const labels = {
    ready: "已确认",
    needs_review: "待确认",
    needs_input: "待补充",
    blocked: "未开始",
  };

  return labels[status] || status;
}

function renderProtocol() {
  if (!state.protocol) {
    return;
  }

  els.protocolSummary.innerHTML = [
    ["研究问题", state.protocol.summary.researchQuestion],
    ["假设", state.protocol.summary.hypothesis],
    ["设计", state.protocol.design.type],
    ["主要因变量", state.protocol.summary.primaryOutcome],
  ]
    .map(([key, value]) => `<dt>${key}</dt><dd>${value}</dd>`)
    .join("");

  els.conditionGrid.innerHTML = state.protocol.design.factors
    .map(
      (factor) => `
        <div class="condition-card">
          <span>${factor.label}</span>
          <strong>${factor.levels.map((level) => level.label).join(" / ")}</strong>
        </div>
      `,
    )
    .join("");
  els.protocolJson.textContent = JSON.stringify(state.protocol, null, 2);
}

function renderPromptLab() {
  if (!state.promptLab) {
    return;
  }

  els.variantList.innerHTML = state.promptLab.variants
    .map(
      (variant) => `
        <button class="${variant.id === state.selectedVariantId ? "is-selected" : ""}" type="button" data-variant="${variant.id}">
          <strong>${variant.name}</strong>
          <small>${variant.description}</small>
        </button>
      `,
    )
    .join("");
  els.variantList.querySelectorAll("[data-variant]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedVariantId = button.dataset.variant;
      renderPromptLab();
    });
  });

  const selected = state.promptLab.variants.find((variant) => variant.id === state.selectedVariantId);
  els.promptPreview.textContent = `${selected.system}\n\n${selected.userTemplate}`;
  els.promptChecks.innerHTML = state.promptLab.checks
    .map((check) => `<li data-status="${check.status}"><strong>${check.label}</strong><span>${check.detail}</span></li>`)
    .join("");
  els.conditionDiff.innerHTML = state.promptLab.conditionDiff
    .map((item) => `<li><strong>${item.factor}</strong> ${item.levels.join(" / ")} · ${item.note}</li>`)
    .join("");
}

function renderProviderFields() {
  const enabled = els.provider.value === "openai-compatible";
  document.querySelectorAll(".provider-extra").forEach((item) => {
    item.hidden = !enabled;
  });
}

function renderRunPlan() {
  if (!state.protocol || !state.runPlan) {
    return;
  }

  els.runPlan.innerHTML = [
    ["条件格", state.runPlan.conditionCells],
    ["模型数", state.protocol.models.length],
    ["预实验调用", state.runPlan.totalCalls],
    ["预计上限", `$${Number(state.runPlan.maxBudgetUsd || 0).toFixed(3)}`],
  ]
    .map(([key, value]) => `<dt>${key}</dt><dd>${value}</dd>`)
    .join("");
}

function renderPreview() {
  if (!state.previewAnalysis) {
    els.previewMetrics.innerHTML = "";
    els.previewTable.innerHTML = "";
    return;
  }

  els.previewMetrics.innerHTML = metricsHtml([
    ["解析率", percent(state.previewAnalysis.parseRate), state.previewAnalysis.quality.recommendation],
    ["响应数", state.previewAnalysis.totalResponses, "预实验"],
    ["解析失败", state.previewAnalysis.failedParses, "保留审计"],
    ["成本", `$${state.previewAnalysis.estimatedCostUsd.toFixed(3)}`, "估算"],
  ]);
  els.previewTable.innerHTML = state.previewRun.responses
    .slice(0, 12)
    .map(responseRow)
    .join("");
}

function renderFormalRun() {
  if (!state.formalAnalysis) {
    return;
  }

  els.formalMetrics.innerHTML = metricsHtml([
    ["解析率", percent(state.formalAnalysis.parseRate), "正式运行"],
    ["响应数", state.formalAnalysis.totalResponses, "已存储"],
    ["解析失败", state.formalAnalysis.failedParses, "审计"],
    ["成本", `$${state.formalAnalysis.estimatedCostUsd.toFixed(3)}`, "估算"],
  ]);
  els.runLog.innerHTML = [
    `运行编号：${state.formalRun.id}`,
    `调用方式：${providerLabel(state.formalRun.metadata.provider)}`,
    `提示词版本：${state.formalRun.metadata.promptVariantId}`,
    `完成时间：${state.formalRun.metadata.completedAt}`,
  ]
    .map((item) => `<li>${item}</li>`)
    .join("");
}

function renderResults() {
  const analysis = state.formalAnalysis || state.previewAnalysis;
  const run = state.formalRun || state.previewRun;

  if (!analysis || !run) {
    return;
  }

  els.resultMetrics.innerHTML = metricsHtml([
    ["响应总数", analysis.totalResponses, "已记录"],
    ["解析率", percent(analysis.parseRate), "质量检查"],
    ["成本", `$${analysis.estimatedCostUsd.toFixed(3)}`, "估算"],
    ["运行模式", runModeLabel(run.metadata.mode), "当前结果"],
  ]);
  els.modelBars.innerHTML = analysis.modelSummaries
    .map(
      (item) => `
        <div class="bar-row">
          <span>${item.model}</span>
          <div><i style="width:${Math.round(item.targetChoiceRate * 100)}%"></i></div>
          <strong>${percent(item.targetChoiceRate)}</strong>
        </div>
      `,
    )
    .join("");
  els.heatmap.innerHTML = analysis.conditionCells
    .map(
      (cell) => `
        <div class="heat-cell" style="--heat:${cell.targetChoiceRate}">
          <span>${cell.model}</span>
          <strong>${cell.condition}</strong>
          <em>${percent(cell.targetChoiceRate)}</em>
        </div>
      `,
    )
    .join("");
  els.reportPreview.textContent = buildReportPreview(analysis);
}

function readRunSettings(mode) {
  return {
    provider: els.provider.value,
    endpoint: els.endpoint.value.trim(),
    apiKey: els.apiKey.value.trim(),
    mode,
    repetitionsPerCell: Number(mode === "formal" ? els.formalReps.value : els.previewReps.value),
    promptVariantId: state.selectedVariantId,
  };
}

function syncProtocolModels() {
  const names = [els.modelsInput.value].filter(Boolean);
  if (!state.protocol || !names.length) {
    return;
  }
  state.protocol.models = names.map((name) => ({
    name,
    provider: els.provider.value,
    temperature: 0.7,
    maxTokens: 180,
    estimatedCostPerCallUsd: 0.012,
  }));
}

function isStepAvailable(step) {
  if (step === "workspace") {
    return state.mode === "team" && Boolean(state.user);
  }

  const order =
    state.mode === "team"
      ? ["workspace", "intake", "copilot", "protocol", "prompt", "model", "preview", "run", "results"]
      : ["intake", "copilot", "protocol", "prompt", "model", "preview", "run", "results"];
  const index = order.indexOf(step);
  if (index < 0) return false;
  if (step === "intake") return Boolean(state.user);
  if (step === "copilot") return Boolean(state.copilot);
  if (["protocol", "prompt", "model"].includes(step)) return Boolean(state.protocol);
  if (step === "preview") return Boolean(state.previewRun);
  if (step === "run") return Boolean(state.formalRun);
  if (step === "results") return Boolean(state.previewRun || state.formalRun);
  return false;
}

function bindVoiceHold() {
  const button = els.voiceButton;

  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    startVoiceInput();
  });
  button.addEventListener("pointerup", stopVoiceInput);
  button.addEventListener("pointerleave", () => {
    if (state.recognizing) {
      stopVoiceInput();
    }
  });
  button.addEventListener("keydown", (event) => {
    if ((event.key === " " || event.key === "Enter") && !state.recognizing) {
      event.preventDefault();
      startVoiceInput();
    }
  });
  button.addEventListener("keyup", (event) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      stopVoiceInput();
    }
  });
}

function startVoiceInput() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    showToast("当前浏览器不支持录音，可以先用文字输入或上传材料。");
    return;
  }

  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      state.mediaStream = stream;
      state.audioChunks = [];
      state.audioStartedAt = Date.now();
      state.mediaRecorder = new MediaRecorder(stream);
      state.mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data?.size) {
          state.audioChunks.push(event.data);
        }
      });
      state.mediaRecorder.addEventListener("stop", saveAudioClip);
      state.recognizing = true;
      state.inputMode = "voice";
      els.voiceButton.classList.add("is-recording");
      els.voiceStatus.textContent = "正在录音...";
      state.mediaRecorder.start();
    })
    .catch(() => {
      showToast("无法访问麦克风，可以改用文字输入或上传材料。");
    });
}

function stopVoiceInput() {
  if (!state.mediaRecorder || !state.recognizing) {
    return;
  }
  state.mediaRecorder.stop();
}

function saveAudioClip() {
  const blob = new Blob(state.audioChunks, {
    type: state.mediaRecorder?.mimeType || "audio/webm",
  });
  const durationMs = Math.max(0, Date.now() - (state.audioStartedAt || Date.now()));

  if (blob.size > 0) {
    state.audioClips.push({
      id: `audio_${Date.now().toString(36)}`,
      blob,
      url: URL.createObjectURL(blob),
      durationMs,
      createdAt: new Date().toISOString(),
    });
    showToast("语音已保存。接入转写 API 后可自动转成文字。");
  }

  state.mediaStream?.getTracks().forEach((track) => track.stop());
  state.mediaStream = null;
  state.mediaRecorder = null;
  state.audioChunks = [];
  state.audioStartedAt = null;
  state.recognizing = false;
  els.voiceButton.classList.remove("is-recording");
  els.voiceStatus.textContent = "松开保存音频";
  renderAttachments();
}

function handleFile(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  Promise.all(files.map(parseMaterialFile))
    .then((attachments) => {
      state.attachments.push(...attachments);
      state.inputMode = "upload";
      renderAttachments();
      showToast(`已解析/保存 ${attachments.length} 个材料。`);
    })
    .catch(() => {
      showToast("有文件无法读取，请优先上传文本类材料。");
    })
    .finally(() => {
      event.target.value = "";
    });
}

async function parseMaterialFile(file) {
  const text = await readFileAsText(file);
  const data = await api("/api/parse-material", {
    fileName: file.name,
    mimeType: file.type,
    text,
  });

  return {
    name: data.material.fileName,
    kind: data.material.kind,
    parsed: data.material.parsed,
    text: data.material.text,
    summary: data.material.summary,
    warnings: data.material.warnings,
  };
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

async function api(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!json.ok) {
    throw new Error(json.error || "Request failed");
  }
  return json.data;
}

function responseRow(response) {
  return `
    <tr>
      <td>${escapeHtml(response.model)}</td>
      <td>${escapeHtml(conditionLabel(response.condition))}</td>
      <td>${escapeHtml(response.parsedResponse?.choice || "")}</td>
      <td>${escapeHtml(response.parsedResponse?.confidence || "")}</td>
      <td>${escapeHtml(response.parsedResponse?.rationale || response.rawResponse)}</td>
    </tr>
  `;
}

function metricsHtml(items) {
  return items
    .map(
      ([label, value, note]) => `
        <div class="metric">
          <span>${label}</span>
          <strong>${value}</strong>
          <small>${note}</small>
        </div>
      `,
    )
    .join("");
}

function buildReportPreview(analysis) {
  return [
    "# LLM 行为实验报告",
    "",
    "本报告总结的是探索性模型行为结果，不应被解释为人类行为证据。",
    "",
    `响应总数：${analysis.totalResponses}`,
    `解析率：${percent(analysis.parseRate)}`,
    "",
    "模型摘要：",
    ...analysis.modelSummaries.map(
      (item) => `- ${item.model}：目标选项率 ${percent(item.targetChoiceRate)}，平均信心 ${item.meanConfidence}`,
    ),
  ].join("\n");
}

function runModeLabel(mode) {
  return mode === "formal" ? "正式运行" : "预实验";
}

function providerLabel(provider) {
  if (provider === "openai-compatible") return "OpenAI 兼容接口";
  if (provider === "simulator") return "内置模拟器";
  return provider;
}

function download(fileName, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function exportJson() {
  const payload = {
    protocol: state.protocol,
    promptLab: state.promptLab,
    run: state.formalRun || state.previewRun,
    analysis: state.formalAnalysis || state.previewAnalysis,
  };
  download("llm-behavior-reproducibility.json", JSON.stringify(payload, null, 2), "application/json");
}

function setBusy(action, busy, busyText = "运行中...") {
  const button = document.querySelector(`[data-action='${action}']`);
  if (!button) return;
  button.disabled = busy;
  button.dataset.originalText ||= button.textContent;
  button.textContent = busy ? busyText : button.dataset.originalText;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.hidden = true;
  }, 2600);
}

function countConditionCells(protocol) {
  return protocol.design.factors.reduce((total, factor) => total * factor.levels.length, 1) * protocol.stimuli.length;
}

function conditionLabel(condition) {
  return Object.entries(condition)
    .map(([key, value]) => `${key}:${value}`)
    .join(" / ");
}

function percent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function currentTime() {
  return new Date().toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
