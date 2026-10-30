# Mercury Wealth Skill Library v0.1

Status: source library ready for integration review; not installed in the Mercury app and not live-model validated.
Date: 2026-10-28, Asia/Hong_Kong.

Use this application-owned instruction library with Gemini or another tool-capable model. Keep one main analyst orchestrator. Load the shared policy and relevant skill instructions; let the server execute bounded tools and deterministic calculations. This is not a Claude plugin or a personal ChatGPT skill installation.

## Contents

| Skill | Responsibility |
|---|---|
| mercury-client-portfolio | Interpret the selected demo client, holdings, exposure, mandate and benchmark |
| mercury-market-research | Compare assets and interpret dated company, sector and macro evidence |
| mercury-product-scenario | Understand product terms and translate questions into supported scenarios |
| mercury-response-ui | Explain findings and select approved components using verified result references |

Read `shared/analyst-policy.md` for behavior, `shared/memory-cache.md` for continuity, `shared/tool-map.json` for current versus proposed tools, and `contracts/analysis-contract.json` for application contracts. Each skill has short instructions and a reference file with examples. `evals/cases.json` defines acceptance cases using independent synthetic fixtures. `provenance.json` records upstream versions and adaptation boundaries. `LICENSES/Apache-2.0.txt` and `THIRD_PARTY_NOTICES.md` retain the upstream license and attribution.

## Load the library

1. Load the shared analyst policy, current structured analysis state, recent turns and a relevant demo-client summary.
2. Advertise the four skill names/descriptions. Select skills from intent and current context, not keyword matching alone. Allow multiple skills for a compound question.
3. Load a skill's body when selected; load its examples only when needed. Preserve decision-relevant history before adding more instructions.
4. Supply only tools the backend has actually registered. Treat a planned adapter in the tool map as unavailable until implemented and tested.
5. Execute tools in the application, return typed results, then let the same orchestrator decide whether evidence is sufficient.
6. Validate evidence references and response components; persist the message, structured state and tool-result references before announcing successful completion.

The runtime must implement these steps. Markdown files alone do not create memory, run Python, enable tools or change a model's capabilities. Do not concatenate all reference files into every prompt. Preserve the provider's supported tool-call history separately from the application state.

## Integration checklist

- Repair the existing history-clearing and in-memory-only state behavior before evaluating long conversations.
- Provide the approved demo holdings/context to the analyst. Do not repeatedly ask whether demo values are real.
- Implement a skill loader, tool gateway, state store and evidence validator. Do not add a separate router model or Laya call merely to load a skill.
- Map proposed capabilities to actual functions; existing libraries on disk are not automatically chat tools.
- Review thinking, token and timeout budgets together. Evaluate models with fixed evidence first, then end-to-end tool flows.
- Run `python3 scripts/check_library.py` for source consistency. Run the acceptance cases separately against the integrated app. The checker does not grade model quality, execute the finance engines or validate the app's memory implementation.

## Suggested first vertical slice

Compare NVDA/META/AMD → explain why → relate to the selected portfolio → add MSFT → change the date window → run an explicit scenario → refresh/restart → resume the correct scenario. Preserve period, symbols, snapshot, shock and evidence references throughout. Insert an unrelated question and verify the earlier analysis can be resumed by explicit reference.

## Portable source bundle

`Mercury_Wealth_Skill_Library_v0.1.json` is a UTF-8 source bundle. Its `files` array records relative paths, text contents and SHA-256 digests. Materialize it only into a fresh directory, reject absolute/traversal paths, verify hashes, then run the checker. The bundle is not a native Gemini installation format. A coding agent can read it directly and prepare an integration patch. No live app configuration is changed by this library.
