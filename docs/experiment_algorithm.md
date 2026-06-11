# LLM Behavior Lab Experiment Algorithm Contract

This document records the design migration borrowed from CourseMaker-style prompt generation products. The goal is design transfer, not feature parity: LLM Behavior Lab keeps its own experiment workflow and does not import course, slide, video, or lesson-production features.

## Design Migration Principles

1. Make generation staged and inspectable. Every model-generated artifact must have a named input, route, output schema, user review point, and downstream consumer.
2. Treat prompts as product assets. System prompts and experiment-design principles live in files, are versionable, and are referenced by API routes instead of hidden in UI copy.
3. Keep long-running work visible. Users should see whether the system is parsing requirements, searching related work, compiling the protocol, checking prompts, or running trials.
4. Preserve human confirmation gates. The model proposes a runnable draft; the user edits and confirms before the draft becomes protocol, prompt, run plan, or report.
5. Prefer experiment packages over loose text. Each stage should be able to produce reproducible artifacts such as protocol JSON, prompt variants, run settings, raw responses, and a report.

## End-To-End Contract

| Step | User Input | API / Logic | Generated Output | User Gate | Artifact |
| --- | --- | --- | --- | --- | --- |
| 01 需求输入 | Text, pasted notes, voice audio placeholder, uploaded material summary | `/api/intake` with `behavior_task_breakdown_system.md` and `experiment_design_principles.md` | `intake`, `copilot.summary`, `hypothesisDraft`, editable detail fields | User checks whether the proposed interpretation matches intent | Intake snapshot |
| 02 细节确认 | Edited summary, hypothesis, condition plan, material plan, outcome plan, QA plan, optional generation note | Client syncs edits, optional `/api/research-search` enriches literature hints | A confirmed decision bundle for protocol generation | User confirms the draft can become a machine-readable protocol | Decision bundle |
| 03 实验协议 | Decision bundle | `/api/protocol` | Protocol summary, condition matrix, visible protocol JSON | User confirms protocol and condition matrix | `protocol.json` |
| 04 提示词检查 | Protocol JSON | `buildPromptLab(protocol)` | Prompt variants, balance checks, condition diff | User chooses / confirms prompt style | `prompts.md` |
| 05 模型与预算 | Provider, model, API mode, repetitions | `buildRunPlan(protocol, settings)` | Call count, cost estimate, run warnings | User confirms model and budget | `run_settings.json` |
| 06 预实验检查 | Protocol + run settings | `/api/run` in preview mode | Parse rate, refusal/error flags, sample table | User decides go / revise | `preview_run.json` |
| 07 正式运行 | Confirmed preview and run settings | `/api/run` in formal mode | Full raw responses and analysis snapshot | User reviews completion | `formal_run.json` |
| 08 结果报告 | Run + analysis | `/api/export` | Markdown, CSV, JSON exports | User exports or iterates | Reproducibility package |

## Prompt Asset Map

- `app/prompts/behavior_task_breakdown_system.md`: Converts broad research ideas into runnable LLM behavior experiment drafts. It must handle impossible literal manipulations by operationalizing them as prompt or task conditions.
- `app/prompts/experiment_design_principles.md`: Lightweight DOE and behavioral-experiment principles used as background guidance.
- Future prompt files can split protocol compilation, prompt QA, benchmark matching, and report writing, but the UI should still expose only concise editable fields.

## Generation Task Visibility

The MVP uses a lightweight client-side task tray. It is not a backend queue. It exists to reduce user uncertainty during slow API calls:

- `intake_breakdown`: parse input and generate editable experiment details.
- `related_research`: retrieve and rank related literature hints.
- `protocol_compile`: compile confirmed details into protocol JSON and prompt checks.
- `preview_run`: run a small preview and compute QA metrics.
- `formal_run`: run the confirmed experiment and prepare results.

Future versions can replace this with persistent server jobs, but the user-facing contract should stay the same: task title, current action, progress steps, success/error state, and generated artifact.

## Optional Generation Note

The detail confirmation page includes a small optional field for one-off generation guidance. It should influence only the next generated artifact, such as:

- "把条件写成喝咖啡提示 vs 中性提示，不要写成模型状态。"
- "先用 benchmark 做因变量，开放回答放到二期。"
- "材料先用两个极简场景，避免过重的量表设计。"

This mirrors CourseMaker's extra-instruction pattern while staying experiment-specific.

## Non-Goals

- Do not add course outlines, lesson scripts, PPT generation, video generation, or teaching media workflows.
- Do not make internal agent roles visible as product theory.
- Do not make the quick-pilot UI carry a full preregistration form.
- Do not treat model names as experimental condition levels unless the explicit research question is model comparison.
