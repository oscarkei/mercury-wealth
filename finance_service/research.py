"""Bounded OpenBB history tools and Riskfolio model-allocation calculations."""
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
import hashlib
import json
import math
import os
from pathlib import Path
import sqlite3
import threading
from typing import Literal
import uuid

from pydantic import BaseModel, ConfigDict, Field, model_validator

VERSION = 'mercury-research-1.0.0'
POOL = ThreadPoolExecutor(max_workers=3, thread_name_prefix='market-source')
CACHE = Path(os.environ.get('MERCURY_FINANCE_CACHE_DIR', str(Path(__file__).resolve().parents[1] / '.cache/finance'))) / 'research.sqlite'
DB_LOCK=threading.Lock()
SOURCE_LOCK=threading.Lock()
INITIALIZED=set()

def stamp():
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')

def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),allow_nan=False).encode()).hexdigest()

class HistoryRequest(BaseModel):
    model_config = ConfigDict(extra='forbid',allow_inf_nan=False)
    symbols: list[str] = Field(min_length=1,max_length=6)
    start_date: date | None = None
    end_date: date | None = None

    @model_validator(mode='after')
    def validate_query(self):
        import re
        if any(not re.fullmatch(r'[A-Z][A-Z0-9]{0,9}(?:[.-][A-Z])?',s) for s in self.symbols):
            raise ValueError('Use supported US stock or ETF tickers, not URLs or foreign listings.')
        if len(set(self.symbols))!=len(self.symbols):
            raise ValueError('Tickers must be unique.')
        today=date.today()
        self.end_date=self.end_date or today
        self.start_date=self.start_date or self.end_date-timedelta(days=365)
        if self.end_date>today or self.start_date>=self.end_date or (self.end_date-self.start_date).days>1096:
            raise ValueError('Use a historical window of at most three years, ending no later than today.')
        return self

class OptimizeRequest(HistoryRequest):
    objective: Literal['min_variance','min_cvar','risk_parity'] = 'min_variance'
    cash_pct: float = Field(default=10,ge=0,le=40)
    max_asset_pct: float = Field(default=60,ge=10,le=100)
    capital: float = Field(default=1000000,ge=1000,le=100000000)
    cost_bps: float = Field(default=10,ge=0,le=100)

    @model_validator(mode='after')
    def feasible(self):
        if len(self.symbols)<2 or self.max_asset_pct*len(self.symbols)<100-self.cash_pct-1e-8:
            raise ValueError('Use at least two assets and a feasible maximum weight for the invested allocation.')
        return self

def connection(path=None):
    p=Path(path) if path else CACHE
    p.parent.mkdir(parents=True,exist_ok=True)
    db=sqlite3.connect(p,timeout=5)
    with DB_LOCK:
        if str(p) not in INITIALIZED:
            db.execute('create table if not exists history_snapshots (id text primary key, query_key text not null, symbol text not null, retrieved_at text not null, payload text not null)')
            db.execute('create index if not exists history_query on history_snapshots(query_key,retrieved_at)')
            db.execute('create table if not exists analysis_runs (id text primary key, created_at text not null, request text not null, result text not null)')
            db.commit()
            INITIALIZED.add(str(p))
    return db

@lru_cache(maxsize=1)
def runtime():
    from openbb import obb
    obb.user.preferences.request_timeout=10
    root=CACHE.parent/'openbb'
    root.mkdir(parents=True,exist_ok=True)
    obb.user.preferences.cache_directory=str(root/'cache')
    obb.user.preferences.data_directory=str(root)
    obb.user.preferences.export_directory=str(root/'exports')
    if os.environ.get('FRED_API_KEY'):
        obb.user.credentials.fred_api_key=os.environ['FRED_API_KEY']
    return obb

def warm_runtime():
    runtime()
    import riskfolio
    return {'openbb_core':__import__('importlib.metadata',fromlist=['version']).version('openbb-core'),'riskfolio':riskfolio.__version__}

