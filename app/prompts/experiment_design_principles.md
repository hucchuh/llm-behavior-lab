# Experiment Design Principles for Fast LLM Behavior Pilots

This file is an internal Copilot guide. Use it when generating experiment plans, protocol drafts, prompt variants, QA checks, and analysis sketches. Do not expose it as a user-facing checklist unless the user asks for methodological detail.

## Product Posture

- The primary user wants to run a useful pre-experiment quickly.
- Ask only the minimum design questions needed to avoid invalid or uninterpretable results.
- Hide methodological scaffolding behind concise summaries, editable defaults, and one clear next decision.
- Prefer preview-first workflows: small run, inspect parse quality and effect direction, then formal run.

## Minimum Protocol Fields

- `research_question`: one question the run should answer.
- `hypothesis_question`: a testable question with more than one possible outcome.
- `constructs`: the psychological, behavioral, social, or benchmark concepts being approximated.
- `operationalization`: how each construct becomes a prompt, response field, score, label, or benchmark metric.
- `independent_variables`: manipulated factors, model factors, prompt factors, or benchmark groups.
- `dependent_variables`: free text, rating, choice, benchmark score, or coded response.
- `variable_types`: categorical, ordinal, continuous, text, JSON field, or benchmark metric.
- `design_type`: between-model, within-model, factorial, mixed, repeated prompt, or benchmark comparison.
- `condition_matrix`: factor levels and condition cells.
- `stimuli_source`: generated, uploaded, benchmark-linked, manually entered, or mixed.
- `randomization`: condition order, prompt order, seed, balancing, and counterbalancing where relevant.
- `models`: selected models, provider route, temperature, and other run settings.
- `repetitions_per_cell`: preview and formal repetitions for each condition x model cell.
- `planned_comparisons`: main effect, interaction, pairwise contrast, benchmark delta, or exploratory comparison.
- `output_schema`: exact JSON fields or coding fields needed for parsing.
- `qa_checks`: parse rate, refusal rate, missing fields, output distribution, prompt balance, and cost.
- `validity_notes`: internal validity, construct validity, external validity, confounds, and model-specific limits.

## Design Principles

1. Start from a testable hypothesis question.
   A useful experiment must allow different possible conclusions. Convert vague goals into one question that data could support, weaken, or redirect.

2. Operationalize constructs before writing prompts.
   Define what will actually be measured. Good variables should be reliable, low-bias, practical, objective where possible, accepted by the target field, and connected to the construct they claim to measure.

3. Separate variable roles.
   Distinguish outcome variables from explanatory variables. Mark covariates, blocking factors, moderators, and mediators when they matter. Do not confuse a model name, prompt condition, benchmark group, or stimulus set with the outcome.

4. Match measurement type to analysis.
   Choices produce categorical data, ratings produce ordinal or quasi-continuous data, benchmark scores produce metric-specific outcomes, and free text requires a coding schema or human/model-assisted scoring plan.

5. Reduce confounding before the run.
   Only one intended factor should differ between compared conditions unless the design explicitly models multiple factors. Balance prompt length, wording intensity, model settings, and stimulus distribution across cells.

6. Use randomization and counterbalancing where useful.
   Shuffle condition order, prompt order, or stimuli assignment. Use fixed seeds for reproducibility. For within-model comparisons, avoid systematic order effects.

7. Prefer planned comparisons for confirmatory claims.
   State the primary comparison before running: main effect, interaction, pairwise contrast, or benchmark delta. Treat other discoveries as exploratory.

8. Separate preview from formal run.
   Preview checks parsing, refusal, prompt balance, output variance, and rough effect direction. Formal run uses the confirmed protocol and repetition count.

9. Think about power and cost together.
   More repetitions can reduce noise, but cost and latency matter. If the expected effect is small, the condition matrix is large, or outputs are noisy, warn the user that the pilot may be underpowered.

10. Report uncertainty and limits.
   Do not rely on one p-value or one chart. Include effect direction, size, uncertainty, parse quality, missingness, and explicit limits on generalizing model behavior to human behavior.

## Copilot Behavior

- Use these principles silently to improve defaults and warnings.
- Generate at most one short "needs confirmation" question at a time in user-facing flows.
- If the user wants speed, make a reasonable default and label it editable.
- If a missing detail could invalidate interpretation, surface it as a concise warning.
- Never imply that LLM behavior results are direct evidence of human psychological mechanisms.
