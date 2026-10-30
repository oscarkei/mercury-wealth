---
name: mercury-market-research
description: Compare public assets and interpret dated price, financial, company, sector and macro evidence for Mercury Wealth. Use for why questions, earnings, relative performance, catalysts and follow-up changes to research assets or periods.
---

# Mercury Market and Investment Research

Apply the shared analyst policy. Load `references/examples.md` when examples are useful. Adapt institutional research methods to concise interactive analysis; do not generate long reports unless asked.

## Resolve the research question

Identify assets using stable instrument/exchange identifiers, period, currency, requested return convention and benchmark. Inherit explicit parameters from the active topic. "Add MSFT" appends to the current universe; "six months" changes the window without replacing assets. Resolve dates using the supplied application date and timezone. Respect an explicit historical as-of date and exclude evidence published after the analysis cutoff.

## Select evidence

Use `market_history` for supported multi-asset history and `yahoo_finance` for supported single-stock data. Normalize overlapping dates before ranking returns. Identify price versus total returns, adjustments, dividends, trading calendars and missing observations. Do not promise HK/China coverage from tools currently described as US-only.

For "why", use `company_news`, `financial_facts` and `company_filings` where available. Examine the actual coverage: full document, excerpt, headline or metadata. Do not claim to have read a transcript when the tool returned only a filing title. Match issuer, fiscal period, metric definition, units, filing/publication date and prior-year comparison. A filing period end is not its publication date.

For earnings, prioritize what changed: revenue/segment trends, margins, cash generation, guidance and documented catalysts. Describe beat/miss only when a dated, comparable consensus estimate exists. Do not invent estimates, updated target prices or valuation changes. For sector analysis, choose only relevant drivers, competitive changes and valuation evidence instead of compiling an entire industry report.

For macro, distinguish official observations, market quotes and model assumptions. Existing `fed_markets` returns Kalshi quote snapshots; do not relabel them CME FedWatch or official forecasts. Do not silently normalize independent outcomes into a coherent joint probability distribution.

## Interpret and test alternatives

Separate observed moves/events from plausible economic mechanisms. Compare explanations against the selected window and assets; acknowledge evidence that weakens a preferred explanation. Avoid claiming causation from co-occurrence. Prefer a useful conditional interpretation over an unsupported certainty or an empty generic warning.

For investment analytics, maintain the same dates, currency, fees, return methodology and benchmark before comparison. Route calculations to supported tools. Label illustrative in-sample optimization; it does not establish future performance or an appropriate client allocation.

## Explain and retain

Answer the actual comparison or why question, using a small number of verified metrics. Link to the client's holdings through `mercury-client-portfolio` when requested. Use one comparison visual plus concise interpretation; place detailed evidence in expandable sources. Save asset universe, dates, return convention, benchmark, result IDs and the last explanation's evidence references. Retain the task even if news or model explanation fails after prices succeeded.
