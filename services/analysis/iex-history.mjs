import {createHash} from 'node:crypto';

export const IEX_PROVIDER = 'Vibistic / IEX HIST';
export const IEX_TERMS_URL = 'https://www.iex.io/legal/hist-data-terms';
const FILES = 'https://vibistic-hq.github.io/vibistic-iex-data/v1/s/';
const BASIS = 'iex_regular_session_split_adjusted';
const DAY_MS = 86_400_000;

function validDay(value) {
 const date = new Date(value + 'T00:00:00Z');
 return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function iexHistory(query, today, load) {
 const {symbols, start_date: start, end_date: end} = query;
 if (new Set(symbols).size !== symbols.length) throw Error('Tickers must be unique.');
 if (!validDay(start) || !validDay(end) || end > today || start >= end || Date.parse(end) - Date.parse(start) > 1096 * DAY_MS) {
  throw Error('Use an ordered historical window of at most three years, ending no later than today.');
 }

 const retrieved_at = new Date().toISOString();
 const histories = await Promise.all(symbols.map(async symbol => {
  const meta = {symbol, provider: IEX_PROVIDER, currency: 'USD', basis: BASIS, retrieved_at, stale: false};
  try {
   const data = await load(FILES + encodeURIComponent(symbol) + '.json');
   if (data?.v !== 1 || data.symbol !== symbol || data.coverage !== 'ok' || !Array.isArray(data.bars)) {
    throw Error('Missing or insufficient IEX coverage.');
   }

   const points = [];
   let previousDate = '';
   for (const [session, , , , close] of data.bars) {
    const raw = String(session);
    const date = raw.slice(0, 4) + '-' + raw.slice(4, 6) + '-' + raw.slice(6);
    if (!/^\d{8}$/.test(raw) || !validDay(date) || date <= previousDate || !Number.isFinite(close) || close <= 0) {
     throw Error('Invalid IEX bar order, date or price.');
    }
    previousDate = date;
    if (date >= start && date <= end) points.push({date, close});
   }
   if (!points.length) throw Error('No IEX trades for the requested dates.');
   const first = points[0], last = points.at(-1);
   const snapshot_id = createHash('sha256').update(JSON.stringify([symbol, BASIS, points])).digest('hex');
   return {...meta, status: 'observed', points, observations: points.length, first_date: first.date, last_date: last.date,
    price_change_pct: (last.close / first.close - 1) * 100, snapshot_id};
  } catch (error) {
   return {...meta, status: 'unavailable', points: [], observations: 0, first_date: null, last_date: null,
    price_change_pct: null, snapshot_id: null, warning: error instanceof Error ? error.message : 'IEX source unavailable.'};
  }
 }));
 const warnings = [
  'IEX-only regular-session reference prices. As published, prices are split-adjusted and exclude dividends. These are not official consolidated market closes.',
  ...histories.filter(history => history.status === 'unavailable').map(history => history.symbol + ': ' + history.warning),
 ];
 return {histories, requested: query, warnings};
}
