# Mercury Wealth v0.4 Rev4

Mobile wealth research demo. On Vercel, DeepSeek Flash understands the request, chooses financial tools and selects validated, evidence-bound UI. Laya is removed from that runtime. The original local hybrid variant still uses Laya for UI selection. Neither variant silently falls back to another model.

This source snapshot includes the mobile app, analysis service, Supabase schema, financial calculations, tests and third-party UI notices. It contains no API credentials, local conversation exports, SQLite databases, model weights or installed dependencies.

## Vercel mobile chat (no Laya)

The root `Dockerfile.vercel` builds the mobile web app and Python finance tools into one Vercel container. Set the existing **DEEPSEEK_API_KEY** as a private Production secret and redeploy; no separate analysis host is required. See [Vercel direct-chat setup and limits](docs/deployment/vercel-direct.md).

The website uses a fictional committed portfolio. Completed analysis/chart JSON is kept in this browser (12 turns, bounded storage); encrypted follow-up tokens expire after eight hours. There is no cross-device cloud history or private Supabase access in this public demo. The local SQLite and credentials are not uploaded.

## Local hybrid requirements and setup

Use Node 24 and separate Python environments for finance and Laya. Install the reviewed Python versions from the supplied lock files; operating-system wheel availability may differ.

```sh
npm ci
python3 -m venv .venv-finance
.venv-finance/bin/pip install -r scripts/finance-requirements.lock.txt
python3 -m venv .venv-laya
.venv-laya/bin/pip install -r scripts/laya-requirements.lock.txt
cp .env.example .env.local
```

Configure the existing DeepSeek and Supabase credentials in `.env.local`. Set `MERCURY_LAYA_MODEL_PATH` to an existing local `convaiinnovations/laya-multilingual` model directory. Set `MERCURY_FINANCE_PYTHON` and `MERCURY_LAYA_PYTHON` to the absolute Python executable paths if they differ from the default `.venv-finance/bin/python` and `.venv-laya/bin/python` locations. Model weights are provisioned separately. See `docs/supabase-setup.md` and review the migrations before applying them to an existing database.

```sh
npm test
npm run analysis:test
npm run build
# In one terminal, from this repository root:
npm run analysis:start
# In a second terminal, from this repository root:
npm run start:mobile
```

Open `http://127.0.0.1:3001/phone?size=actual#chat`. The analysis service listens on loopback port 3009 and reads the authorized demo portfolio through the app on port 3001. Both processes must be running for connected chat. App configuration may also use local settings created by the existing configuration scripts; no existing user's settings are shipped.

The website root opens the mobile preview; desktop and tablet browsers retain a 390px app viewport inside a phone frame. Phones use the available screen width. Vercel builds use the public mock snapshot instead of calling the local-only holdings/history endpoints. For an equivalent local preview, build with `MERCURY_PUBLIC_MOCK=1`.

`public/demo/portfolio-history.json` contains saved illustrative curves for the committed fictional holdings, reconstructed from observed OpenBB/Cboe closes for MSFT, NVDA, AAPL, AMZN, GOOGL and IVV. It covers 20 June 2025–18 June 2026; unpriced holdings remain flat. It is neither live data nor actual account performance. Scope and displayed holdings must match before a saved curve can render. Regenerate it with `node --experimental-strip-types scripts/build-public-history.mjs /path/to/public-market-history.json`; the input must be a public `market_history` tool result, never a client database export.

## Supported calculations

- Authorized same-scope holdings snapshots and direct common-share price shocks.
- Held-portfolio current/target allocation differences after user-supplied percentage targets. Existing positions are retained in the calculation; relative weights within a category remain proportional. Missing targets prompt a question. Public ETF backtests cannot replace active client holdings.
- Separately requested public research models: OpenBB/Cboe historical closes, Riskfolio-Lib optimization, bt/QuantStats backtesting and FinanceToolkit statistics.
- Public macroeconomic and company sources, with explicit dates, units and missing-key states.

## Current limits

The local variant has a fixed authorized Okonkwo household capability. The public Vercel variant uses only its committed fictional snapshot. Before serving real clients, implement production identity, household authorization and private durable storage. Do not expose the local analysis service directly.

The Vercel runtime uses `/api/cloud-chat` as a synchronous streaming request with a 270-second deadline. Its API key must be configured before live chat works; a build or health check alone does not verify provider access. It keeps the existing calculation packages and does not install Laya/PyTorch. Instance-local concurrency/rate limits are not a global spending cap. The older separate-host/SQLite queue option is documented separately in [cloud-analysis.md](docs/deployment/cloud-analysis.md).

A direct-share shock does not cover all funds, ETFs, bonds or structured products. Unknown indirect exposure is not zero and calculated direct losses are not a proven lower bound on total losses. Whole-portfolio factor stress testing, bond duration/spread shocks and verified FCN/Accumulator valuation models remain unfinished. A one-off scenario loss is not historical volatility. Existing source replies are not rewritten by this export.

Held-allocation differences are hypothetical snapshot arithmetic. They do not establish executable orders, quantities, transaction costs, suitability or historical performance. Dates and coverage remain visible in the UI.

## Data and licensing

Keep `.env.local`, `.mercury/`, `services/analysis/data/`, caches, logs, model directories and SQLite files private. The committed `finance_service/data/strategy-prices.json` is an explicitly labelled synthetic fixture, not client history. Static demo proposal records are illustrative source records, not verified executed holdings.

See `THIRD_PARTY_UI_NOTICES.txt`, `docs/ui-licenses/` and `wealth-skills/THIRD_PARTY_NOTICES.md`. Dependency licenses and market-data terms still apply to the intended deployment.
