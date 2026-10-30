import copy
from pathlib import Path
import sys
import unittest
from pydantic import ValidationError
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from finance_service.strategies import StrategyRequest,compare_strategies
from finance_service.api import create_app

def fixture(equity=(100, 200, 300, 250), dates=None):
    dates = dates or ['2026-01-29','2026-01-30','2026-02-02','2026-02-03'][:len(equity)]
    return {'id':'test','mode':'mock','currency':'USD','assets':[],
            'rows':[{'date':d,'equity':p,'bonds':100,'gold':100} for d,p in zip(dates,equity)]}

def compare(data=None, **params):
    config = dict(equity_pct=50,bonds_pct=40,gold_pct=0,minimum_cash_pct=5,cost_bps=0,drift_pp=5,initial_capital=100000)
    config.update(params)
    return compare_strategies(StrategyRequest(**config), data or fixture())

class StrategyTests(unittest.TestCase):
    def test_buy_hold_matches_hand_calculation(self):
        result = compare(fixture((100,110)))['strategies'][0]
        self.assertAlmostEqual(result['total_return_pct'],5)
        self.assertAlmostEqual(result['ending_nav'],105000)
        self.assertEqual(result['rebalance_count'],0)

    def test_initial_fee_is_included_and_cash_target_accounts_for_it(self):
        result = compare(fixture((100,100)),cost_bps=10)['strategies'][0]
        expected_nav = 100000/(1+0.001*0.9)
        self.assertAlmostEqual(result['ending_nav'],expected_nav,places=6)
        self.assertAlmostEqual(result['total_cost'],100000-expected_nav,places=6)
        self.assertAlmostEqual(result['ending_weights']['cash'],0.1)
        self.assertLess(result['series'][0]['index'],100)
        self.assertAlmostEqual(result['max_drawdown_pct'],result['total_return_pct'])

    def test_signal_executes_on_next_bar_and_not_signal_close(self):
        result = compare()['strategies'][2]
        event = result['events'][1]
        self.assertEqual(event['signal_date'],'2026-01-30')
        self.assertEqual(event['execution_date'],'2026-02-02')
        equity_trade = next(t for t in event['trades'] if t['asset']=='equity')
        self.assertAlmostEqual(abs(equity_trade['notional']/equity_trade['quantity']),300)

    def test_calendar_signal_uses_observed_new_month_then_one_bar_delay(self):
        result = compare()['strategies'][1]
        self.assertEqual(result['events'][1]['signal_date'],'2026-02-02')
        self.assertEqual(result['events'][1]['execution_date'],'2026-02-03')

    def test_final_signal_remains_unexecuted(self):
        result = compare(fixture((100,200)))['strategies'][2]
        self.assertEqual(result['rebalance_count'],0)
        self.assertEqual(result['pending_signal']['date'],'2026-01-30')

    def test_future_prices_do_not_change_past_signals_or_trades(self):
        a = compare()['strategies'][2]
        b = compare(fixture((100,200,300,900)))['strategies'][2]
        self.assertEqual(a['events'][:2],b['events'][:2])
        self.assertEqual(a['series'][:3],b['series'][:3])

    def test_costs_reconcile_and_no_leverage_after_rebalances(self):
        result = compare(cost_bps=100)
        for strategy in result['strategies']:
            for event in strategy['events']:
                self.assertAlmostEqual(event['nav_before']-event['nav_after'],event['cost'],places=6)
                self.assertAlmostEqual(event['cost'],event['traded_notional']*0.01,places=6)
            for row in strategy['series']:
                self.assertTrue(all(w>=-1e-9 for w in row['weights'].values()))
                self.assertAlmostEqual(sum(row['weights'].values()),1)

    def test_drawdown_matches_manual_peak_to_trough(self):
        result = compare(fixture((100,200,100,50)))['strategies'][0]
        self.assertAlmostEqual(result['max_drawdown_pct'],-50)

    def test_constant_prices_zero_cost_produce_equal_results(self):
        result = compare(fixture((100,100,100,100)))
        self.assertTrue(all(abs(s['total_return_pct'])<1e-9 for s in result['strategies']))

    def test_cash_floor_breach_triggers_band_before_drift_threshold(self):
        result = compare(fixture((100,200,300)),minimum_cash_pct=9,drift_pp=25)['strategies'][2]
        self.assertEqual(result['events'][1]['reason'],'Cash reserve below floor')
        self.assertGreater(result['cash_floor_breach_observations'],0)
        self.assertAlmostEqual(result['ending_weights']['cash'],0.1)

    def test_invalid_targets_dates_fees_and_nonfinite_rejected(self):
        for params in [dict(equity_pct=95),dict(cost_bps=-1),dict(drift_pp=0),dict(equity_pct=float('nan')),dict(start='2026-02-01',end='2026-01-01'),dict(arbitrary_code='x')]:
            with self.subTest(params=params),self.assertRaises(ValidationError): compare(**params)

    def test_missing_bad_duplicate_prices_and_empty_window_rejected(self):
        for data in [fixture((100,float('nan'))),fixture((100,0)),fixture((100,100),['2026-01-01','2026-01-01'])]:
            with self.assertRaises(ValueError): compare(data)
        with self.assertRaises(ValueError): compare(start='2027-01-01')

    def test_versioned_output_is_reproducible_and_not_execution_ready(self):
        a,b=compare(),compare()
        self.assertEqual(a,b)
        self.assertFalse(a['execution_ready'])
        self.assertEqual(a['suitability_status'],'not_assessed')

    def test_private_api_and_unknown_input(self):
        client=TestClient(create_app('synthetic-strategy-test-key-0000000000000000'),base_url='http://127.0.0.1')
        self.assertEqual(client.post('/v1/strategy/backtest',json={}).status_code,401)
        response=client.post('/v1/strategy/backtest',json={'dataset':'external-secret-path'},headers={'Authorization':'Bearer synthetic-strategy-test-key-0000000000000000'})
        self.assertEqual(response.status_code,422)
        self.assertIn('strategy_backtest',client.get('/health').json()['capabilities'])

if __name__=='__main__':unittest.main()
