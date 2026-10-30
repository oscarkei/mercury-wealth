# Mercury Wealth v0.4 Rev4

Mobile wealth research demo. DeepSeek Flash understands the request and chooses tools; a separate local Laya model selects supported, evidence-bound UI. There is no model fallback.

This source snapshot includes the mobile app, analysis service, Supabase schema, financial calculations, tests and third-party UI notices. It contains no API credentials, local conversation exports, SQLite databases, model weights or installed dependencies.

## Requirements and setup

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

## Supported calculations

- Authorized same-scope holdings snapshots and direct common-share price shocks.
- Held-portfolio current/target allocation differences after user-supplied percentage targets. Existing positions are retained in the calculation; relative weights within a category remain proportional. Missing targets prompt a question. Public ETF backtests cannot replace active client holdings.
- Separately requested public research models: OpenBB/Cboe historical closes, Riskfolio-Lib optimization, bt/QuantStats backtesting and FinanceToolkit statistics.
- Public macroeconomic and company sources, with explicit dates, units and missing-key states.

## Current limits

This is a local demo with a fixed authorized Okonkwo household capability, not production multi-tenant authentication. Before internet deployment, implement production identity, household authorization, persistent server sessions and private storage controls. Do not expose the local analysis service directly.

A successful Vercel build does not deploy the complete chat runtime. The app currently expects a long-running analysis process on local port 3009, local Python/model files and writable persistent storage. Local API authorization also rejects public-host requests. Automatic analysis startup is disabled inside Vercel functions; hosting the frontend alone cannot enable chat by adding API keys. A hosted version needs an authenticated service boundary and persistent storage before the local-only routes can be replaced.

A direct-share shock does not cover all funds, ETFs, bonds or structured products. Unknown indirect exposure is not zero and calculated direct losses are not a proven lower bound on total losses. Whole-portfolio factor stress testing, bond duration/spread shocks and verified FCN/Accumulator valuation models remain unfinished. A one-off scenario loss is not historical volatility. Existing source replies are not rewritten by this export.

Held-allocation differences are hypothetical snapshot arithmetic. They do not establish executable orders, quantities, transaction costs, suitability or historical performance. Dates and coverage remain visible in the UI.

## Data and licensing

Keep `.env.local`, `.mercury/`, `services/analysis/data/`, caches, logs, model directories and SQLite files private. The committed `finance_service/data/strategy-prices.json` is an explicitly labelled synthetic fixture, not client history. Static demo proposal records are illustrative source records, not verified executed holdings.

See `THIRD_PARTY_UI_NOTICES.txt`, `docs/ui-licenses/` and `wealth-skills/THIRD_PARTY_NOTICES.md`. Dependency licenses and market-data terms still apply to the intended deployment.
