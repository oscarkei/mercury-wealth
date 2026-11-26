import {createHash} from 'node:crypto';
import {activeResults} from './conversation-policy.mjs';

const digest = '2d1c5d7a87d3b3a2e9f4ba9f606edd228f4d3e98e9fd7dddcd6f098d7436460b';
export const DEMO_PRICE_URL = 'https://ljrnllkklsumizsxhpwu.supabase.co/storage/v1/object/public/mercury-public-demo-eod/generated-usd-2d1c5d7a87d3b3a2.json';
let verifiedPrices;

async function loadPrices(fetcher, signal) {
  if (verifiedPrices) return verifiedPrices;
  const timeout = AbortSignal.timeout(12000);
  const response = await fetcher(DEMO_PRICE_URL, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    redirect: 'error',
    credentials: 'omit'
  });
  if (!response.ok) throw Error('Supabase demo prices unavailable (HTTP ' + response.status + ').');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length !== 107300 || createHash('sha256').update(bytes).digest('hex') !== digest) {
    throw Error('Demo price file did not match the verified release.');
  }
  verifiedPrices = JSON.parse(new TextDecoder().decode(bytes));
  return verifiedPrices;
}

export async function demoHistory(args, run, {signal, fetcher = fetch} = {}) {
  const symbols = [...new Set(args.symbols)];
  const base = args.portfolio_result_id && activeResults(run).find(r =>
    r.id === args.portfolio_result_id && r.kind === 'portfolio_snapshot' && r.scope_key === run.portfolio_scope?.key);
  if (args.portfolio_result_id && (!base || !symbols.every(s => base.data.holdings.some(h => h.symbol === s)))) {
    throw Error('Select only symbols in the active portfolio result.');
  }
  const start = args.start_date || '2023-08-07';
  const end = args.end_date || '2026-06-19';
  if (start > end) throw Error('Invalid demo price period.');
  const prices = await loadPrices(fetcher, signal);
  const histories = symbols.map(symbol => {
    const rows = Object.hasOwn(prices, symbol) ? prices[symbol] : [];
    const points = rows.filter(([date]) => date >= start && date <= end)
      .map(([date, close]) => ({date, close: Number(close)}));
    return {symbol, points, currency:'USD', observations:points.length, first_date:points[0]?.date, last_date:points.at(-1)?.date,
      status:points.length ? 'demo' : 'unavailable', stale:false, provider:'Mercury / Supabase', basis:'generated_demo_close',
      snapshot_id:points.length ? createHash('sha256').update(JSON.stringify([digest,symbol,points])).digest('hex') : null};
  });
  return {data_mode:'demo', requested:{symbols,start_date:start,end_date:end}, portfolio_result_id:base?.id,
    histories, warnings:['Generated demonstration prices through 2026-06-19. Missing assets are not assigned zero risk.']};
}
