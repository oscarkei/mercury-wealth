"""Isolated, allowlisted bridge to the project's existing calculation libraries."""
import sys, os, json, math, contextlib
from pathlib import Path
ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parents[1]
CACHE=ROOT/'data/finance-cache';CACHE.mkdir(parents=True,exist_ok=True)
for name in ('OPENBLAS_NUM_THREADS','VECLIB_MAXIMUM_THREADS','OMP_NUM_THREADS'):os.environ[name]='1'
os.environ.update(MPLBACKEND='Agg',MPLCONFIGDIR=str(CACHE/'matplotlib'),NUMBA_CACHE_DIR=str(CACHE/'numba'),FINANCE_TOOLKIT_CACHE_ENABLED='0',FINANCE_TOOLKIT_CACHE_DB=str(CACHE/'toolkit.sqlite'))
sys.path.insert(0,str(PROJECT))
from finance_service import research as engine
from finance_service.strategies import StrategyRequest,compare_strategies
engine.CACHE=CACHE/'research.sqlite'

def execute(name,args):
    if name=='history':return engine.market_history(engine.HistoryRequest(**args))
    if name=='optimize':
        history=args.pop('history')
        query=engine.OptimizeRequest(symbols=[h['symbol'] for h in history['histories']],**args)
        return engine.optimize_from_history(query,history)
    if name=='backtest':
        history=args.pop('history',None)
        dataset=None
        if history:
            import pandas as pd
            if any(h['stale'] or h['status']!='observed' for h in history['histories']):raise ValueError('Fresh observed prices are required.')
            if len(history['histories'])!=3:raise ValueError('This strategy comparison requires exactly three tickers.')
            p=pd.DataFrame({h['symbol']:{r['date']:r['close'] for r in h['points']} for h in history['histories']}).sort_index().dropna()
            if len(p)<20:raise ValueError('At least 20 common observations are required.')
            if (p.pct_change().abs()>0.5).any().any():raise ValueError('Price discontinuities require verified corporate-action adjustments.')
            dataset={'id':'observed-cboe-price-simulation','label':'Observed Cboe closes; hypothetical allocation, not a client account','assets':dict(zip(('equity','bonds','gold'),p.columns)), 'rows':[dict(date=d,**dict(zip(('equity','bonds','gold'),row))) for d,row in p.iterrows()]}
        out=compare_strategies(StrategyRequest(**args),dataset)
        if history:
            out['parameters']['dataset']='observed-cboe-price-simulation'
            out['assumptions'][0]='Observed provider close prices; split/dividend adjustments unverified. Price-only hypothetical backtest, not total return or client performance. Interest, tax and FX excluded.'
            out['input_histories']=[{'symbol':h['symbol'],'snapshot_id':h['snapshot_id']} for h in history['histories']]
        return out
    if name=='metrics':
        import numpy as np,pandas as pd,quantstats as qs
        from financetoolkit.performance import performance_model as perf
        from financetoolkit.risk import risk_model as risk
        history=args['history'];rows=[]
        for h in history['histories']:
            if h['status']!='observed' or h['stale']:raise ValueError('Fresh observed prices are required.')
            p=pd.Series([r['close'] for r in h['points']],index=pd.to_datetime([r['date'] for r in h['points']]))
            if len(p)<20:raise ValueError('At least 20 price observations are required.')
            if (p.pct_change().abs()>0.5).any():raise ValueError('Corporate-action adjustment requires verification.')
            r=p.pct_change().fillna(0);groups=np.zeros(len(r),dtype=int)
            values={'return_pct':float(perf.get_returns(r,'yearly',groups=groups).iloc[0])*100,'max_drawdown_pct':float(risk.get_max_drawdown(r))*100,'volatility_pct':float(risk.get_volatility(r,'yearly',groups=groups).iloc[0])*100,'sharpe':float(perf.get_sharpe_ratio(r)*np.sqrt(252)) if r.std()>0 else None}
            expected=[qs.stats.comp(r)*100,qs.stats.max_drawdown(r)*100,qs.stats.volatility(r,periods=252)*100,qs.stats.sharpe(r,rf=0,periods=252) if r.std()>0 else None]
            for value,other in zip(values.values(),expected):
                if value is not None and not math.isclose(value,float(other),rel_tol=1e-8,abs_tol=1e-8):raise ValueError('FinanceToolkit/QuantStats cross-check failed.')
            rows.append(dict(symbol=h['symbol'],start=h['first_date'],end=h['last_date'],observations=len(r),**values))
        return {'library':'FinanceToolkit + QuantStats','rows':rows,'assumptions':['Price returns; corporate-action adjustment unverified; no total-return claim.','252-day annualization, risk-free rate zero; first return zero to include initial NAV in drawdown.','Historical statistics, not a forward forecast.']}
    raise ValueError('Unsupported calculation.')

print(json.dumps({'type':'ready','bridge':'existing-finance-libraries','isolated_cache':True}),flush=True)
for line in sys.stdin:
    request={}
    try:
        request=json.loads(line)
        with contextlib.redirect_stdout(sys.stderr):result=execute(request['name'],request['args'])
        print(json.dumps({'id':request['id'],'result':result},allow_nan=False),flush=True)
    except Exception as error:
        print(json.dumps({'id':request.get('id'),'error':str(error)[:800]}),flush=True)
