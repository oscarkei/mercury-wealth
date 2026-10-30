from datetime import date,timedelta
from pathlib import Path
import json
import sqlite3
import sys
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace
import numpy as np
import pandas as pd
from pydantic import ValidationError
from fastapi.testclient import TestClient

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from finance_service.research import HistoryRequest,OptimizeRequest,market_history,optimize_allocation,optimize_from_history,normalize_history
from finance_service.api import create_app

class ResearchTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.cache=Path(self.temp.name)/'history.sqlite'
        self.dates=pd.bdate_range('2025-01-02',periods=180)
        rng=np.random.default_rng(7)
        self.prices={s:100*np.exp(np.cumsum(rng.normal(.0002,sigma,len(self.dates)))) for s,sigma in [('AAA',.008),('BBB',.012),('CCC',.017)]}
        self.calls=[]

    def tearDown(self):self.temp.cleanup()

    def fetch(self,symbol,request):
        self.calls.append(symbol)
        return pd.DataFrame({'close':self.prices[symbol],'open':self.prices[symbol],'high':self.prices[symbol],'low':self.prices[symbol],'volume':1000},index=self.dates)

    def config(self,**kw):
        return dict(symbols=['AAA','BBB','CCC'],start_date='2025-01-01',end_date='2025-12-31',**kw)

    def test_history_provenance_and_recall_do_not_refetch(self):
        request=HistoryRequest(**self.config());a=market_history(request,self.fetch,self.cache);b=market_history(request,self.fetch,self.cache)
        self.assertEqual(len(self.calls),3)
        for x,y in zip(a['histories'],b['histories']):
            self.assertEqual(x['points'],y['points']);self.assertEqual(x['snapshot_id'],y['snapshot_id']);self.assertTrue(y['cache_hit']);self.assertEqual(x['provider'],'OpenBB / Cboe')
        self.assertEqual(a['storage'],'local_sqlite')

    def test_native_openbb_uses_one_batch_call_for_all_symbols(self):
        calls=[]
        def historical(**kw):
            calls.append(kw)
            frames=[]
            for s in kw['symbol'].split(','):
                frame=self.fetch(s,None).copy();frame['symbol']=s;frames.append(frame)
            return SimpleNamespace(to_df=lambda:pd.concat(frames))
        sdk=SimpleNamespace(cboe=SimpleNamespace(equity=SimpleNamespace(historical=historical)))
        with patch('finance_service.research.runtime',return_value=sdk):
            result=market_history(HistoryRequest(**self.config()),cache_path=self.cache)
        self.assertEqual(len(calls),1);self.assertEqual(calls[0]['symbol'],'AAA,BBB,CCC')
        self.assertTrue(all(h['status']=='observed' for h in result['histories']))

    def test_source_failures_never_substitute_fixtures(self):
        def fail(s,r):raise RuntimeError('secret-upstream-information')
        result=market_history(HistoryRequest(**self.config()),fail,self.cache)
        self.assertTrue(all(h['status']=='unavailable' and not h['points'] for h in result['histories']))
        self.assertNotIn('secret-upstream-information',json.dumps(result))

    def test_expired_snapshot_is_marked_stale_after_refresh_failure(self):
        request=HistoryRequest(**self.config());result=market_history(request,self.fetch,self.cache)
        with sqlite3.connect(self.cache) as db:
            for h in result['histories']:
                h['retrieved_at']='2000-01-01T00:00:00Z';db.execute('update history_snapshots set payload=? where id=?',(json.dumps(h),h['snapshot_id']))
        def fail(s,r):raise RuntimeError()
        stale=market_history(request,fail,self.cache)
        self.assertTrue(all(h['stale'] for h in stale['histories']))
        with self.assertRaises(ValueError):optimize_from_history(OptimizeRequest(**self.config()),stale)

    def test_normalization_ignores_future_and_invalid_prices(self):
        request=HistoryRequest(symbols=['AAA'],start_date='2025-01-01',end_date='2025-02-01')
        frame=pd.DataFrame({'close':[100,float('nan'),-1,110,999]},index=pd.to_datetime(['2025-01-02','2025-01-03','2025-01-06','2025-01-07','2099-01-01']))
        result=normalize_history('AAA',frame,request)
        self.assertEqual(result['observations'],2);self.assertAlmostEqual(result['price_change_pct'],10)

    def test_invalid_symbols_unknown_fields_dates_and_infeasible_limits(self):
        for body in [dict(symbols=['https://bad.example']),dict(symbols=['AAA','AAA']),dict(symbols=['0700.HK']),dict(symbols=['AAA'],end_date='2099-01-01'),dict(symbols=['AAA'],source_url='https://bad.example')]:
            with self.subTest(body=body),self.assertRaises(ValidationError):HistoryRequest(**body)
        with self.assertRaises(ValidationError):OptimizeRequest(symbols=['AAA','BBB'],max_asset_pct=20,cash_pct=10)

    def test_min_variance_constraints_risk_and_costs_reconcile(self):
        request=OptimizeRequest(**self.config(),cash_pct=10,max_asset_pct=50,capital=1000000,cost_bps=10)
        result=optimize_allocation(request,self.fetch,self.cache);opt=result['optimization'];weights=np.array([r['target_pct']/100 for r in opt['rows']])
        self.assertAlmostEqual(weights.sum(),.9);self.assertTrue((weights<=.5+1e-6).all())
        self.assertAlmostEqual(sum(r['risk_contribution_pct'] for r in opt['rows']),100,places=5)
        returns=pd.DataFrame(self.prices,index=self.dates).pct_change().dropna();cov=returns.cov().to_numpy()*252
        self.assertAlmostEqual(opt['target_volatility_pct'],float(np.sqrt(weights@cov@weights))*100,places=8)
        self.assertLessEqual(opt['target_volatility_pct'],opt['reference_volatility_pct']+1e-5)
        self.assertAlmostEqual(opt['estimated_cost'],sum(r['notional'] for r in opt['rows'])*.001,places=6)
        self.assertAlmostEqual(opt['post_cost_nav']+opt['estimated_cost'],request.capital,places=5)
        self.assertFalse(opt['out_of_sample']);self.assertFalse(opt['execution_ready']);self.assertEqual(opt['suitability_status'],'not_assessed')
        with sqlite3.connect(self.cache) as db:self.assertEqual(db.execute('select count(*) from analysis_runs').fetchone()[0],1)

    def test_cvar_and_risk_parity_use_the_requested_objective(self):
        for objective in ['min_cvar','risk_parity']:
            with self.subTest(objective=objective):
                result=optimize_allocation(OptimizeRequest(**self.config(),objective=objective,max_asset_pct=90),self.fetch,self.cache)
                self.assertEqual(result['optimization']['objective'],objective)
                self.assertAlmostEqual(sum(r['target_pct'] for r in result['optimization']['rows']),90)

    def test_insufficient_common_history_blocks_optimization(self):
        request=OptimizeRequest(**self.config());history=market_history(request,self.fetch,self.cache)
        history['histories'][0]['points']=history['histories'][0]['points'][:20]
        with self.assertRaises(ValueError):optimize_from_history(request,history)

    def test_large_price_discontinuities_require_adjustment_review(self):
        request=OptimizeRequest(**self.config());history=market_history(request,self.fetch,self.cache)
        history['histories'][0]['points'][10]['close']*=10
        with self.assertRaisesRegex(ValueError,'corporate-action'):optimize_from_history(request,history)

    def test_catalog_and_history_require_private_authentication(self):
        key='synthetic-research-test-key-0000000000000000';client=TestClient(create_app(key),base_url='http://127.0.0.1')
        self.assertEqual(client.post('/v1/tools/catalog',json={}).status_code,401)
        response=client.post('/v1/tools/catalog',json={},headers={'Authorization':'Bearer '+key})
        self.assertEqual(response.status_code,200);self.assertTrue(any(t['id']=='optimize_allocation' for t in response.json()['tools']))
        self.assertEqual(client.post('/v1/market/history',json={'symbols':['https://bad.example']},headers={'Authorization':'Bearer '+key}).status_code,422)

if __name__=='__main__':unittest.main()
