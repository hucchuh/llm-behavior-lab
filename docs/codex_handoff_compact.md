# Codex Compact Handoff

Use this file to continue the project in a fresh Codex thread with much less context.

## Project

Workspace: `C:\Users\hp\Documents\New project\llm-behavior-lab`

Local app URL: `http://127.0.0.1:8780/`

The app is an LLM behavior experiment platform. Current flow:

1. User enters a research idea or uploads materials.
2. The system generates a lightweight detail confirmation page.
3. Internally, the system uses a three-agent workflow that should not be exposed as a visible page section:
   - Intake Agent: translates the idea into a minimal runnable experiment draft.
   - Research Scout Agent: suggests and now can retrieve related literature/benchmark results.
   - Design Critic Agent: checks whether condition grouping and outcomes are interpretable.
4. User confirms condition grouping, material/prompt versions, outcome/scoring, and preview QA.
5. The app generates protocol JSON, prompt variants, model/budget settings, preview run, formal run, and result report.

## Important Recent Decisions

- Step 02 should stay lightweight. It should not expose a heavy methodology checklist.
- Step 02 should not show a "multi-agent collaboration" theory/audit panel. Agent outputs should be folded into final editable fields, research results, warnings, and QA notes.
- For examples like coffee/sleep deprivation, do not describe model internal states. Use prompt/material versions such as:
  - `喝咖啡提示` vs `不喝咖啡提示`
  - `睡眠不足提示` vs `正常休息提示`
- Related research search should not block intake. `/api/intake` returns the draft first. `/api/research-search` loads OpenAlex results asynchronously afterward.
- The Research Scout currently uses OpenAlex public API and falls back to suggested search queries if external search fails.
- Retrieved research results now receive an `evidence` score/strength/reasons object before rendering, and the 02 page shows compact relevance badges.
- API key should not be written into repo files or final messages.

## Key Files

- `app/lib/pipeline.mjs`: intake parsing, copilot fields, multi-agent workflow, protocol/run/report logic.
- `app/server.mjs`: HTTP API, LLM call, `/api/research-search`, OpenAlex search.
- `app/public/index.html`: app screens and 02 detail confirmation UI.
- `app/public/app.js`: client state/rendering, async research search.
- `app/public/styles.css`: visual system and component styling.
- `app/prompts/behavior_task_breakdown_system.md`: system prompt for experiment breakdown.
- `docs/multi_agent_workflow.md`: multi-agent design note.

## Verification Commands

Run from workspace root:

```powershell
node .\app\tests\pipeline.test.mjs
node .\app\tests\server.test.mjs
node .\app\tests\static-ui.test.mjs
node --check .\app\server.mjs
node --check .\app\public\app.js
node --check .\app\lib\pipeline.mjs
```

## Performance Notes

This prior Codex thread became slow because of very large accumulated context:

- many full-file reads
- large diffs and test outputs
- repeated design iterations
- interrupted turns
- tool outputs kept in the conversation

In the next thread:

- read only targeted file sections with `rg` and small `Get-Content -Skip/-First` windows
- avoid pasting full diffs unless needed
- run focused tests first, full tests only before finalizing
- keep final/user updates short
- avoid reinstalling or loading broad skills unless directly needed