def normalize_history(symbol,frame,request):
    """Reject malformed dates/prices and retain provider price basis as unspecified."""
    rows=[]
    seen=set()
    for index,row in frame.iterrows():
        day=index.date() if hasattr(index,'date') else date.fromisoformat(str(index)[:10])
        if not request.start_date<=day<=request.end_date or day in seen:
            continue
        close=float(row['close'])
        if not math.isfinite(close) or close<=0:
            continue
        point={'date':day.isoformat(),'close':close}
        for key in ('open','high','low','volume'):
            val=row.get(key)
            point[key]=float(val) if val is not None and math.isfinite(float(val)) and float(val)>=0 else None
        seen.add(day);rows.append(point)
    rows.sort(key=lambda p:p['date'])
    if not rows or len(rows)>800:
        raise ValueError('The source returned no usable history, or too many observations.')
    item={'symbol':symbol,'provider':'OpenBB / Cboe','currency':'USD','basis':'provider_close_adjustment_unverified',
          'retrieved_at':stamp(),'points':rows,'first_date':rows[0]['date'],'last_date':rows[-1]['date'],
          'observations':len(rows),'price_change_pct':(rows[-1]['close']/rows[0]['close']-1)*100,
          'status':'observed','cache_hit':False,'stale':False}
    item['snapshot_id']=digest(item)
    return item

def one_history(symbol,request,fetcher=None,cache_path=None):
    key=digest({'symbol':symbol,'start':str(request.start_date),'end':str(request.end_date),'provider':'cboe','version':VERSION})
    with connection(cache_path) as db:
        cached=db.execute('select payload from history_snapshots where query_key=? order by retrieved_at desc limit 1',(key,)).fetchone()
    prior=json.loads(cached[0]) if cached else None
    if prior and (datetime.now(timezone.utc)-datetime.fromisoformat(prior['retrieved_at'].replace('Z','+00:00'))).total_seconds()<21600:
        return {**prior,'cache_hit':True}
    try:
        frame=(fetcher(symbol,request) if fetcher else runtime().cboe.equity.historical(symbol=symbol,start_date=request.start_date.isoformat(),end_date=request.end_date.isoformat(),interval='1d',provider='cboe').to_df())
        item=normalize_history(symbol,frame,request)
        with connection(cache_path) as db:
            db.execute('insert or ignore into history_snapshots values (?,?,?,?,?)',(item['snapshot_id'],key,symbol,item['retrieved_at'],json.dumps(item,allow_nan=False)))
        return item
    except Exception:
        if prior:return {**prior,'cache_hit':True,'stale':True}
        return {'symbol':symbol,'provider':'OpenBB / Cboe','currency':'USD','basis':'provider_close_adjustment_unverified',
                'retrieved_at':stamp(),'points':[],'first_date':None,'last_date':None,'observations':0,'price_change_pct':None,
                'snapshot_id':None,'status':'unavailable','cache_hit':False,'stale':False}

