export const definitions={
 accumulator_terms:{description:'Read the verified held Apple accumulator terms for the selected demo scope',source:'Mercury imported product terms',privacy:'demo_context',timeoutMs:1000,input:'Server-selected held instrument',output:'AccumulatorTerms'},
 accumulator_scenario:{description:'Illustrative constant-price accumulation; guarantee period, fees and settlement excluded; not a live derivative price',source:'Mercury deterministic accumulator engine',privacy:'demo_context',timeoutMs:1000,input:'shockPct (-100 to 30) and days (1 to 60)',output:'AccumulatorScenario'},
 market_history:{description:'Observed price history for public US tickers',source:'OpenBB / Cboe',privacy:'public',timeoutMs:35000,input:'ResearchPlan',output:'ResearchData'},
 optimize_allocation:{description:'Constrained illustrative allocation, never actual client trades',source:'Riskfolio-Lib',privacy:'public',timeoutMs:35000,input:'ResearchPlan',output:'ResearchData'},
 fed_rates:{description:'Actual Fed rate history',source:'NY Fed',privacy:'public',timeoutMs:10000,input:'FedPlan',output:'FedData'},
 fed_markets:{description:'Meeting quote snapshots',source:'Kalshi',privacy:'public',timeoutMs:10000,input:'FedPlan',output:'FedData'},
 yahoo_finance:{description:'Single-stock price and volume',source:'Yahoo Finance',privacy:'public',timeoutMs:19000,input:'StockQuery',output:'StockAnalysis'},
 company_news:{description:'Dated company headlines/excerpts; historical coverage may be partial',source:'Yahoo Finance RSS / issuer IR',privacy:'public',timeoutMs:18000,input:'CompanyQuery',output:'EvidenceItem[]'},
 company_filings:{description:'SEC annual/quarterly filings and earnings-event metadata',source:'SEC EDGAR',privacy:'public',timeoutMs:20000,input:'CompanyQuery',output:'EvidenceItem[]'},
 financial_facts:{description:'Reported revenue, net income, diluted EPS and cash flow; comparable periods',source:'SEC Company Facts',privacy:'public',timeoutMs:22000,input:'CompanyQuery',output:'EvidenceItem[]'},
 portfolio_context:{description:'Read the server-selected demo scope from Supabase; approved summary is available to the analyst',source:'Supabase PostgreSQL',privacy:'demo_context',timeoutMs:15000,input:'PortfolioScope (server supplied)',output:'FamilySnapshot'},
 portfolio_exposure:{description:'Direct weights/exposure from the selected valuation snapshot; no assumed historical P&L',source:'Mercury deterministic calculation',privacy:'server_only',timeoutMs:1000,input:'Snapshot + public symbols',output:'PortfolioImpact'},
} as const;
export const toolIds=Object.keys(definitions) as (keyof typeof definitions)[];
export const marketToolRegistry=Object.entries(definitions).map(([id,definition])=>({id,...definition,state:'chat_ready'}));
