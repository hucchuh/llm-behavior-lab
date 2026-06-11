import { createReadStream, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  analyzeRun,
  buildCopilot,
  buildCopilotGenerationMessages,
  buildPromptLab,
  buildRunPlan,
  compileProtocol,
  createIntake,
  exportCsv,
  exportHumanBaselineMarkdown,
  exportReportMarkdown,
  mergeCopilotResearchResults,
  mergeCopilotDraft,
  runExperiment,
} from "./lib/pipeline.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadLocalEnv();
const PUBLIC_DIR = path.join(__dirname, "public");
const EXPERIMENT_DESIGN_PRINCIPLES_PATH = path.join(__dirname, "prompts", "experiment_design_principles.md");
const BEHAVIOR_TASK_SYSTEM_PROMPT_PATH = path.join(__dirname, "prompts", "behavior_task_breakdown_system.md");
const PORT = Number.parseInt(process.env.PORT || "8780", 10);
const HOST = process.env.HOST || "127.0.0.1";

const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
]);

export function createAppServer(options = {}) {
  const runtime = {
    env: options.env || process.env,
    fetch: options.fetch || globalThis.fetch,
  };

  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

      if (url.pathname.startsWith("/api/")) {
        await handleApi(request, response, url, runtime);
        return;
      }

      await serveStatic(response, url.pathname);
    } catch (error) {
      sendJson(response, 500, {
        ok: false,
        error: error.message,
      });
    }
  });
}

