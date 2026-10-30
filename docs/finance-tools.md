# Local finance calculation libraries

Installed on 26 October 2026 in the dedicated Python 3.11.17 arm64 environment at `work/finance-venv`:

- QuantStats 0.0.86
- FinanceToolkit 2.3.0
- 42 installed distributions including NumPy, Pandas, SciPy and Matplotlib

The environment is separate from Laya and uses the project's existing Python runtime. The initial library installation was independent of the Portal, Laya and database. A separate single-worker FastAPI calculation service has since been added; see finance-api-twr.md. The libraries are Python calculation tools, not additional LLM weights.

## Reproduce

The requested versions are recorded in `scripts/finance-requirements.in`. All resolved versions are pinned in `scripts/finance-requirements.lock.txt`.

On a machine with Python 3.11:

```sh
python3.11 -m venv .venv-finance
.venv-finance/bin/python -m pip install -r scripts/finance-requirements.lock.txt
```

The original Mac installation used the bundled uv runtime and a workspace-local cache. A future host resolves platform-specific wheels; the Mac virtual environment itself should not be committed or uploaded to GitHub.

## Verify

Double-click `outputs/Test Mercury Finance Tools.command` or run the local interpreter against `scripts/check-finance-tools.py`.

The checker limits BLAS/OpenMP to one thread, uses a headless plotting backend, keeps the font cache in `work/finance-cache`, disables FinanceToolkit's automatic data cache and rejects socket connections. It does not use external financial data credentials.

Checks completed:

1. A known price path (100 → 110 → 88 → 96.8 → 101.64) produces a 1.64% compounded return, −20% maximum drawdown and matching annualized Sharpe across both libraries and manual formulas.
2. The recovered 51,750 mock price records (69 instruments × 750 dates) produce matching compounded returns, annualized Sharpe, volatility and maximum drawdown in both libraries. Four constant-price cash series correctly have undefined Sharpe.
3. The plotting dependencies create a local synthetic chart without network access.

Conventions are explicit: daily decimal returns, 252 annualization periods, zero risk-free rate, sample standard deviation, first observation return set to zero, and local instrument-price currency. FinanceToolkit's period-based calculation receives a PeriodIndex; annualization is applied explicitly to its low-level Sharpe function.

This is installation and numerical compatibility verification. It does not implement transaction/cashflow/fee-adjusted portfolio TWR/MWR, IPS breach rules or contractual SP settlement. It does not persist performance to Supabase or connect these tools to the Portal chat. External market/fundamental feeds may still require their own API access even though supplied-data calculations do not.

## Measured resources

The report `outputs/Mercury Finance Tools Verification.json` includes wall time, CPU time and peak RSS for the single test process, including library imports and source-JSON loading. First-use font discovery happened before this timed test; subsequent runs reuse the local font cache. These figures are a sample workload measurement, not a limit or guarantee for every analysis.

`outputs/Mercury Finance Tools Installation.json` records the measured virtual-environment footprint. The shared Python runtime and uv download cache are accounted for separately from that environment; the existing Laya installation is not included.

Sources: [QuantStats](https://pypi.org/project/quantstats/), [FinanceToolkit](https://pypi.org/project/financetoolkit/).

## TWR service added

FastAPI 0.162.0, Uvicorn 0.54.0 and Pydantic 2.14.1 are now available in the same isolated environment. That stage's lock file included 56 packages. The initial resource benchmark above remains a library-check measurement; the live Decimal TWR service is verified separately in outputs/Mercury TWR Verification.json.

## Strategy engine added

`bt==1.4.1` is installed for the three-policy comparison at `/strategies`, served through the same private FastAPI worker. The current lock file pins 66 distributions; the environment occupies approximately 398 MB on this Mac. This is a supplied mock-price backtest, separate from actual household performance and the chat tool catalog. See strategy-engine.md for methods, scope and the next stages.
