"use client";
// mercury-localized
import {localize,useAppPreferences,locale} from "../lib/app-preferences";
import { useId, useState, useMemo } from "react";
import {
  stockRanges,
  stockWindow,
  type StockAnalysis,
  type StockContext,
  type StockRange,
} from "../lib/stock-contract";
import MarketPriceChart from "./market-price-chart";
const rangeNames: Record<StockRange, string> = {
  "1mo": "1M",
  "3mo": "3M",
  "6mo": "6M",
  "1y": "1Y",
};
const date = (seconds: number) =>
  new Date(seconds * 1000).toLocaleDateString(locale(), {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });
const stamp = (s: number) =>
  new Date(s * 1000).toLocaleString(locale(), {
    timeZone: "America/New_York",
    hour12: false,
  }) + " ET";
export default function StockAnalysisCard({
  analysis,
  disabled,
  onAsk,
  onSelection,
}: {
  analysis: StockAnalysis;
  disabled: boolean;
  onAsk: (message: string, selection?: StockContext) => void;
  onSelection: (selection: StockContext) => void;
}) {
 useAppPreferences();

  const [volume, setVolume] = useState(
    analysis.modules.includes("price_and_volume"),
  );
  const [range, setRange] = useState(analysis.range),
    [index, setIndex] = useState<number | null>(null),
    [query, setQuery] = useState("");
  const titleId = useId();
  const { data } = analysis,
    q = data.quote,
    rows = useMemo(() => (q ? stockWindow(q.points, range) : []), [q, range]),
    active = rows[Math.min(index ?? rows.length - 1, rows.length - 1)],
    first = rows[0],
    last = rows.at(-1);
  const selection = q ? { symbol: q.symbol, range } : undefined;
  function changeRange(next: StockRange) {
    setRange(next);
    setIndex(null);
    if (q) onSelection({ symbol: q.symbol, range: next });
  }
  return (
    <section
      className="fed-analysis stock-analysis"
      aria-label={localize("Stock analysis")}
    >
      <header className="fed-card-header">
        <span className="fed-kicker">{localize("US MARKET EXPLORER")}</span>
        <h3>{localize(q ? q.name : "Search US stocks")}</h3>
        <p>{localize("Yahoo Finance · Stocks & ETFs")}</p>
      </header>
      <form
        className="stock-search"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim())
            onAsk(
              "Search Yahoo Finance for " +
                query.trim() +
                ". Show the price chart.",
            );
        }}
      >
        <label className="sr-only" htmlFor={titleId + "-search"}>{localize("Company or US ticker")}</label>
        <input
          id={titleId + "-search"}
          placeholder={localize("Company or ticker, e.g. AAPL")}
          maxLength={80}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" disabled={disabled || !query.trim()}>{localize("Search")}</button>
      </form>
      {localize(data.warnings.map((w) => (
        <p role="status" className="fed-warning" key={w}>
          {localize(w)}
        </p>
      )))}
      {localize(data.results.length > 0 && (
        <details className="fed-details">
          <summary>{localize("Search matches (")}{localize(data.results.length)}) · {localize(data.query)}
          </summary>
          <div className="stock-matches">
            {localize(data.results.map((r) => (
              <button
                type="button"
                disabled={disabled}
                key={r.symbol}
                onClick={() =>
                  onAsk("Show " + r.symbol + " price history.", {
                    symbol: r.symbol,
                    range,
                  })
                }
              >
                <strong>{localize(r.symbol)}</strong>
                <span>{localize(r.name)}</span>
                <small>
                  {localize(r.exchange)} · {localize(r.type)}
                </small>
              </button>
            )))}
          </div>
          <p>{localize("Showing the exact ticker match, or the first supported US search match. Choose another result if needed.")}</p>
        </details>
      ))}
      {localize(q && active && first && last && (
        <>
          <div className="stock-quote">
            <div>
              <span>
                {localize(q.symbol)} · {localize(q.exchange)}
              </span>
              <strong>
                {localize(q.price === null ? "Unavailable" : "$" + q.price.toFixed(2))}
              </strong>
              <small>{localize("Quoted price · USD")}</small>
            </div>
            <div>
              <strong>
                {localize(((last.close / first.close - 1) * 100).toFixed(2))}%
              </strong>
              <small>{localize("Displayed close-to-close change")}</small>
            </div>
          </div>
          <p className="fed-note">{localize("Quote timestamp:")}{localize(q.quoteTime ? stamp(q.quoteTime) : "Unavailable")}{localize(". Data may be delayed.")}</p>
          <div className="fed-segments" aria-label={localize("Stock chart range")}>
            {localize(stockRanges.map((r) => (
              <button
                type="button"
                key={r}
                aria-pressed={range === r}
                onClick={() => changeRange(r)}
              >
                {localize(rangeNames[r])}
              </button>
            )))}
          </div>
          <div className="fed-segments" aria-label={localize("Stock chart display")}>
            <button
              type="button"
              aria-pressed={!volume}
              onClick={() => setVolume(false)}
            >{localize("Price")}</button>
            <button
              type="button"
              aria-pressed={volume}
              onClick={() => setVolume(true)}
            >{localize("Price + volume")}</button>
          </div>
          <MarketPriceChart rows={rows} volume={volume} onInspect={setIndex} />
          <output className="fed-history-value">
            {localize(date(active.time))}
            <strong>${localize(active.close.toFixed(2))}</strong>
          </output>
          {localize(volume && (
            <p className="fed-note">{localize("Volume:")}{localize(" ")}
              {localize(active.volume === null
                ? "unavailable"
                : active.volume.toLocaleString(locale()) + " shares")}
            </p>
          ))}
          <p className="fed-note">{localize("Daily closing prices, not adjusted total returns. The latest daily bar may be in progress. Range ends at the latest available observation.")}</p>
          <div className="fed-actions">
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                onAsk(
                  "Explain " +
                    q.symbol +
                    " " +
                    (volume ? "price and volume" : "price") +
                    " over the selected " +
                    range +
                    " range using the chart data.",
                  selection,
                )
              }
            >{localize("Explain this chart")}</button>
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                onAsk("Refresh " + q.symbol + " price and chart.", selection)
              }
            >{localize("Refresh data")}</button>
          </div>
          <p className="fed-note">{localize("Range controls update the chart immediately. Request a new explanation after changing the range.")}</p>
        </>
      ))}
      <details className="fed-details">
        <summary>{localize("Source & chart details")}</summary>
        <p>{localize("TradingView Lightweight Charts™ · Copyright (с) 2025 TradingView, Inc.")}{localize(" ")}
          <a
            href="https://www.tradingview.com/"
            target="_blank"
            rel="noreferrer"
          >{localize("TradingView")}</a>
        </p>
        <p>{localize("Yahoo Finance retrieved:")}{localize(" ")}
          {localize(new Date(data.retrievedAt).toLocaleString(locale(), {
            timeZone: "UTC",
          }))}{localize(" ")}{localize("UTC. Successful data may be cached for 60 seconds. Quotes are not guaranteed real-time.")}</p>
        <p>{localize("Initial chart:")}{localize(analysis.modules.join(", "))}{localize(". Laya suggested:")}{localize(" ")}
          {localize(analysis.composer.suggestedModule || analysis.modules[0])} (
          {localize(analysis.composer.elapsed_ms)}{localize("ms). Explicitly requested volume is always included.")}</p>
        {localize(q && (
          <a
            href={
              "https://finance.yahoo.com/quote/" +
              encodeURIComponent(q.symbol) +
              "/"
            }
            target="_blank"
            rel="noreferrer"
          >{localize("View")}{localize(q.symbol)}{localize("on Yahoo Finance ↗")}</a>
        ))}
        {localize(rows.length > 0 && (
          <div className="fed-table-wrap">
            <table>
              <caption>{localize("Last 10 displayed observations")}</caption>
              <thead>
                <tr>
                  <th>{localize("Date")}</th>
                  <th>{localize("Close USD")}</th>
                  <th>{localize("Volume")}</th>
                </tr>
              </thead>
              <tbody>
                {localize(rows.slice(-10).map((p) => (
                  <tr key={p.time}>
                    <td>{localize(date(p.time))}</td>
                    <td>{localize(p.close.toFixed(2))}</td>
                    <td>{localize(p.volume?.toLocaleString(locale()) ?? "—")}</td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        ))}
      </details>
    </section>
  );
}