async function handleApi(request, response, url, runtime) {
  if (request.method !== "POST") {
    sendJson(response, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  const body = await readJson(request);

  if (url.pathname === "/api/intake") {
    const intake = createIntake(body);
    const designPrinciples = await loadExperimentDesignPrinciples();
    const behaviorTaskSystemPrompt = await loadBehaviorTaskSystemPrompt();
    const copilot = await buildGeneratedCopilot({
      intake,
      designPrinciples,
      behaviorTaskSystemPrompt,
      runtime,
    });
    sendJson(response, 200, {
      ok: true,
      data: {
        intake,
        copilot,
      },
    });
    return;
  }

  if (url.pathname === "/api/research-search") {
    const intake = body.intake || createIntake(body);
    const designPrinciples = await loadExperimentDesignPrinciples();
    const copilot = body.copilot || buildCopilot(intake, { designPrinciples });
    const enrichedCopilot = await enrichCopilotWithResearchSearch({
      intake,
      copilot,
      runtime,
    });
    sendJson(response, 200, {
      ok: true,
      data: {
        copilot: enrichedCopilot,
        literatureResearch: enrichedCopilot.literatureResearch,
      },
    });
    return;
  }

  if (url.pathname === "/api/protocol") {
    const designPrinciples = await loadExperimentDesignPrinciples();
    const protocol = compileProtocol({
      intake: body.intake,
      copilot: body.copilot,
      decisions: body.decisions || {},
    });
    sendJson(response, 200, {
      ok: true,
      data: {
        protocol,
        tasks: buildCopilot(body.intake, { designPrinciples }).tasks,
        promptLab: buildPromptLab(protocol),
        runPlan: buildRunPlan(protocol, {
          mode: "preview",
          repetitionsPerCell: body.decisions?.previewRepetitionsPerCell,
        }),
      },
    });
    return;
  }

  if (url.pathname === "/api/prompt-lab") {
    sendJson(response, 200, {
      ok: true,
      data: {
        promptLab: buildPromptLab(body.protocol),
      },
    });
    return;
  }

  if (url.pathname === "/api/run") {
    const run = await runExperiment({
      protocol: body.protocol,
      runSettings: body.runSettings || {},
    });
    const analysis = analyzeRun(run);
    sendJson(response, 200, {
      ok: true,
      data: {
        run,
        analysis,
      },
    });
    return;
  }

  if (url.pathname === "/api/parse-material") {
    sendJson(response, 200, {
      ok: true,
      data: {
        material: parseMaterial(body),
      },
    });
    return;
  }

  if (url.pathname === "/api/export") {
    const format = body.format || "markdown";
    const analysis = body.analysis || analyzeRun(body.run);
    const content =
      format === "csv"
        ? exportCsv(body.run)
        : format === "human-baseline"
          ? exportHumanBaselineMarkdown(body.protocol)
          : exportReportMarkdown({
              protocol: body.protocol,
              run: body.run,
              analysis,
            });
    sendJson(response, 200, {
      ok: true,
      data: {
        format,
        content,
      },
    });
    return;
  }

  sendJson(response, 404, { ok: false, error: "API route not found" });
}

async function loadExperimentDesignPrinciples() {
  try {
    return await readFile(EXPERIMENT_DESIGN_PRINCIPLES_PATH, "utf-8");
  } catch {
    return "";
  }
}

async function loadBehaviorTaskSystemPrompt() {
  try {
    return await readFile(BEHAVIOR_TASK_SYSTEM_PROMPT_PATH, "utf-8");
  } catch {
    return "";
  }
}

async function buildGeneratedCopilot({ intake, designPrinciples, behaviorTaskSystemPrompt, runtime }) {
  const fallbackCopilot = buildCopilot(intake, { designPrinciples });
  const config = getCopilotLlmConfig(runtime.env);

  if (!config.apiKey || !runtime.fetch) {
    return {
      ...fallbackCopilot,
      confirmationDetails: fallbackCopilot.confirmationDetails,
      recommendedOutcome: fallbackCopilot.recommendedOutcome,
      generation: {
        source: "local_fallback",
        reason: "missing_server_api_key",
        logicChain: "behavior_task_breakdown_v1",
      },
    };
  }

  try {
    const messages = buildCopilotGenerationMessages(intake, {
      designPrinciples,
      behaviorTaskSystemPrompt,
    });
    const draft = await callCopilotLlm({ config, messages, fetchImpl: runtime.fetch });
    const copilot = mergeCopilotDraft(intake, fallbackCopilot, draft.data);
    return {
      ...copilot,
      generation: {
        ...copilot.generation,
        latencyMs: draft.latencyMs,
        promptChars: draft.promptChars,
        rawResponseChars: draft.rawResponseChars,
      },
    };
  } catch (error) {
    return {
      ...fallbackCopilot,
      confirmationDetails: fallbackCopilot.confirmationDetails,
      recommendedOutcome: fallbackCopilot.recommendedOutcome,
      generation: {
        source: "local_fallback",
        reason: "llm_generation_failed",
        error: error.message,
        logicChain: "behavior_task_breakdown_v1",
      },
    };
  }
}

async function enrichCopilotWithResearchSearch({ intake, copilot, runtime }) {
  const config = getResearchSearchConfig(runtime.env);
  const queries = normalizeResearchQueries(copilot.literatureResearch);

  if (!runtime.fetch || !queries.length || config.disabled) {
    return copilot;
  }

  try {
    const searchResult = await searchOpenAlex({
      queries,
      fetchImpl: runtime.fetch,
      timeoutMs: config.timeoutMs,
      perQueryLimit: config.perQueryLimit,
    });
    return mergeCopilotResearchResults(intake, copilot, searchResult);
  } catch (error) {
    return mergeCopilotResearchResults(intake, copilot, {
      source: "openalex",
      searchedQueries: queries,
      results: [],
      error: error.message,
      searchedAt: new Date().toISOString(),
    });
  }
}

function getResearchSearchConfig(env) {
  return {
    disabled: /^(1|true|yes)$/i.test(String(env.RESEARCH_SEARCH_DISABLED || "")),
    timeoutMs: Number.parseInt(env.RESEARCH_SEARCH_TIMEOUT_MS || "4500", 10),
    perQueryLimit: clampNumber(env.RESEARCH_SEARCH_PER_QUERY_LIMIT, 1, 10, 3),
  };
}

function normalizeResearchQueries(literatureResearch = {}) {
  return [...new Set((Array.isArray(literatureResearch.queries) ? literatureResearch.queries : [])
    .map((query) => String(query || "").trim())
    .filter(Boolean))]
    .slice(0, 3);
}

async function searchOpenAlex({ queries, fetchImpl, timeoutMs, perQueryLimit }) {
  const searchedAt = new Date().toISOString();
  const settled = await Promise.allSettled(
    queries.map((query) => searchOpenAlexQuery({
      query,
      fetchImpl,
      timeoutMs,
      perQueryLimit,
    })),
  );
  const results = dedupeResearchResults(
    settled.flatMap((item) => item.status === "fulfilled" ? item.value : []),
  ).slice(0, 6);
  const errors = settled
    .filter((item) => item.status === "rejected")
    .map((item) => item.reason?.message)
    .filter(Boolean);

  return {
    source: "openalex",
    searchedAt,
    searchedQueries: queries,
    results,
    error: errors[0] || "",
  };
}

async function searchOpenAlexQuery({ query, fetchImpl, timeoutMs, perQueryLimit }) {
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timeout = controller
    ? setTimeout(() => controller.abort(new Error("OpenAlex search timed out")), timeoutMs)
    : null;
  const url = new URL("https://api.openalex.org/works");
  url.searchParams.set("search", query);
  url.searchParams.set("per-page", String(perQueryLimit));
  url.searchParams.set("sort", "cited_by_count:desc");
  url.searchParams.set("select", [
    "id",
    "display_name",
    "publication_year",
    "cited_by_count",
    "doi",
    "primary_location",
    "authorships",
    "abstract_inverted_index",
  ].join(","));

  try {
    const response = await fetchImpl(url.toString(), {
      method: "GET",
      headers: {
        accept: "application/json",
      },
      signal: controller?.signal,
    });
    if (!response.ok) {
      throw new Error(`OpenAlex search failed with status ${response.status}`);
    }
    const json = await response.json();
    return (Array.isArray(json.results) ? json.results : []).map((work) =>
      normalizeOpenAlexWork(work, query),
    );
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function normalizeOpenAlexWork(work, query) {
  const primaryLocation = work.primary_location || {};
  const url = primaryLocation.landing_page_url || work.doi || work.id || "";
  const authors = Array.isArray(work.authorships)
    ? work.authorships
      .map((authorship) => authorship?.author?.display_name)
      .filter(Boolean)
      .slice(0, 4)
    : [];

  return {
    id: String(work.id || work.doi || work.display_name || ""),
    title: normalizeText(work.display_name),
    year: Number.isFinite(work.publication_year) ? work.publication_year : null,
    authors,
    venue: normalizeText(primaryLocation.source?.display_name || ""),
    citedByCount: Number.isFinite(work.cited_by_count) ? work.cited_by_count : 0,
    url,
    doi: normalizeText(work.doi || ""),
    source: "OpenAlex",
    query,
    abstractSnippet: truncateText(abstractFromInvertedIndex(work.abstract_inverted_index), 220),
  };
}

function abstractFromInvertedIndex(index) {
  if (!index || typeof index !== "object") {
    return "";
  }
  const words = [];
  for (const [word, positions] of Object.entries(index)) {
    if (!Array.isArray(positions)) continue;
    for (const position of positions) {
      if (Number.isInteger(position)) {
        words[position] = word;
      }
    }
  }
  return words.filter(Boolean).join(" ");
}

function dedupeResearchResults(results) {
  const seen = new Set();
  const unique = [];
  for (const result of results) {
    const key = String(result.doi || result.id || result.title).toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(result);
  }
  return unique;
}

function getCopilotLlmConfig(env) {
  return {
    endpoint: env.COPILOT_LLM_ENDPOINT || env.MINIMAX_ENDPOINT || "https://lightingtheword.com/v1/chat/completions",
    model: env.COPILOT_LLM_MODEL || env.MINIMAX_MODEL || "MiniMax-M2.7",
    apiKey: env.COPILOT_LLM_API_KEY || env.MINIMAX_API_KEY || "",
    timeoutMs: Number.parseInt(env.COPILOT_LLM_TIMEOUT_MS || env.MINIMAX_TIMEOUT_MS || "15000", 10),
    maxTokens: Number.parseInt(env.COPILOT_LLM_MAX_TOKENS || env.MINIMAX_MAX_TOKENS || "1500", 10),
  };
}

async function callCopilotLlm({ config, messages, fetchImpl }) {
  const startedAt = Date.now();
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timeout = controller
    ? setTimeout(() => controller.abort(new Error("LLM request timed out")), config.timeoutMs)
    : null;
  const promptChars = messages.reduce((total, message) => total + String(message.content || "").length, 0);

  try {
    const response = await fetchImpl(resolveChatCompletionsUrl(config.endpoint), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      signal: controller?.signal,
      body: JSON.stringify({
        model: config.model,
        messages,
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: config.maxTokens,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM request failed with status ${response.status}`);
    }

    const json = await response.json();
    const content = json.choices?.[0]?.message?.content || "";
    return {
      data: parseJsonObject(content),
      latencyMs: Date.now() - startedAt,
      promptChars,
      rawResponseChars: content.length,
    };
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`LLM request timed out after ${config.timeoutMs}ms`);
    }
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function parseJsonObject(value) {
  const text = extractJsonObjectText(value);
  const attempts = [
    text,
    repairJsonObjectText(text),
  ].filter(Boolean);
  let lastError = null;

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`LLM response was not valid JSON: ${lastError?.message || "unknown parse error"}`);
}

function extractJsonObjectText(value) {
  const text = String(value || "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("LLM response did not contain a JSON object");
  }
  return text.slice(start, end + 1);
}

function repairJsonObjectText(text) {
  const withMissingPropertyCommas = String(text || "")
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/("(?:[^"\\]|\\.)*"|true|false|null|-?\d+(?:\.\d+)?|[}\]])\s*\n\s*("[A-Za-z0-9_\u4e00-\u9fa5]+"\s*:)/g, "$1,\n$2")
    .replace(/("(?:[^"\\]|\\.)*"|true|false|null|-?\d+(?:\.\d+)?|[}\]])\s+("[A-Za-z0-9_\u4e00-\u9fa5]+"\s*:)/g, "$1, $2");

  return closeJsonObjectText(withMissingPropertyCommas);
}

function closeJsonObjectText(text) {
  const stack = [];
  let inString = false;
  let escaped = false;

  for (const character of String(text || "")) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = inString;
      continue;
    }
    if (character === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (character === "{") stack.push("}");
    if (character === "[") stack.push("]");
    if ((character === "}" || character === "]") && stack.at(-1) === character) {
      stack.pop();
    }
  }

  return `${text}${stack.reverse().join("")}`;
}

function resolveChatCompletionsUrl(endpoint) {
  const normalized = String(endpoint || "").replace(/\/+$/, "");
  return normalized.endsWith("/chat/completions")
    ? normalized
    : `${normalized}/chat/completions`;
}

function loadLocalEnv() {
  const envPaths = [
    path.join(__dirname, ".env.local"),
    path.join(__dirname, ".env"),
  ];

  for (const envPath of envPaths) {
    try {
      const text = readFileSync(envPath, "utf-8");
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
        const [key, ...valueParts] = trimmed.split("=");
        if (!process.env[key]) {
          process.env[key] = valueParts.join("=").replace(/^["']|["']$/g, "");
        }
      }
    } catch {
      // Local env files are optional.
    }
  }
}

function parseMaterial({ fileName = "uploaded-material", mimeType = "", text = "" }) {
  const extension = path.extname(fileName).replace(".", "").toLowerCase();
  const normalized = String(text || "").replace(/\r\n/g, "\n").trim();
  const kind = inferMaterialKind(extension, mimeType);

  if (!["text", "markdown", "csv", "json"].includes(kind)) {
    return {
      id: `mat_${Date.now().toString(36)}`,
      fileName,
      kind,
      parsed: false,
      text: "",
      summary: "已保存文件元数据；该格式需要后续接入专门解析器。",
      warnings: ["当前本地版本优先解析 txt、md、csv、json。PDF/DOCX 可在接入文档解析 API 后补全文本。"],
    };
  }

  if (kind === "json") {
    return parseJsonMaterial({ fileName, kind, normalized });
  }

  if (kind === "csv") {
    const lines = normalized.split("\n").filter(Boolean);
    const headers = lines[0]?.split(",").map((item) => item.trim()) || [];
    return {
      id: `mat_${Date.now().toString(36)}`,
      fileName,
      kind,
      parsed: true,
      text: normalized,
      summary: `CSV parsed: ${Math.max(0, lines.length - 1)} rows, columns: ${headers.slice(0, 5).join(", ") || "unknown"}.`,
      warnings: [],
    };
  }

  return {
    id: `mat_${Date.now().toString(36)}`,
    fileName,
    kind,
    parsed: true,
    text: normalized,
    summary: summarizeText(normalized),
    warnings: normalized ? [] : ["文件内容为空。"],
  };
}

function parseJsonMaterial({ fileName, kind, normalized }) {
  try {
    const parsed = JSON.parse(normalized);
    const text = JSON.stringify(parsed, null, 2);
    return {
      id: `mat_${Date.now().toString(36)}`,
      fileName,
      kind,
      parsed: true,
      text,
      summary: `JSON parsed: ${Array.isArray(parsed) ? `${parsed.length} items` : `${Object.keys(parsed).length} top-level keys`}.`,
      warnings: [],
    };
  } catch {
    return {
      id: `mat_${Date.now().toString(36)}`,
      fileName,
      kind,
      parsed: false,
      text: normalized,
      summary: "JSON 解析失败，已保留原文。",
      warnings: ["请检查 JSON 格式。"],
    };
  }
}

function inferMaterialKind(extension, mimeType) {
  if (extension === "md" || extension === "markdown" || mimeType.includes("markdown")) {
    return "markdown";
  }
  if (extension === "csv" || mimeType.includes("csv")) {
    return "csv";
  }
  if (extension === "json" || mimeType.includes("json")) {
    return "json";
  }
  if (["txt", "text"].includes(extension) || mimeType.startsWith("text/")) {
    return "text";
  }
  if (extension === "pdf" || mimeType.includes("pdf")) {
    return "pdf";
  }
  if (extension === "docx" || extension === "doc" || mimeType.includes("word")) {
    return "document";
  }
  return extension || "file";
}

function summarizeText(text) {
  const firstMeaningfulLine = text
    .split("\n")
    .map((line) => line.replace(/^#+\s*/, "").trim())
    .find(Boolean);
  return firstMeaningfulLine
    ? firstMeaningfulLine.slice(0, 180)
    : "已解析文本材料。";
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function truncateText(value, maxLength) {
  const text = normalizeText(value);
  return text.length > maxLength ? `${text.slice(0, Math.max(0, maxLength - 1))}…` : text;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

async function serveStatic(response, pathname) {
  const normalizedPath = pathname === "/" ? "/index.html" : pathname;
  const safePath = path.normalize(normalizedPath).replace(/^([/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    await readFile(filePath);
  } catch {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "content-type": MIME_TYPES.get(path.extname(filePath)) || "application/octet-stream",
  });
  createReadStream(filePath).pipe(response);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createAppServer();
  server.listen(PORT, HOST, () => {
    console.log(`LLM Behavior Lab running at http://${HOST}:${PORT}/`);
  });
}
