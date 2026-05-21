import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  analyzeRun,
  buildCopilot,
  buildPromptLab,
  buildRunPlan,
  compileProtocol,
  createIntake,
  exportCsv,
  exportHumanBaselineMarkdown,
  exportReportMarkdown,
  runExperiment,
} from "./lib/pipeline.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const EXPERIMENT_DESIGN_PRINCIPLES_PATH = path.join(__dirname, "prompts", "experiment_design_principles.md");
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

export function createAppServer() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

      if (url.pathname.startsWith("/api/")) {
        await handleApi(request, response, url);
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

async function handleApi(request, response, url) {
  if (request.method !== "POST") {
    sendJson(response, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  const body = await readJson(request);

  if (url.pathname === "/api/intake") {
    const intake = createIntake(body);
    const designPrinciples = await loadExperimentDesignPrinciples();
    sendJson(response, 200, {
      ok: true,
      data: {
        intake,
        copilot: buildCopilot(intake, { designPrinciples }),
      },
    });
    return;
  }

  if (url.pathname === "/api/protocol") {
    const designPrinciples = await loadExperimentDesignPrinciples();
    const protocol = compileProtocol({
      intake: body.intake,
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
