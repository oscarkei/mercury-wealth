"use client";
// mercury-localized
import {localize,useAppPreferences,locale} from "../lib/app-preferences";
import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export function WealthTrend({
  period,
  fx,
  money,
}: {
  period: string;
  fx: number;
  money: (n: number, compact?: boolean) => string;
}) {
 useAppPreferences();

  const id = useId().replace(/:/g, "");
  const series: Record<string, number[]> = {
    "1M": [8.3, 8.34, 8.29, 8.36, 8.35, 8.42],
    "3M": [8.08, 8.13, 8.25, 8.24, 8.32, 8.42],
    "6M": [7.9, 7.99, 7.95, 8.19, 8.29, 8.42],
    "1Y": [7.55, 7.81, 7.74, 7.98, 8.2, 8.42],
  };
  const labels: Record<string, string[]> = {
    "1M": ["Oct 1", "5", "10", "15", "20", "24"],
    "3M": ["Aug 1", "15", "Sep 1", "15", "Oct 1", "24"],
    "6M": ["May", "Jun", "Jul", "Aug", "Sep", "Oct"],
    "1Y": ["Nov", "Jan", "Mar", "May", "Jul", "Oct"],
  };
  const data = (series[period] || series["6M"]).map((value, i) => ({
    label: labels[period]?.[i],
    value: value * 1e6 * fx,
    raw: value * 1e6,
  }));
  return (
    <div
      className="recharts-wealth"
      role="img"
      aria-label={localize(`${period} illustrative asset value, including cash flows; not investment performance.`)}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart
          data={data}
          margin={{ top: 14, right: 4, left: 0, bottom: 0 }}
          accessibilityLayer
        >
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#bfe4bd" stopOpacity={0.24} />
              <stop offset="100%" stopColor="#bfe4bd" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#ffffff16" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#b8c9bd", fontSize: 11 }}
            minTickGap={14}
          />
          <YAxis hide domain={["dataMin - 80000", "dataMax + 80000"]} />
          <Tooltip
            formatter={(_v, _n, item) => [
              money(Number(item.payload.raw)),
              "Asset value",
            ]}
            contentStyle={{
              background: "#fffef8",
              border: 0,
              borderRadius: 12,
              color: "#15392f",
              fontSize: 12,
            }}
            labelStyle={{ color: "#62766b" }}
            cursor={{ stroke: "#d4edc9", strokeDasharray: "3 4" }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#d5efc5"
            strokeWidth={2.5}
            fill={`url(#${id})`}
            isAnimationActive={false}
            activeDot={{
              r: 5,
              fill: "#e1f4d8",
              stroke: "#184738",
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AllocationRing({
  rows,
  total,
  onSelect,
}: {
  rows: { id: string; value: number; color: string; name: string }[];
  total: string;
  onSelect: (id: string) => void;
}) {
 useAppPreferences();

  return (
    <div className="allocation-ring">
      <div
        className="ring-chart"
        role="img"
        aria-label={localize(rows.map((r) => `${r.name}: ${r.value}%`).join(", "))}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <PieChart>
            <Pie
              data={rows}
              dataKey="value"
              nameKey="name"
              innerRadius="73%"
              outerRadius="98%"
              paddingAngle={3}
              stroke="none"
              cornerRadius={4}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
              onClick={(_r, index) => onSelect(rows[index].id)}
            >
              {localize(rows.map((r) => (
                <Cell key={r.id} fill={r.color} />
              )))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="ring-center">
        <small>{localize("Total assets")}</small>
        <strong>{localize(total)}</strong>
        <span>{localize("4 asset classes")}</span>
      </div>
    </div>
  );
}
