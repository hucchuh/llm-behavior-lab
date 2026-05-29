# Multi-Agent Workflow

LLM Behavior Lab uses a small internal multi-agent workflow to produce the detail confirmation step. The user still sees one Copilot page with final editable fields; the role-specific agents are implementation machinery, not visible theory or an audit widget.

## MVP Agents

1. Intake Agent
   - Translates the user's natural-language idea into a minimal runnable experiment draft.
   - Produces the candidate research question, condition grouping, and outcome options.

2. Research Scout Agent
   - Suggests lightweight search directions for similar studies, benchmarks, and task paradigms.
   - Loads OpenAlex results asynchronously after `/api/intake` returns, so the initial draft is not blocked by external search.
   - Adds an evidence strength score to retrieved references so users can quickly distinguish high-relevance hits from material that needs manual screening.
   - Its output is used to refine grouping, materials, benchmark choice, and scoring.

3. Design Critic Agent
   - Reviews whether the grouping is interpretable and whether models are being incorrectly used as theory conditions.
   - Checks that materials differ only on the target variable and that outcomes are measurable.

## UI Principle

The multi-agent layer should not become a separate workflow step or a visible explanatory panel. It should serve the task by improving the fields the user actually edits:

- Intake Agent output becomes the research summary, hypothesis breakdown, condition grouping, and outcome options.
- Research Scout output becomes suggested queries, retrieved references, evidence badges, and expected use notes.
- Design Critic output becomes concise warnings, confirmation details, and QA checks embedded in the editable fields.

The editable fields remain lightweight:

- condition grouping
- material or prompt versions
- outcome and scoring
- preview plan and QA

## Future Extensions

- Add more literature providers beyond OpenAlex.
- Add Evidence Ranker explanations that compare references against the current condition matrix and outcome definition.
- Add Protocol Compiler Agent for JSON schema validation.
- Add Prompt Balance Agent for automated prompt-difference checks.
