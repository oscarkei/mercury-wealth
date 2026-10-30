---
name: mercury-client-portfolio
description: Analyze the selected Mercury demo client's holdings, allocation, direct and indirect exposure, concentration, benchmark and IPS. Use for portfolio impact, positioning, drift, performance context and client-related follow-ups.
---

# Mercury Client and Portfolio Analysis

Apply the shared analyst policy and memory/cache contract before this skill. Load `references/examples.md` for worked response patterns when needed.

## Establish the subject

Read the server-selected household/account/book scope, demo dataset version, base currency and valuation dates. Use the requested scope literally; do not widen an account to a household. Resolve the research assets or product from conversation state. Use existing client goals and confirmed preferences; do not ask for information already supplied.

## Choose the analysis lens

- For "how does this affect me", inspect actual demo holdings and identify the applicable exposure or scenario lens.
- For concentration, inspect issuer, asset, sector, currency and underlying relationships separately. Group by stable instrument identifiers, not ticker text alone.
- For drift, use the client's confirmed IPS or assigned model. Show absolute percentage-point drift and a monetary deviation only when targets and current weights share the same denominator. Do not invent a universal 10% concentration limit or a ±5% rebalance rule.
- For performance, request a supported performance tool with historical valuations, flows, prices/FX and a stated method. Snapshot unrealized P&L and market-price returns are not time-weighted portfolio returns.
- For rebalancing, preserve the current portfolio; create an explicitly hypothetical proposed allocation and compare it using supported deterministic tools. Attribute performance separately from allocation optimization.

## Collect and inspect results

Use `portfolio_context` for the selected snapshot and `portfolio_exposure` for supported direct matching. Those existing tools do not calculate fund look-through or nonlinear structured-product risk. Use additional adapters only when advertised as available. Check holdings total versus snapshot total, mixed valuation dates, duplicates, missing classifications and unclassified value. Do not silently drop unresolved holdings.

If fund constituents are available, calculate proportional underlying exposure using fund position value × constituent weight, carrying constituent dates and coverage. Do not add the original fund value and its constituents into portfolio NAV. Report known exposure and unresolved value separately. Structured-product underlying linkage is neither an equal cash-equity position nor a measured delta exposure; issuer credit exposure is a separate dimension.

Read market or scenario evidence through the relevant skill when the question needs it. Translate findings into portfolio relevance: what is held, why it matters, what is already measured, what remains unknown. Distinguish exposure review from estimated scenario loss and actual historical P&L.

## Deliver and remember

Provide one main judgment supported by verified metrics, a relevant exposure/drift table or compact chart, and a useful follow-up analysis. Avoid reproducing the entire holdings table unless requested. Keep material coverage limits visible. Save the selected scope, snapshot, assets, benchmark/IPS reference, result IDs and unresolved questions into structured state. Preserve the prior public research topic so "back to the comparison" works.