def market_history(request:HistoryRequest,fetcher=None,cache_path=None):
    if fetcher is None:
        runtime()
        # Cboe's SDK response cache belongs to one event loop. A single batched
        # SDK call avoids sharing that cache across separate thread event loops.
        batch_lock=threading.Lock()
        state={'ready':False,'failed':False,'frames':{}}
        def fetch_batch(symbol,query):
            with batch_lock:
                if not state['ready']:
                    state['ready']=True
                    try:
                        with SOURCE_LOCK:
                            frame=runtime().cboe.equity.historical(symbol=','.join(query.symbols),start_date=query.start_date.isoformat(),end_date=query.end_date.isoformat(),interval='1d',provider='cboe',timeout=10).to_df()
                        state['frames']={s:(frame[frame['symbol']==s].drop(columns='symbol') if 'symbol' in frame.columns else frame) for s in query.symbols}
                    except Exception:
                        state['failed']=True
                if state['failed']:raise ValueError('The public source batch is unavailable.')
                return state['frames'][symbol]
        fetcher=fetch_batch
    futures=[POOL.submit(one_history,s,request,fetcher,cache_path) for s in request.symbols]
    histories=[future.result() for future in futures]
    warnings=['Daily source closes; dividend/split adjustment is not verified. This is not a total-return series.',
              'Requested tickers are research assets. They are not the selected household holdings.']
    for item in histories:
        if item['status']=='unavailable':warnings.append(item['symbol']+': source unavailable; no sample prices substituted.')
        if item['stale']:warnings.append(item['symbol']+': refresh failed; the stored snapshot is explicitly stale.')
        if item['first_date'] and (date.fromisoformat(item['first_date'])-request.start_date).days>7:
            warnings.append(item['symbol']+': source does not cover the beginning of the requested window.')
        if item['last_date'] and (request.end_date-date.fromisoformat(item['last_date'])).days>7:
            warnings.append(item['symbol']+': source ends before the requested window; check the displayed last date.')
    return {'kind':'market_history','engine':VERSION,'requested':request.model_dump(mode='json'),
            'histories':histories,'warnings':warnings,'storage':'local_sqlite','retrieved_at':stamp(),
            'trace':[{'tool':'market_history','library':'OpenBB','provider':'Cboe','status':'completed' if all(h['status']=='observed' for h in histories) else 'partial'}]}

def optimize_from_history(request:OptimizeRequest,history):
    import numpy as np
    import pandas as pd
    import riskfolio as rp
    if any(h['status']!='observed' or h['stale'] for h in history['histories']):
        raise ValueError('Optimization requires fresh, usable history for every requested asset. Retry the missing sources.')
    prices=pd.DataFrame({h['symbol']:{p['date']:p['close'] for p in h['points']} for h in history['histories']}).sort_index().dropna()
    if len(prices)<90:
        raise ValueError('At least 90 common daily closes are required; incomplete history is not filled or invented.')
    returns=prices.pct_change().dropna()
    if (returns.abs()>0.5).any().any():
        raise ValueError('Large daily price discontinuities require verified corporate-action adjustments before optimization.')
    if np.isclose(returns.std().max(),0):raise ValueError('The selected prices have no measurable variation.')
    invested=1-request.cash_pct/100
    portfolio=rp.Portfolio(returns=returns)
    portfolio.assets_stats(method_mu='hist',method_cov='hist')
    portfolio.upperlng=min(1,request.max_asset_pct/100/invested)
    portfolio.alpha=.05
    portfolio.solvers=['CLARABEL']
    portfolio.sol_params={'CLARABEL':{'max_iter':200,'time_limit':8.0}}
    if request.objective=='risk_parity':
        output=portfolio.rp_optimization(model='Classic',rm='MV',hist=True)
    else:
        output=portfolio.optimization(model='Classic',rm='CVaR' if request.objective=='min_cvar' else 'MV',obj='MinRisk',hist=True)
    if output is None:raise ValueError('The optimizer did not find a feasible allocation for these settings.')
    raw=output.iloc[:,0].reindex(request.symbols).to_numpy(dtype=float)
    if not np.isfinite(raw).all() or (raw < -1e-7).any() or abs(raw.sum()-1)>1e-5:
        raise ValueError('The optimizer returned an invalid allocation.')
    target=np.maximum(raw,0);target=target/target.sum()*invested
    if (target>request.max_asset_pct/100+1e-5).any():
        raise ValueError('The optimizer could not satisfy the maximum asset weight. Relax it or choose another objective.')
    reference=np.repeat(invested/len(target),len(target))
    cov=returns.cov().to_numpy()*252
    variance=float(target@cov@target)
    contributions=target*(cov@target)/variance if variance>0 else np.zeros(len(target))
    ref_vol=float(np.sqrt(reference@cov@reference)*100)
    vol=float(np.sqrt(variance)*100)
    # Model rebalance only: solve the post-cost NAV, including the cash reserve.
    rate=request.cost_bps/10000
    current=reference*request.capital
    low,high=0.,request.capital
    for _ in range(60):
        mid=(low+high)/2
        if mid+rate*np.abs(target*mid-current).sum()>request.capital:high=mid
        else:low=mid
    post_nav=(low+high)/2
    changes=target*post_nav-current
    trades=[{'symbol':symbol,'reference_pct':float(reference[i]*100),'target_pct':float(target[i]*100),
             'change_pp':float((target[i]-reference[i])*100),'notional':float(abs(changes[i])),
             'side':'buy' if changes[i]>0 else 'sell' if changes[i]<0 else 'hold',
             'risk_contribution_pct':float(contributions[i]*100)} for i,symbol in enumerate(request.symbols)]
    cost=float(np.abs(changes).sum()*rate)
    if abs(post_nav+cost-request.capital)>1e-5:raise ValueError('Model trade costs did not reconcile.')
    return {'objective':request.objective,'library':'Riskfolio-Lib','version':rp.__version__,
            'solver':'CLARABEL','reference':'Equal-weight model, not actual account holdings',
            'rows':trades,'cash_pct':request.cash_pct,'capital':request.capital,'estimated_cost':cost,
            'post_cost_nav':post_nav,'reference_volatility_pct':ref_vol,'target_volatility_pct':vol,
            'observations':len(returns),'first_date':str(prices.index[0]),'last_date':str(prices.index[-1]),
            'method':'In-sample historical daily close returns; sample covariance; 252-day annualization; zero cash return.',
            'out_of_sample':False,'execution_ready':False,'suitability_status':'not_assessed'}

