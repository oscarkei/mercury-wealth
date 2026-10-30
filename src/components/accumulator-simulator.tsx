"use client";
// mercury-localized
import {copy,localize,useAppPreferences,locale} from "../lib/app-preferences";
import { useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { accumulatorModel } from "../lib/accumulator-model";
export default function AccumulatorSimulator() {
 useAppPreferences();

  const [level, setLevel] = useState(95),
    [days, setDays] = useState(20);
  const [inspectDay, setInspectDay] = useState(20);
  const points = accumulatorModel(level, days),
    last = points.at(-1)!;
  const inspected = points[Math.min(inspectDay, days)];
  const money = (n: number) =>
    new Intl.NumberFormat(locale(), {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);
  return (
    <div className="accumulator-simulator">
      <section className="card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{localize("SIMPLIFIED DAILY ACCUMULATION")}</span>
            <h2>{localize("AAPL Accumulator")}</h2>
          </div>
          <span className="badge">{localize("USD")}</span>
        </div>
        <p className="chart-caption">{localize("Constant-price path after the guarantee period. Illustrative, not a contract valuation.")}</p>
        <div className="accumulator-controls">
          <label>{localize("Daily price level")}<output>{localize(level)}{localize("% of initial")}</output>
            <input
              aria-label={localize("Daily underlying level")}
              type="range"
              min="0"
              max="130"
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
            />
          </label>
          <div className="segmented">
            {localize([10, 20, 60].map((d) => (
              <button
                aria-pressed={days === d}
                onClick={() => {
                  setDays(d);
                  setInspectDay(d);
                }}
                key={d}
              >
                {localize(d)}{localize("days")}</button>
            )))}
          </div>
        </div>
        <div className="accumulator-status">
          {localize(level >= 105
            ? "Knock-out · no further shares"
            : level < 88
              ? "Below strike · 80 shares / day"
              : "Above strike · 40 shares / day")}
        </div>
        <div className="value-chart-key">
          <span>
            <i />{localize("Accumulated cost")}</span>
          <span>
            <i />{localize("Market value")}</span>
        </div>
        <div
          className="accum-chart"
          role="img"
          tabIndex={0}
          onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();setInspectDay(Math.max(0,Math.min(days,inspectDay+(e.key==='ArrowLeft'?-1:1))));}}}
          aria-label={localize(`Accumulated cost ${money(last.cost)}, market value ${money(last.value)}`)}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points} onClick={state=>{const i=Number(state.activeTooltipIndex);if(Number.isInteger(i)&&points[i])setInspectDay(points[i].day);}}>
              <CartesianGrid vertical={false} stroke="#e8ece5" />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                label={{
                  value: localize("Trading day"),
                  position: "insideBottom",
                  offset: -5,
                  fontSize: 11,
                }}
              />
              <YAxis
                width={55}
                tick={{ fontSize: 10 }}
                tickFormatter={(n) => "$" + Math.round(n / 1000) + "k"}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip labelFormatter={day=>localize('Trading day')+' '+day} formatter={(value,name)=>[money(Number(value)),name==='cost'?localize('Cost'):localize('Market value')]}/>
              <Area
                dataKey="cost"
                fill="#d4c7a433"
                stroke="#b9a77d"
                strokeDasharray="4 4"
                isAnimationActive={false}
              />
              <Line
                dataKey="value"
                stroke="#245748"
                dot={false}
                strokeWidth={3}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-day-inspection">
          <p>{copy('Tap the chart to inspect a trading day.','點按圖表查看交易日。','点击图表查看交易日。')} <strong>{localize('Trading day')} {inspected.day}</strong></p>
          <div aria-live="polite">
            <span>{localize("Cost")}<b>{localize(money(inspected.cost))}</b>
            </span>
            <span>{localize("Value")}<b>{localize(money(inspected.value))}</b>
            </span>
          </div>
        </div>
        <div className="simulator-result">
          <div>
            <small>{localize("Accumulated shares")}</small>
            <strong data-testid="accum-shares">
              {localize(last.shares.toLocaleString())}
            </strong>
          </div>
          <div>
            <small>{localize("Purchase obligation")}</small>
            <strong>{localize(money(last.cost))}</strong>
          </div>
          <div>
            <small>{localize("Market value")}</small>
            <strong>{localize(money(last.value))}</strong>
          </div>
          <div>
            <small>{localize("Unrealised P/L")}</small>
            <strong
              data-testid="accum-pnl"
              className={last.value < last.cost ? "negative" : ""}
            >
              {localize(money(last.value - last.cost))}
            </strong>
          </div>
        </div>
        <details className="model-assumptions">
          <summary>{localize("Model assumptions")}</summary>
          <p>{localize("Initial USD 226.87; strike 88%; knock-out at 105%. 40 shares/day, doubled strictly below strike. The same price applies on each simulated day. KO is checked before purchase; simulation starts after any guaranteed period. No pre-existing shares, fees, FX, financing or settlement cash flows. Contract-specific guarantee and observation rules require the full term sheet.")}</p>
        </details>
      </section>
    </div>
  );
}
