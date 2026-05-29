# LLM Behavior Lab Input / Output Flow

This document describes the current product contract for the runnable MVP.

## 01 需求输入

User input:
- Free text pasted or typed into the intake box.
- Saved audio clips, pending later transcription API.
- Uploaded materials parsed from txt, md, csv, or json; PDF/DOCX are saved as metadata until a document parser is connected.

Frontend output:
- `sourceType`
- `content`
- parsed attachment text appended as source material

Backend route:
- `POST /api/intake`

Backend processing:
1. Create a conservative local intake draft with `createIntake`.
2. Load `app/prompts/experiment_design_principles.md`.
3. Load `app/prompts/behavior_task_breakdown_system.md`, the dedicated system prompt for converting research ideas into executable behavior tasks.
4. Build structured generation messages. The dedicated system prompt keeps the request shorter and more problem-specific; the design-principles file remains the internal methodology reference.
5. If server credentials are present, call the OpenAI-compatible MiniMax endpoint with JSON-object response mode.
6. Merge the model draft into the intake and Copilot fields.
7. If the model call fails, times out, or credentials are missing, return the local fallback so the workflow still runs.

MiniMax configuration:
- `MINIMAX_API_KEY` or `COPILOT_LLM_API_KEY`
- `MINIMAX_ENDPOINT` or `COPILOT_LLM_ENDPOINT`, default `https://lightingtheword.com/v1/chat/completions`
- `MINIMAX_MODEL` or `COPILOT_LLM_MODEL`, default `MiniMax-M2.7`
- `MINIMAX_TIMEOUT_MS` or `COPILOT_LLM_TIMEOUT_MS`, default `45000`

Latency telemetry:
- `copilot.generation.latencyMs`
- `copilot.generation.promptChars`
- `copilot.generation.rawResponseChars`

## 02 细节确认

Backend output to frontend:
- `intake`: normalized research intent, candidate variables, conditions, stimuli, unresolved details.
- `copilot.summary`: editable research goal summary.
- `copilot.hypothesisDraft`: editable hypothesis breakdown containing the testable question, constructs, variables, operationalization, and planned comparison.
- `copilot.detailFields.variablesAndConditions`: editable variable and condition breakdown. Model names are not treated as condition levels; model selection is handled later.
- `copilot.detailFields.stimuliAndMaterials`: editable stimulus and material plan.
- `copilot.detailFields.outputAndCoding`: editable output schema, scoring, and coding plan.
- `copilot.detailFields.samplingAndRandomization`: editable preview/formal sampling and randomization notes.
- `copilot.detailFields.analysisAndQA`: editable planned-comparison and quality-check plan.
- `copilot.confirmationDetails`: editable list of details that must be confirmed before protocol generation.
- `copilot.nextQuestion`: primary dependent-variable measurement choice.
- `copilot.recommendedOutcome`: model-recommended measurement option.

User confirms or edits:
- 研究目标摘要
- 假设问题拆解
- 运行前需确认的细节
- 主要因变量的测量形式
- benchmark name or link when benchmark measurement is selected

Frontend output:
- Updates `state.copilot`.
- Updates `state.intake.extractedCandidates.hypothesis[0]`.
- Updates `state.intake.unresolvedQuestions`.
- Sends `primaryOutcome`, `benchmarkReference`, model, and repetition decisions to protocol generation.

## 03 实验协议

Backend route:
- `POST /api/protocol`

Backend output:
- `protocol.summary`
- `protocol.design`
- `protocol.stimuli`
- `protocol.outputSchema`
- `protocol.models`
- `promptLab`
- `runPlan`

User-facing output:
- 研究协议摘要
- 条件矩阵
- visible protocol JSON

## 04 提示词检查

Input:
- generated `protocol`

Output:
- prompt variants
- prompt-balance checks
- condition difference notes

User action:
- Confirm prompt quality, then move to model and budget settings.

## 05 模型与预算

Input:
- selected model
- provider route
- preview and formal repetitions
- optional endpoint and API key for later model calls

Output:
- total call estimate
- cost estimate
- run settings

## 06-08 Run And Results

Preview run:
- checks parse quality, refusal or schema errors, latency and rough cost.

Formal run:
- executes the confirmed protocol and stores raw prompts, raw responses, parsed responses, model settings, and timestamps.

Results:
- summary metrics
- model comparison
- condition by model table
- report, CSV, and JSON export
