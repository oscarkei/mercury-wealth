# Mercury Strategy Engine — local MVP

## Available now

Open `http://127.0.0.1:3000/strategies` after starting Mercury. The TWR workbench links to this page.

1. Set equity, bond and gold proxy targets. Unallocated capital is USD cash.
2. Select monthly/quarterly scheduling, an absolute drift band in percentage points, a minimum cash target and a per-side trading cost in basis points.
3. Compare buy & hold, fixed-target calendar rebalancing and fixed-target drift-band rebalancing.
4. Inspect the interactive portfolio-index/drift chart, cumulative return, maximum drawdown, costs, ending weights and the complete trade ledger. Export the versioned JSON result.

This is a strategy comparison workbench. It does not select a winning strategy or place orders. It does not modify the separate portfolio-rebalance Vercel app or Supabase.

## Data and calculations

- Python `bt==1.4.1` provides the portfolio/security ledger and commission accounting; QuantStats computes maximum drawdown. Other displayed metrics reconcile directly to the ledger. Both are already installed in the local finance environment.
- The packaged 750-observation fixture is extracted from the recovered Mercury V1 **generated mock EOD data**, from 2023-08-07 to 2026-06-19. All three source price series declare USD: the IVV equity proxy, UBS China Fixed Income Fund and physical gold ETC. Source tickers/price currencies are inherited mock metadata, not verified live vendor identifiers.
- These are price-only simulations. Dividends, interest, taxes, FX, corporate actions, external cash flows, lot-size and liquidity restrictions are excluded. Cash earns zero. Units are fractional. No leverage or shorts.
- Every strategy starts from the same capital, with the same first-close allocation and initial costs. The first plotted index can therefore be below 100. Total return is ending NAV / initial capital − 1, without annualization. Drawdown includes the initial capital and initial fee.
- Cost = absolute traded notional × cost_bps / 10,000 for each buy and sell. The engine solves post-fee NAV before setting target quantities, then reconciles the `bt` ledger to fees. Both initial and later costs are included in total cost.
- Drift is the maximum absolute difference between actual and target weights, including cash. A 5pp band means 55% → 60%, not a 5% relative change.
- The band strategy signals when drift reaches the band or cash falls below the configured floor. A calendar signal occurs on the first supplied observation of a new month/quarter, based on the change from the prior observation. Both execute at the **next supplied close**. No end-of-period close is inferred from future prices. A final signal with no next observation remains pending.
- The cash minimum is enforced at allocation/rebalance and monitored at each supplied close. Market moves may cause intermediate breaches. Buy & hold and calendar policies do not automatically restore cash after every breach; the comparison reports those observations.
- The input hash covers normalized parameters and all selected prices. Every decision records signal/execution dates, quantities, notional, cost and reason. There are no external cash flows, so the NAV return also equals the linked return for this simulation.
- All strategies share a balanced starting allocation; there is no benchmark outperformance claim. A future policy benchmark requires its own versioned allocation, currency and total-return method.

## Local API

`POST /v1/strategy/backtest` on the existing private FastAPI service (port 8890), with bearer authentication. The browser uses the signed local-session, same-origin Next proxy `POST /api/finance/strategies`. The private key remains server-side. One calculation worker, single-thread BLAS and a fixed dataset allowlist keep the service bounded. The decimal TWR endpoint remains available.

Input fields: `dataset`, `equity_pct`, `bonds_pct`, `gold_pct`, `minimum_cash_pct`, `drift_pp`, `frequency`, `cost_bps`, `initial_capital`, optional ISO `start` / `end`. The supported dataset ID is `mercury-usd-mock-v1`. Extra fields, nonfinite inputs, insufficient cash targets and unsupported dates are rejected. No model-generated Python or arbitrary URL is executed.

Outputs always include `execution_ready: false` and `suitability_status: not_assessed`. Asset-class proxy weights are not client-specific security concentration checks. Historical simulation is not actual Lim/Okonkwo/Zhang performance.

## Next steps

1. Data adapter: verified adjusted/total-return prices, instrument master and FX, with source/date/quality metadata. Keep this mock fixture as the resettable demo dataset.
2. Policy/suitability gate: versioned household mandate, risk profile, product eligibility, concentration and trading restrictions. Missing information blocks an executable proposal. Distinguish alerts from hard limits.
3. Optional allocation builder: add PyPortfolioOpt for constrained minimum-variance / efficient-frontier targets. Use only prior training windows, then test subsequent periods; include turnover/cost constraints. No full-history optimization presented as out-of-sample performance.
4. Orchestration: expose approved strategy tools to Gemini/Laya. The LLM chooses validated parameters and explains results; the engine calculates, the rule layer checks, and an adviser reviews. Chat integration and scheduled monitoring are not part of this MVP.

Future admin flow: choose portfolio/data → choose versioned policy → simulate → inspect breaches/trade draft → adviser review → publish an approved proposal. No auto-execution implied.

## References

- Existing concept: https://portfolio-rebalance.vercel.app/ — configuration drift, cash/concentration limits and a trade-preview workflow. The public demo's Copilot responses and tax-saving examples are preset UI content; no tax engine was inferred.
- Portfolio Visualizer: https://www.portfoliovisualizer.com/faq — useful product/methodology reference for backtesting, portfolio optimization and tactical models. No documented public integration API was found in the reviewed pages; no dependency on its hosted calculations is implemented.
- bt (MIT): https://github.com/pmorissette/bt — composable Python strategy backtesting.
- PyPortfolioOpt (MIT): https://github.com/PyPortfolio/PyPortfolioOpt — optional next-stage allocation optimization, not installed in this stage.

The local Python API will need a hosted Python runtime and production authentication when deploying the Next UI to Vercel. Supabase remains the PostgreSQL data store; this workbench has not written strategy results to it.
