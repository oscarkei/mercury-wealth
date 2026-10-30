---
name: mercury-response-ui
description: Compose Mercury Wealth answers and select approved UI components from verified analysis results. Use after research or calculations, for concise answers, deeper follow-ups, source expansion and scenario comparisons.
---

# Mercury Response and UI Composition

Apply the shared analyst policy. Load `references/examples.md` when helpful. Compose the answer from actual results, not from a desired-looking layout.

## Select the response shape

Use the user's question and analysis depth to select a concise answer or deeper explanation. Lead with a direct finding; explain why it matters; relate it to the client where relevant; offer a concrete next analysis only if available. A question about performance need not show a full holdings table. A simple clarification needs no chart.

Choose from the component catalog advertised by the runtime. Request at most one primary visual initially, with optional detail on expansion. Use a line chart for paths, a table for exact comparisons, an exposure card for concentration, and a scenario/payoff panel for product outcomes only when those components exist. These are semantic intents; the adapter maps them to existing component IDs. Never invent an installed component or emit arbitrary HTML/JavaScript, raw chart arrays or external executable content.

## Bind evidence

Refer to server-owned result and metric IDs, not duplicated values. Each numerical claim must match the result's entity, metric, scope, currency, date/period, denominator and method. For changes, distinguish percentage points, percentage changes and basis points. Dates used as evidence need a source/date reference; user dates and scenario parameters may be typed assumptions. Instrument names containing digits must be catalog-resolved.

Provide claims with type `fact`, `calculation`, `scenario` or `inference`. An inference can cite observations but must not be presented as a proved cause. Keep financial figures in verified bindings while preserving natural, useful interpretation. Do not fall back to a global prohibition on digits as the standard answer policy.

Use result references for component data. The frontend resolves the data only after schema, evidence and scope validation. Align every displayed series with the requested period and currency. A correct value attached to the wrong issuer, period or caption is still invalid.

## Keep the surface focused

Default to a short analyst-style answer, usually two or three short paragraphs plus a relevant visual. Expand when the user asks why, asks for detail, or the decision requires it. Keep sources, full tables and method details expandable. Keep material dates, mixed valuation dates, assumed shocks and missing coverage visible without turning the answer into a disclaimer list. Show the demo status once in the surrounding UI rather than repeating it in every paragraph.

## Handle validation and failures

If a draft has invalid references, repair only the invalid portions with the same verified evidence and a bounded repair budget. If repair fails, omit the invalid claims and show the supported result/limitation. Do not re-fetch or recompute successful tool results merely because prose failed. Preserve completed charts if the model or another upstream tool fails, distinguishing completed analysis from an incomplete explanation.

Save the actual answer, selected components, result/metric references and completion status to conversation history, including locally generated outputs. Do not let a provider-source filter hide portfolio replies from future context. Avoid an additional model call for UI classification unless testing demonstrates a clear improvement.

## Interactive inputs (v0.4)
During planning use inputKind=rebalance with workflow=clarify for an open-ended rebalancing request. The form is a public reference allocation, never a representation of actual holdings. Use inputKind=shock_meaning only when underlying versus product-price decline is unresolved. Other clarifications use one concise question. Known context must be reused.

UI selections are proposals: the server validates component IDs, parameter ranges, duplicate symbols and feasible allocations. Editing a form does not calculate. Explicit submission executes registered tools only. No HTML, JavaScript, installation, trade, signature or adviser-send actions are available.

Respect app language. Default to one finding and one to three explanatory sentences; evidence and methodology are expandable. Omit optional next actions when complete. Never infer suitability or transaction authorization from browsing. Preserve every unchanged parameter on follow-ups and reuse completed results for presentation-only changes.
