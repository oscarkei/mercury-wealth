"use client";
// mercury-localized
import {localize,useAppPreferences,locale} from "../lib/app-preferences";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Bookmark,
  BookOpen,
  Check,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  LabelList,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { TouchSheet } from "./touch-sheet";
import { homeResearch, type HomeResearch } from "../lib/home-research";

function CoverArt({ kind }: { kind: string }) {
 useAppPreferences();

  return kind === "ubs" ? (
    <svg
      className="research-art research-orbit"
      viewBox="0 0 340 235"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="wealth-orbit" x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="#f3d3a2" />
          <stop offset="1" stopColor="#b86943" />
        </linearGradient>
      </defs>
      <g
        transform="translate(230 115) rotate(-25)"
        fill="none"
        stroke="url(#wealth-orbit)"
      >
        <ellipse rx="100" ry="100" strokeWidth="1" />
        {localize([28, 48, 68, 86].map((r) => (
          <ellipse key={r} rx={r} ry="100" strokeWidth="1" />
        )))}
        {localize([-60, -30, 0, 30, 60].map((y) => (
          <ellipse
            key={y}
            cy={y}
            rx={Math.sqrt(10000 - y * y)}
            ry="17"
            strokeWidth=".7"
          />
        )))}
      </g>
      <circle cx="276" cy="47" r="5" fill="#f2d19c" />
      <circle cx="149" cy="171" r="3" fill="#e9b980" />
    </svg>
  ) : (
    <svg
      className="research-art research-city"
      viewBox="0 0 340 235"
      aria-hidden="true"
    >
      <circle cx="263" cy="61" r="32" fill="#d5b67f" />
      <g stroke="#c6d0c2" strokeWidth="1" fill="none">
        <path d="M152 233V114h29v119m-23-119V97h17v17M186 233V78h45v155m-38-155V64h31v14M235 233V135h42v98m-32-98V115h22v20M282 233V104h35v129" />
        {localize([130, 150, 170, 190, 210].map((y) => (
          <path key={y} d={`M157 ${y}h18m17 0h33m15 0h32m16 0h23`} />
        )))}
      </g>
    </svg>
  );
}
export default function HomeResearchCards() {
 useAppPreferences();

  const [selected, setSelected] = useState<HomeResearch | null>(null),
    [chart, setChart] = useState(0),
    [saved, setSaved] = useState<string[]>([]);
  useEffect(() => {
    try {
      const value = JSON.parse(
        localStorage.getItem("mercury-saved-research") || "[]",
      );
      if (Array.isArray(value))
        setSaved(value.filter((id: unknown) => typeof id === "string"));
    } catch {}
  }, []);
  const toggleSave = (id: string) =>
    setSaved((previous) => {
      const next = previous.includes(id)
        ? previous.filter((x) => x !== id)
        : [...previous, id];
      try {
        localStorage.setItem("mercury-saved-research", JSON.stringify(next));
      } catch {}
      return next;
    });
  const data = selected?.charts[chart] || selected?.charts[0];
  return (
    <section className="research-edit" aria-label={localize("Market research")}>
      <div className="research-section-heading">
        <div>
          <span className="eyebrow">{localize("THE RESEARCH EDIT")}</span>
          <h2>{localize("A wider lens.")}</h2>
        </div>
        <span>01 — 02</span>
      </div>
      <div className="research-covers">
        {localize(homeResearch.map((report, i) => (
          <article key={report.id} className={"research-cover " + report.id}>
            <button
              className="research-cover-open"
              aria-label={localize("Read " + report.publisher + " research")}
              onClick={() => {
                setChart(0);
                setSelected(report);
              }}
            >
              <CoverArt kind={report.id} />
              <div className="research-cover-meta">
                <span>{localize(report.publisher)}</span>
                <small>{localize(report.collection)}</small>
              </div>
              <div className="research-cover-copy">
                <span className="research-edition">{localize("FIELD NOTES / 0")}{localize(i + 1)}</span>
                <h3>{localize(report.headline)}</h3>
                <p>{localize(report.deck)}</p>
              </div>
              <div className="research-cover-stat">
                <strong>{localize(report.metric)}</strong>
                <small>{localize(report.metricLabel)}</small>
              </div>
              <div className="research-cover-footer">
                <span>{localize(report.date)}{localize("· Mercury brief")}</span>
                <span className="research-read-icon">
                  <ArrowUpRight size={22} />
                </span>
              </div>
            </button>
            <button
              className="research-save"
              aria-label={localize(
                (saved.includes(report.id) ? "Unsave " : "Save ") +
                report.publisher +
                " research"
              )}
              aria-pressed={saved.includes(report.id)}
              onClick={() => toggleSave(report.id)}
            >
              {localize(saved.includes(report.id) ? (
                <Check size={18} />
              ) : (
                <Bookmark size={18} />
              ))}
            </button>
          </article>
        )))}
      </div>
      <p className="research-credit">{localize("Mercury summaries · Published research, not a live feed")}</p>
      <TouchSheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={localize(selected ? selected.publisher + " research" : "Research")}
        description={selected ? localize(selected.title) + " · " + localize(selected.date) : ""}
        footer={
          selected ? (
            <a
              className="research-original"
              href={selected.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <BookOpen size={18} />{localize("Read original report")}<ArrowUpRight size={18} />
            </a>
          ) : undefined
        }
      >
        {localize(selected && data && (
          <div className={"research-reader " + selected.id}>
            <div className="research-reader-lead">
              <span className="eyebrow">{localize("MERCURY RESEARCH BRIEF")}</span>
              <h3>{localize(selected.headline)}</h3>
              <p>{localize(selected.deck)}</p>
            </div>
            <ol className="research-findings">
              {localize(selected.findings.map((line, i) => (
                <li key={line}>
                  <span>0{localize(i + 1)}</span>
                  <p>{localize(line)}</p>
                </li>
              )))}
            </ol>
            <section
              className="research-chart-panel"
              aria-label={localize("Research data chart")}
            >
              <h4>{localize(selected.chartTitle)}</h4>
              <div
                className="research-chart-tabs"
                role="group"
                aria-label={localize("Chart breakdown")}
              >
                {localize(selected.charts.map((c, i) => (
                  <button
                    key={c.id}
                    aria-pressed={chart === i}
                    onClick={() => setChart(i)}
                  >
                    {localize(c.label)}
                  </button>
                )))}
              </div>
              <p className="research-chart-caption">{localize(data.caption)}</p>
              <div
                className="research-chart"
                role="img"
                aria-label={localize(
                  localize(data.caption) +
                  ": " +
                  data.data.map((d) => localize(d.name) + " " + d.value + "%").join(", ")
                )}
              >
                <div aria-hidden="true" style={{width:"100%",height:"100%"}}><ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[...data.data]}
                    layout="vertical"
                    margin={{ top: 8, right: 42, left: 0, bottom: 4 }}
                    accessibilityLayer={false}
                  >
                    <XAxis
                      type="number"
                      domain={[0, 20]}
                      ticks={[0, 10, 20]}
                      tickFormatter={(v) => v + "%"}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tickFormatter={(value: string) => localize(value)}
                      width={85}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    />
                    <Bar
                      dataKey="value"
                      barSize={18}
                      radius={[0, 4, 4, 0]}
                      isAnimationActive={false}
                    >
                      {localize(data.data.map((d) => (
                        <Cell
                          key={d.name}
                          fill={
                            d.name === "Global"
                              ? "var(--asset-other)"
                              : selected.id === "ubs"
                                ? "var(--chart-primary)"
                                : "var(--chart-comparison)"
                          }
                        />
                      )))}
                      <LabelList
                        dataKey="value"
                        position="right"
                        formatter={(v) => v + "%"}
                        style={{ fontSize: 11, fill: "var(--ink)" }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer></div>
              </div>
              <details className="research-data-table">
                <summary>{localize("View exact figures")}</summary>
                <table>
                  <caption>{localize(data.caption)}</caption>
                  <tbody>
                    {localize(data.data.map((d) => (
                      <tr key={d.name}>
                        <th scope="row">{localize(d.name)}</th>
                        <td>{localize(d.value.toFixed(1))}%</td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </details>
              <p className="research-chart-note">{localize(selected.note)}</p>
            </section>
            <aside className="research-question">
              <span className="eyebrow">{localize("A QUESTION FOR YOUR FAMILY")}</span>
              <p>{localize(selected.question)}</p>
              <small>{localize("Mercury editorial perspective")}</small>
            </aside>
            <a
              className="research-source-link"
              href={selected.dataUrl}
              target="_blank"
              rel="noopener noreferrer"
            >{localize("Source figures & methodology")}<ArrowUpRight size={16} />
            </a>
            <button
              className="research-reader-save"
              aria-pressed={saved.includes(selected.id)}
              onClick={() => toggleSave(selected.id)}
            >
              {localize(saved.includes(selected.id) ? (
                <Check size={17} />
              ) : (
                <Bookmark size={17} />
              ))}{localize(" ")}
              {localize(saved.includes(selected.id)
                ? "Saved on this device"
                : "Save for later")}
            </button>
          </div>
        ))}
      </TouchSheet>
    </section>
  );
}
