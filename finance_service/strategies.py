"""Fixed-target, next-observation rebalancing on an explicitly labelled price fixture."""
import hashlib
import json
from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

ENGINE_VERSION = 'mercury-strategies-1.0.0'
ASSETS = ('equity', 'bonds', 'gold')
NAMES = {'hold': 'Buy & hold', 'periodic': 'Calendar rebalance', 'band': 'Drift-band rebalance'}

class StrategyRequest(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    dataset: Literal['mercury-usd-mock-v1'] = 'mercury-usd-mock-v1'
    equity_pct: float = Field(default=55, ge=0, le=100)
    bonds_pct: float = Field(default=25, ge=0, le=100)
    gold_pct: float = Field(default=12, ge=0, le=100)
    minimum_cash_pct: float = Field(default=5, ge=0, le=50)
    drift_pp: float = Field(default=5, ge=0.25, le=25)
    frequency: Literal['monthly', 'quarterly'] = 'monthly'
    cost_bps: float = Field(default=10, ge=0, le=100)
    initial_capital: float = Field(default=1000000, ge=1000, le=100000000)
    start: date | None = None
    end: date | None = None

    @model_validator(mode='after')
    def validate_allocation(self):
        invested = self.equity_pct + self.bonds_pct + self.gold_pct
        if invested <= 0 or invested > 100 - self.minimum_cash_pct + 1e-9:
            raise ValueError('Asset targets must be positive in total and leave the minimum cash reserve.')
        if self.start and self.end and self.start >= self.end:
            raise ValueError('The end date must be after the start date.')
        return self

@lru_cache(maxsize=1)
def load_dataset():
    return json.loads((Path(__file__).parent / 'data/strategy-prices.json').read_text())

def compare_strategies(request: StrategyRequest, dataset=None):
    # Lazy loading keeps the decimal TWR endpoint lightweight.
    import bt
    import numpy as np
    import pandas as pd
    import quantstats as qs

    fixture = dataset if dataset is not None else load_dataset()
    rows = [row for row in fixture['rows'] if
            (request.start is None or row['date'] >= request.start.isoformat()) and
            (request.end is None or row['date'] <= request.end.isoformat())]
    if not 2 <= len(rows) <= 1000:
        raise ValueError('Choose a date range containing between 2 and 1,000 price observations.')
    dates = [row['date'] for row in rows]
    if dates != sorted(set(dates)):
        raise ValueError('Prices must have unique, increasing dates.')
    prices = pd.DataFrame([{a: row[a] for a in ASSETS} for row in rows], index=pd.to_datetime(dates))
    if not np.isfinite(prices.to_numpy()).all() or (prices <= 0).any().any():
        raise ValueError('Every selected asset requires a finite, positive price on every date.')
    weights = {a: getattr(request, a + '_pct') / 100 for a in ASSETS}
    weights['cash'] = 1 - sum(weights.values())
    rate = request.cost_bps / 10000

    class RebalancePolicy(bt.Algo):
        def __init__(self, mode):
            super().__init__()
            self.mode = mode
            self.pending = None
            self.started = False

        def __call__(self, target):
            i = prices.index.get_loc(target.now)
            records = target.perm.setdefault('records', [])
            events = target.perm.setdefault('events', [])
            reason = 'Initial allocation' if not self.started else (self.pending['reason'] if self.pending else None)
            if reason:
                signal_date = self.pending['date'] if self.pending else None
                before = float(target.value)
                current = {a: float(target.children[a].value) for a in ASSETS}
                # Solve post-fee NAV so targets and the cash reserve include fees.
                # NAV_after + rate * sum(|w * NAV_after - current_value|) = NAV_before.
                low, high = 0.0, before
                for _ in range(60):
                    mid = (low + high) / 2
                    cost = rate * sum(abs(weights[a] * mid - current[a]) for a in ASSETS)
                    if mid + cost > before: high = mid
                    else: low = mid
                after = (low + high) / 2
                trades = []
                for a in ASSETS:
                    notional = weights[a] * after - current[a]
                    if abs(notional) > before * 1e-12:
                        trades.append({'asset': a, 'side': 'buy' if notional > 0 else 'sell',
                                       'notional': abs(notional), 'quantity': notional / float(prices.iloc[i][a])})
                for trade in sorted(trades, key=lambda t: t['side'] == 'buy'):
                    target.transact(trade['quantity'], child=trade['asset'])
                target.root.update(target.now)
                fee = rate * sum(t['notional'] for t in trades)
                if abs(target.value - (before - fee)) > max(1e-5, before * 1e-9):
                    raise ValueError('The trade ledger failed the NAV/cost reconciliation.')
                events.append({'signal_date': signal_date, 'execution_date': dates[i], 'reason': reason,
                               'cost': fee, 'traded_notional': sum(t['notional'] for t in trades),
                               'turnover': sum(t['notional'] for t in trades) / before,
                               'nav_before': before, 'nav_after': float(target.value), 'trades': trades})
                self.pending = None
                self.started = True
            nav = float(target.value)
            actual = {a: float(target.children[a].value) / nav for a in ASSETS}
            actual['cash'] = float(target.capital) / nav
            drift = max(abs(actual[a] - weights[a]) * 100 for a in (*ASSETS, 'cash'))
            records.append({'date': dates[i], 'nav': nav, 'index': nav / request.initial_capital * 100,
                            'weights': actual, 'max_drift_pp': drift,
                            'cash_floor_breach': actual['cash'] * 100 < request.minimum_cash_pct - 1e-7})
            # Evaluate only information at this close; execute at the next supplied close.
            # Calendar signals use a change of calendar month/quarter since the prior bar.
            period_changed = False
            if i:
                now, previous = prices.index[i], prices.index[i-1]
                period_changed = ((now.year, now.month) != (previous.year, previous.month)
                                  if request.frequency == 'monthly' else
                                  (now.year, now.quarter) != (previous.year, previous.quarter))
            if self.mode == 'periodic' and period_changed:
                self.pending = {'date': dates[i], 'reason': request.frequency.title() + ' calendar signal'}
            if self.mode == 'band' and (drift >= request.drift_pp or records[-1]['cash_floor_breach']):
                self.pending = {'date': dates[i], 'reason': 'Cash reserve below floor' if records[-1]['cash_floor_breach'] else 'Allocation drift reached band'}
            target.perm['pending'] = self.pending
            return True

    results = []
    for mode in NAMES:
        strategy = bt.Strategy(mode, [RebalancePolicy(mode)], children=[bt.Security(a) for a in ASSETS])
        test = bt.Backtest(strategy, prices, initial_capital=request.initial_capital,
                           commissions=lambda q, p: abs(q * p) * rate,
                           integer_positions=False, progress_bar=False)
        test.run()
        records, events = test.strategy.perm['records'], test.strategy.perm['events']
        navs = pd.Series([request.initial_capital] + [r['nav'] for r in records], dtype=float)
        returns = pd.Series(navs.pct_change().iloc[1:].to_numpy(), index=prices.index)
        # Drawdown includes the starting capital and initial allocation cost.
        drawdown = float(qs.stats.max_drawdown(returns))
        results.append({'id': mode, 'name': NAMES[mode], 'total_return_pct': (records[-1]['nav'] / request.initial_capital - 1) * 100,
                        'max_drawdown_pct': drawdown * 100, 'ending_nav': records[-1]['nav'],
                        'total_cost': sum(e['cost'] for e in events),
                        'cumulative_traded_notional_over_initial': sum(e['traded_notional'] for e in events) / request.initial_capital,
                        'rebalance_count': len(events) - 1, 'cash_floor_breach_observations': sum(r['cash_floor_breach'] for r in records),
                        'ending_weights': records[-1]['weights'], 'series': records, 'events': events,
                        'pending_signal': test.strategy.perm.get('pending')})
    serialized = json.dumps({'request': request.model_dump(mode='json'), 'rows': rows}, sort_keys=True, separators=(',', ':'))
    return {'engine': ENGINE_VERSION, 'libraries': {'bt': bt.__version__, 'quantstats': qs.__version__},
            'input_sha256': hashlib.sha256(serialized.encode()).hexdigest(), 'parameters': request.model_dump(mode='json'),
            'dataset': {k: v for k, v in fixture.items() if k != 'rows'}, 'date_range': {'start': dates[0], 'end': dates[-1], 'observations': len(rows)},
            'target_weights': weights, 'strategies': results, 'execution_ready': False, 'suitability_status': 'not_assessed',
            'assumptions': ['Mock price returns in USD; dividends, interest, tax, FX and corporate actions are excluded.',
                            'Fractional units; no leverage, short positions or external cash flows. Cash earns zero.',
                            'The same initial allocation cost is included in every strategy. Costs apply to buys and sells.',
                            'Signals use the current close and execute at the next supplied close; final pending signals are not executed.',
                            'Calendar signals occur on the first observed date of a new month or quarter, then execute one observation later.',
                            'Cash floor is a target-time constraint and monitored daily; market moves can cause breaches between rebalances.',
                            'Proxy allocations are not security-level IPS or suitability approval. Results are simulations, not family account performance.']}