def optimize_allocation(request:OptimizeRequest,fetcher=None,cache_path=None):
    history=market_history(request,fetcher,cache_path)
    optimization=optimize_from_history(request,history)
    result={**history,'kind':'portfolio_optimization','optimization':optimization,
            'warnings':history['warnings']+['Risk estimates use the same historical sample used to fit weights; they are not forecasts or out-of-sample backtests.',
                'Changes are relative to an equal-weight model. Client IPS, full account holdings, tax and suitability have not been assessed.'],
            'trace':history['trace']+[{'tool':'optimize_allocation','library':'Riskfolio-Lib','provider':'local / CLARABEL','status':'completed'}],
            'run_id':str(uuid.uuid4())}
    with connection(cache_path) as db:
        db.execute('insert into analysis_runs values (?,?,?,?)',(result['run_id'],stamp(),json.dumps(request.model_dump(mode='json')),json.dumps(result,allow_nan=False)))
    return result

TOOL_CATALOG=[
    {'id':'market_history','library':'OpenBB','state':'chat_ready','description':'One to six US stocks/ETFs; daily historical closes, dates, provenance and stored snapshot recall.'},
    {'id':'optimize_allocation','library':'Riskfolio-Lib + OpenBB','state':'chat_ready','description':'Model allocation: minimum variance, minimum CVaR or risk parity; cash, weight limits, cost and risk contributions.'},
    {'id':'twr','library':'Decimal / Python','state':'workbench','description':'Verified supplied NAV and complete boundary cash flows. No automatic account reconstruction.'},
    {'id':'strategy_backtest','library':'bt + QuantStats','state':'workbench','description':'Mock fixture comparison of hold, calendar and band policies.'},
    {'id':'fundamental_metrics','library':'FinanceToolkit','state':'installed_not_chat_exposed','description':'Installed calculation library. No new fundamental-data provider is configured.'},
    {'id':'fred_macro','library':'OpenBB / FRED','state':'requires_key','description':'Connector installed; FRED key and selected macro tools are not connected to Chat yet.'},
    {'id':'ecb_data','library':'OpenBB / ECB','state':'installed_not_chat_exposed','description':'Connector installed; not selected by this Chat tool catalog yet.'},
]
