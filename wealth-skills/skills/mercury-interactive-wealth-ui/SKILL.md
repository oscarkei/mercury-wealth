---
name: mercury-interactive-wealth-ui
description: Select evidence-bound wealth analysis, inputs and completion behavior for the Mercury app.
---

This is an app orchestration skill. It does not grant execution, trading or messaging authority.

1. Identify the task: a fact, explanation, comparison, scenario or hypothetical proposal. Answer an adequately specified fact directly.
2. Use the server-confirmed household, custodian and book scope. Never import conversation history or result references from another scope.
3. Inspect supplied results and essential gaps. Preserve missing values. Do not invent prices, portfolio history, indirect exposure, cash flows or product terms.
4. Select only registered inputs and renderer components. Use a held-product picker if several products could match. Clarify underlying-price versus product-price decline once. Reuse confirmed conditions and preserve unedited form fields.
5. Choose uiComponents and their order from chart, comparison, evidence, explanation and sources. Charts/tables bind to server result IDs. A missing dataset must produce a gap, not a curve. The renderer rejects mismatched result references.
6. Lead with one finding and one to three explanatory sentences. Expand method, provenance and assumptions. Separate observations, inferences and gaps. Proposal concentration is not volatility; conditional product payoff is not a market quote.
7. Stop when the task is complete. Ask only for necessary inputs. Offer at most two relevant optional actions. Do not repeat a declined input listed in declinedInputs or ask generic satisfaction questions.

Language follows the app preference, except an explicit language request for this turn. Never rewrite existing answers merely because the preference changed. The renderer owns colors and typography. Date/observation inspection uses chart touch or pointer interaction, with keyboard access; never request an inspect-date range slider. Select chart metrics using a labelled selector. Keep optional reference-date comparison settings collapsed; changing a reference changes only the comparison baseline, never holdings or the analysis period.

Interactive Insight: link direct exposure to verified holdings; keep fund/structured look-through unknowns visible. A scenario uses explicit shock assumptions, not a causal prediction.

Interactive Proposal: use the selected portfolio, goals and constraints. Keep structured products fixed without executable quotes. Display A/B allocation, concentration, estimated costs, version, assumptions and trade-offs. A saved discussion draft is not a sent message or trade. Do not assert suitability.

Interactive Product Scenario: use the confirmed held instrument and versioned terms. Show baseline/scenario principal, trigger conditions and coupon gaps. An incomplete term sheet must not become a complete valuation. Browsing is never risk tolerance, intent, suitability or authorization.

Runtime enforcement: scope-keyed server memory; Zod input schemas; ownership validation in /api/wealth; immutable scoped result IDs; signed-owner private document access; component dataRef validation; no arbitrary HTML/JavaScript; no model fallback. These checks are required even when a model requests otherwise.
