import test from 'node:test';
import assert from 'node:assert/strict';
import {iexHistory, IEX_PROVIDER} from '../iex-history.mjs';

const payload = (symbol, bars) => ({v: 1, symbol, coverage: 'ok', bars});
const bar = (day, close) => [day, close, close, close, close];
const today = '2026-11-26';
const window = {start_date: '2026-10-01', end_date: '2026-10-31'};

test('IEX limits results to requested sessions and isolates a missing ticker', async () => {
 const result = await iexHistory({...window, symbols: ['AAPL', 'SPY']}, today, async url => {
  if (url.endsWith('/SPY.json')) return {...payload('SPY', []), coverage: 'sparse'};
  assert.equal(url, 'https://vibistic-hq.github.io/vibistic-iex-data/v1/s/AAPL.json');
  return payload('AAPL', [bar(20260930, 90), bar(20261001, 100), bar(20261030, 105), bar(20261102, 120)]);
 });
 const [aapl, spy] = result.histories;
 assert.equal(aapl.provider, IEX_PROVIDER);
 assert.deepEqual(aapl.points, [{date: '2026-10-01', close: 100}, {date: '2026-10-30', close: 105}]);
 assert.match(aapl.snapshot_id, /^[a-f0-9]{64}$/);
 assert.equal(spy.status, 'unavailable');
 assert.equal(spy.observations, 0);
});

test('IEX rejects duplicate or invalid observations and future query windows', async () => {
 const {histories: [duplicate, badDate]} = await iexHistory({...window, symbols: ['AAPL','INTC']}, today, async url =>
  url.endsWith('/AAPL.json')
   ? payload('AAPL', [bar(20261001, 100), bar(20261001, 101)])
   : payload('INTC', [bar(20260931, 70)]));
 assert.equal(duplicate.status, 'unavailable');
 assert.equal(badDate.status, 'unavailable');
 await assert.rejects(iexHistory({symbols: ['AAPL'], ...window, end_date: '2026-11-27'}, today, () => assert.fail()), /historical window/);
});
