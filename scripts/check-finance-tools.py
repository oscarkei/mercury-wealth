"""Offline installation/calculation check; no cloud writes or live market fetches."""
import os
from pathlib import Path

PROJECT = Path(__file__).resolve().parent.parent
WORKSPACE = PROJECT.parent.parent
CACHE = WORKSPACE / 'work/finance-cache'
CACHE.mkdir(parents=True, exist_ok=True)
for setting in ('OPENBLAS_NUM_THREADS', 'VECLIB_MAXIMUM_THREADS', 'OMP_NUM_THREADS'):
    os.environ[setting] = '1'
os.environ['MPLBACKEND'] = 'Agg'
os.environ['MPLCONFIGDIR'] = str(CACHE / 'matplotlib')
os.environ['FINANCE_TOOLKIT_CACHE_ENABLED'] = '0'
os.environ['FINANCE_TOOLKIT_CACHE_DB'] = str(CACHE / 'toolkit.sqlite')

import importlib.metadata
import json
import math
import platform
import resource
import socket
import sys
import time
import warnings
from datetime import datetime, timezone

started = time.perf_counter()
cpu_started = time.process_time()
# All fixtures are local. Fail if a calculation attempts to contact an API.
network_attempts = []
original_connect = socket.socket.connect

def reject_connect(self, address):
    network_attempts.append(str(address))
    raise RuntimeError('Network access is disabled during the offline finance check.')

socket.socket.connect = reject_connect

def near(actual, expected):
    assert math.isclose(float(actual), float(expected), rel_tol=1e-10, abs_tol=1e-10), (actual, expected)

def main():
    import numpy as np
    import pandas as pd
    import quantstats as qs
    from financetoolkit import Toolkit
    from financetoolkit.performance import performance_model as ft_performance
    from financetoolkit.risk import risk_model as ft_risk

    checks = []
    # Fixed example: 100 -> 110 -> 88 -> 96.8 -> 101.64.
    prices = pd.Series([100.,110.,88.,96.8,101.64], index=pd.bdate_range('2026-01-05', periods=5))
    returns = prices.pct_change().fillna(0)
    manual_return = 101.64 / 100 - 1
    manual_drawdown = 88 / 110 - 1
    manual_sharpe = returns.mean() / returns.std(ddof=1) * np.sqrt(252)
    near(qs.stats.comp(returns), manual_return)
    near(ft_performance.get_returns(returns.to_period('D'), period='yearly').iloc[0], manual_return)
    near(qs.stats.max_drawdown(returns), manual_drawdown)
    near(ft_risk.get_max_drawdown(returns), manual_drawdown)
    near(qs.stats.sharpe(returns, rf=0, periods=252), manual_sharpe)
    near(ft_performance.get_sharpe_ratio(returns) * np.sqrt(252), manual_sharpe)
    checks.append({'name':'Known path: compounded return, max drawdown and annualized Sharpe match manual formulas in both libraries','passed':True})

    source_path = WORKSPACE / 'outputs/Mercury Vercel Source Data.json'
    with source_path.open() as handle:
        source = json.load(handle)
    rows = source['datasets']['prices']
    close_rows = [(r['date'],r['instrumentId'],r['close']['amount']) for r in rows]
    del source, rows
    frame = pd.DataFrame(close_rows, columns=['date','instrument','close']).pivot(index='date',columns='instrument',values='close').sort_index()
    del close_rows
    frame.index = pd.to_datetime(frame.index)
    assert frame.shape == (750,69)
    assert not frame.isna().any().any()
    daily = frame.pct_change().fillna(0)
    with np.errstate(divide='ignore', invalid='ignore'):
        qs_sharpe = qs.stats.sharpe(daily,rf=0,periods=252)
        ft_sharpe = ft_performance.get_sharpe_ratio(daily)*np.sqrt(252)
    np.testing.assert_allclose(qs_sharpe.to_numpy(),ft_sharpe.to_numpy(),rtol=1e-10,atol=1e-10,equal_nan=True)
    qs_dd = qs.stats.max_drawdown(daily)
    ft_dd = ft_risk.get_max_drawdown(daily)
    np.testing.assert_allclose(qs_dd.to_numpy(),ft_dd.to_numpy(),rtol=1e-10,atol=1e-10)
    group = np.zeros(len(daily),dtype=int)
    ft_return = ft_performance.get_returns(daily,'yearly',groups=group).iloc[0]
    qs_return = qs.stats.comp(daily)
    np.testing.assert_allclose(qs_return.to_numpy(),ft_return.to_numpy(),rtol=1e-10,atol=1e-10)
    ft_vol = ft_risk.get_volatility(daily,'yearly',groups=group).iloc[0]
    qs_vol = qs.stats.volatility(daily,periods=252)
    np.testing.assert_allclose(qs_vol.to_numpy(),ft_vol.to_numpy(),rtol=1e-10,atol=1e-10)
    constant_series = int((daily.std(ddof=1)==0).sum())
    checks.append({'name':'69 instruments x 750 dates: compounded returns, Sharpe, volatility and max drawdown agree across both libraries','passed':True,'constantSeriesWithUndefinedSharpe':constant_series})

    # Exercise the installed plotting stack with a small exported local chart.
    import matplotlib.pyplot as plt
    fig,ax=plt.subplots(figsize=(5.5,2.6))
    ax.plot(prices.index,prices.values,color='#225a4c');ax.set_title('Installation check: synthetic price path');ax.set_ylabel('Synthetic index level');ax.grid(alpha=.2);fig.autofmt_xdate();fig.tight_layout()
    fig.savefig(CACHE/'smoke-chart.png',dpi=100);plt.close(fig)
    assert (CACHE/'smoke-chart.png').stat().st_size>1000
    checks.append({'name':'Matplotlib report/plot dependency creates a chart offline','passed':True})
    assert not network_attempts
    checks.append({'name':'No network access or API key needed for supplied-data calculations','passed':True})

    peak=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    peak_bytes=int(peak if sys.platform=='darwin' else peak*1024)
    report={
        'passed':True,'checkedAt':datetime.now(timezone.utc).isoformat(),
        'python':platform.python_version(),'architecture':platform.machine(),
        'versions':{name:importlib.metadata.version(name) for name in ['quantstats','financetoolkit','numpy','pandas','scipy','matplotlib']},
        'checks':checks,
        'sample':{'compoundedReturn':float(manual_return),'maxDrawdown':float(manual_drawdown),'annualizedSharpe':float(manual_sharpe)},
        'dataset':{'priceRows':51750,'instruments':69,'datesPerInstrument':750,'dataMode':'mock','firstObservationReturn':0},
        'resources':{'peakProcessRssBytes':peak_bytes,'wallSeconds':round(time.perf_counter()-started,3),'processCpuSeconds':round(time.process_time()-cpu_started,3),'blasThreadLimit':1,'includesImportsAndJsonLoading':True},
        'scope':['Installed libraries and calculation compatibility verified.','Per-instrument local-currency price returns only; this is not a cashflow/fee-adjusted portfolio TWR/MWR engine.','No new API service, Portal integration or Supabase performance writes are included in this installation check.','Peak RSS is for this single test process; it is not a guarantee for all workloads.']
    }
    output=WORKSPACE/'outputs/Mercury Finance Tools Verification.json'
    output.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report))

if __name__=='__main__':
    try:
        main()
    finally:
        socket.socket.connect=original_connect
