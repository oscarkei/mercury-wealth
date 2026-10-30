---
name: mercury-product-scenario
description: Explain Mercury product terms and translate portfolio or product what-if questions into supported deterministic scenarios. Use for notes, accumulators, coupons, barriers, autocall, underlying shocks, rate shocks and payoff questions.
---

# Mercury Product and Scenario Analysis

Apply the shared analyst policy and memory/cache contract. Load `references/examples.md` when needed. Treat product records as authoritative inputs, not generic market conventions.

## Resolve the product and question

Read the selected product or resolve it from demo holdings and conversation state. If multiple notes are equally plausible, ask the user to select one. Distinguish a decline in the note's quoted market value from a decline in its underlying. Resolve whether the request concerns current valuation, a future path, a barrier observation, a coupon or maturity cash flow.

Preserve reference price/fixing, shock basis, time horizon, path, notional, currency and all prior confirmed assumptions. "Make it 20% instead" changes only the shock in the same scenario. An explicit correction overrides the previous assumption without silently changing the product.

## Read and validate terms

Retrieve the exact product version. Confirm issuer, currency, notional, underlying basket/worst-of rule, initial fixings, strike, barrier type and observation convention, coupon conditions/memory, autocall schedule, maturity, settlement and relevant observation history. Identify missing fields required by the chosen engine. Do not infer a continuous barrier from a final-only condition or assume unconditional coupons.

For future document ingestion, retrieve source passages and extract candidate structured terms, then use verified/accepted terms for calculations. A matching RAG excerpt is not a completed product model. Do not silently replace a held product with the demo FCN just because the latter has an engine.

## Translate the scenario

Represent user changes as typed assumptions with origin and units: equity shock as a ratio, rate shock in basis points, currency convention, evaluation date and path if required. Let the server validate and normalize them. Preserve unaffected inputs. Before running, check the advertised engine supports this product and analysis type.

Use existing `evaluateProduct`/`projectedPayoff` or `accumulatorModel` only through a registered adapter and their actual supported terms. Their presence in source code does not mean arbitrary held notes are supported. Do not use a final-price-only helper for path-dependent conditions requiring observations.

For a linear equity scenario, shock verified marked exposure using the deterministic engine. Do not apply the same shock proportionally to a nonlinear note. A bond duration sensitivity is an approximation with assumptions, not a full repricing model. A maturity-payoff engine cannot produce a present fair value or executable sale price without an appropriate pricing model and inputs.

## Inspect and explain

Check cash flow dates, coupon conditions, principal redemption, early termination and the possibility of physical settlement against the engine result. Use the client's notional from the selected position. Compare baseline and scenario without overwriting actual holdings. Label unsupported holdings or missing repricing coverage; do not treat them as unchanged or zero risk.

Show a scenario/payoff component with verified result references and visible assumptions. Explain the trigger, consequence and client relevance. Save product/terms version, snapshot, scenario ID, shocks, path, horizon and result references so later comparisons and a restart use the same scenario.
