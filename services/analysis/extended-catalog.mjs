import {z} from 'zod';
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/),rid=z.string().regex(/^R\d+$/);
export const extendedSchemas={
 get_eia_outlook:z.object({}).strict(),
 market_history:z.object({symbols:z.array(z.string().regex(/^[A-Z][A-Z0-9]{0,9}(?:[.-][A-Z])?$/)).min(1).max(6),start_date:date,end_date:date}).strict(),
 optimize_allocation:z.object({history_result_id:rid,objective:z.enum(['min_variance','min_cvar','risk_parity']),cash_pct:z.number().min(0).max(40).default(10),max_asset_pct:z.number().min(10).max(100).default(60),capital:z.number().min(1000).max(100000000).default(1000000),cost_bps:z.number().min(0).max(100).default(10)}).strict(),
 strategy_backtest:z.object({dataset:z.enum(['observed_prices','explicit_demo']),history_result_id:rid.optional(),equity_pct:z.number().min(0).max(100).default(55),bonds_pct:z.number().min(0).max(100).default(25),gold_pct:z.number().min(0).max(100).default(12),minimum_cash_pct:z.number().min(0).max(50).default(5),drift_pp:z.number().min(.25).max(25).default(5),frequency:z.enum(['monthly','quarterly']).default('monthly'),cost_bps:z.number().min(0).max(100).default(10),initial_capital:z.number().min(1000).max(100000000).default(1000000)}).strict(),
 financial_metrics:z.object({history_result_id:rid}).strict(),
 get_bls_series:z.object({series_id:z.enum(['CUUR0000SA0','CUSR0000SA0','LNS14000000','CES0000000001']),start_year:z.number().int().min(2000).max(2100),end_year:z.number().int().min(2000).max(2100)}).strict(),
 get_eia_storage:z.object({}).strict(),
 get_eia_series:z.object({series_id:z.enum(['NG.NW2_EPG0_SWO_R48_BCF.W','NG.RNGWHHD.D']),start_date:date,end_date:date}).strict(),
 get_bea_series:z.object({table:z.enum(['T10101','T20304']),year:z.number().int().min(2000).max(2100)}).strict(),
 get_sec_filings:z.object({cik:z.string().regex(/^\d{1,10}$/)}).strict(),
 get_sec_facts:z.object({cik:z.string().regex(/^\d{1,10}$/),metric:z.enum(['Assets','Liabilities','StockholdersEquity','NetIncomeLoss','Revenues','RevenueFromContractWithCustomerExcludingAssessedTax']),period:z.enum(['annual','quarterly','instant']).default('annual')}).strict()
};
export const extendedDescriptions={
 get_eia_outlook:'Direct official EIA current STEO natural-gas outlook HTML and summary table; no key. Returns release date, forecast vintage, each annual value with ORIGINAL per-cell forecast flag. Historical baseline columns and projected columns remain separate. Includes dry gas production, consumption, LNG exports and Henry Hub annual average forecasts. Prefer this original source for gas forecast/baseline claims before searching secondary summaries. Not daily observed spot prices or completed current-month data.',
 market_history:'OpenBB / Cboe observed US stock and ETF daily closes. Up to six symbols, at most three historical years. No key. Returns stored result ID for optimization, financial_metrics and strategy_backtest plus charts. Price adjustment is unverified; never call it total return or actual client holdings.',
 optimize_allocation:'Riskfolio-Lib calculation on an EXISTING market_history result ID. Choose minimum variance (min_variance), minimum historical CVaR (min_cvar) or volatility risk parity. Requires at least two symbols and 90 common closes. Returns weights, VOLATILITY risk contributions for every objective, in-sample volatility and estimated model costs versus equal-weight reference. No actual holdings, suitability or transaction. Risk contributions are not CVaR contributions.',
 strategy_backtest:'Public hypothetical models ONLY. Never use for a client-portfolio follow-up or replace existing holdings with ETFs; use rebalance_portfolio or ask for missing target allocation. bt + QuantStats compares buy-and-hold, calendar and drift-band rebalancing with costs and drawdowns. observed_prices requires an existing history_result_id with exactly THREE tickers: equity_pct/bonds_pct/gold_pct are weights for the FIRST/SECOND/THIRD ticker respectively (labels retained from original engine). Otherwise explicit_demo is the clearly labelled original mock equity/bond/gold dataset, ONLY when user wants a demonstration. Residual cash zero return; next-close signal execution. Not out-of-sample evidence for fitted optimal weights; not client performance.',
 financial_metrics:'FinanceToolkit + QuantStats independently calculate and cross-check return, drawdown, annualized volatility and Sharpe from an existing market_history result. Risk-free rate zero, 252 days. Price-only statistics, not a forecast. This is calculation, not a fundamental-data subscription.',
 get_bls_series:'Direct BLS public API v1; no key. CPI NSA CUUR0000SA0, CPI SA CUSR0000SA0, unemployment SA LNS14000000, nonfarm payrolls SA CES0000000001 (thousands). Up to 3 years; cached to conserve free quota. Observations are months, not release dates. Conventional CPI YoY uses NSA and same month prior year.',
 get_eia_storage:'Direct EIA public weekly natural-gas storage CSV; no key. Returns release date, week-ending date, stock and weekly change with separate roles and exact Bcf conversions. It is historical reported survey data subject to revision, NOT a forecast. Does not provide annual production forecasts. Useful for gas research together with original STEO sources.',
 get_eia_series:'EIA official API v2 historic Henry Hub daily spot or lower-48 weekly working-gas storage. REQUIRES EIA_API_KEY. If unavailable, tool reports needs_key, never substitutes data. get_eia_storage is a separate keyless public download. Forecast STEO is a separate source; never classify all its historical baselines as forecasts.',
 get_bea_series:'Official BEA NIPA API: T10101 line 1 real GDP quarter-on-quarter annualized percent growth; T20304 line 1 PCE price index (NOT inflation percent). REQUIRES BEA_API_KEY. Missing key returns needs_key, not a fabricated series.',
 get_sec_filings:'SEC EDGAR public company submission history; no key. Use verified CIK from known public source (Apple 320193, Microsoft 789019); public corporate filings only. Returns latest 10-K/10-Q/8-K accession, filing date, report period and link. Not client data or trading.',
 get_sec_facts:'SEC XBRL public financial statement facts, no key. Selected US-GAAP concept, explicit instant/quarterly/annual duration, currency USD. Returns period dates, filing dates, accession and revision choice. No mixing YTD with standalone quarter. Empty concept is missing data; do not invent or combine different concepts. Not market prices or client data.'
};
export function providerStatus(){return [
 {provider:'OpenBB / Cboe',state:'keyless',detail:'股票／ETF 日收市價；非已核實總回報'},
 {provider:'Riskfolio-Lib',state:'local',detail:'最低波動／最低 CVaR／風險平價；波動風險貢獻'},
 {provider:'bt + QuantStats',state:'local',detail:'持有／定期／偏離再平衡；實際價格試算或明確 demo'},
 {provider:'FinanceToolkit',state:'local',detail:'歷史回報及風險計算，與 QuantStats 交叉核對'},
 {provider:'BLS v1',state:'keyless',detail:'官方月度 CPI、失業率、非農就業；免費額度有限'},
 {provider:'EIA STEO public outlook',state:'keyless',detail:'官方年度基數／預測，逐欄保留來源 Forecast 標記'},
 {provider:'EIA public CSV',state:'keyless',detail:'每週天然氣庫存；歷史報告，並非預測'},
 {provider:'EIA API v2',state:process.env.EIA_API_KEY?'configured_not_yet_verified':'needs_key',signup:'https://www.eia.gov/opendata/register.php'},
 {provider:'BEA API',state:process.env.BEA_API_KEY?'configured_not_yet_verified':'needs_key',signup:'https://apps.bea.gov/api/signup/'},
 {provider:'SEC EDGAR',state:'keyless',detail:'公司申報及 XBRL 財務資料；受來源存取限制'}];}
