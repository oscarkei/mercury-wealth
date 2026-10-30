"use client";
// mercury-localized
import {copy,localize,useAppPreferences,locale} from "../lib/app-preferences";
import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  AreaSeries,
  HistogramSeries,
  type UTCTimestamp,
} from "lightweight-charts";
type Point = { time: number; close: number; volume: number | null };
export default function MarketPriceChart({
  rows,
  volume,
  onInspect,
}: {
  rows: Point[];
  volume: boolean;
  onInspect: (index: number) => void;
}) {
 useAppPreferences();

  const el = useRef<HTMLDivElement>(null),
    inspect = useRef(onInspect);
  const inspectedIndex = useRef(rows.length - 1);
  inspect.current = onInspect;
  useEffect(() => {
    if (!el.current || !rows.length) return;
    inspectedIndex.current = rows.length - 1;
    const chart = createChart(el.current, {
      autoSize: true,
      height: volume ? 280 : 225,
      layout: {
        background: { type: ColorType.Solid, color: "#fafbf7" },
        textColor: "#67796b",
        fontSize: 11,
        attributionLogo: true,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: "#e8eee5" } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: false },
      handleScroll: { vertTouchDrag: false, horzTouchDrag: true },
      handleScale: { pinch: true, mouseWheel: false },
      crosshair: {
        horzLine: { labelBackgroundColor: "#1d5342" },
        vertLine: { labelBackgroundColor: "#1d5342" },
      },
    });
    const prices = chart.addSeries(AreaSeries, {
      lineColor: "#23745a",
      topColor: "#86b49855",
      bottomColor: "#86b49800",
      lineWidth: 2,
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
    });
    const updateTheme=()=>{const dark=document.documentElement.dataset.theme==='dark';chart.applyOptions({layout:{background:{type:ColorType.Solid,color:dark?'#181b19':'#fafbf7'},textColor:dark?'#a2aba4':'#67796b'},grid:{horzLines:{color:dark?'#303731':'#e8eee5'}}});prices.applyOptions({lineColor:dark?'#a8cfb4':'#23745a'});};
    updateTheme();const observer=new MutationObserver(updateTheme);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
    prices.setData(
      rows.map((p) => ({ time: p.time as UTCTimestamp, value: p.close })),
    );
    if (volume) {
      prices
        .priceScale()
        .applyOptions({ scaleMargins: { top: 0.12, bottom: 0.3 } });
      const bars = chart.addSeries(HistogramSeries, {
        color: "#bacdbd",
        priceFormat: { type: "volume" },
        priceScaleId: "",
      });
      bars
        .priceScale()
        .applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });
      bars.setData(
        rows
          .filter((p) => p.volume !== null)
          .map((p) => ({ time: p.time as UTCTimestamp, value: p.volume! })),
      );
    }
    chart.timeScale().fitContent();
    chart.subscribeCrosshairMove((param) => {
      if (typeof param.time === "number") {
        const i = rows.findIndex((p) => p.time === param.time);
        if (i >= 0) { inspectedIndex.current = i; inspect.current(i); }
      }
    });
    chart.subscribeClick((param) => {if(typeof param.time === "number"){const i=rows.findIndex(p=>p.time===param.time);if(i>=0){inspectedIndex.current=i;inspect.current(i);}}});
    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, [rows, volume]);
  return (
    <div
      className="market-price-chart"
      ref={el}
      style={{ height: volume ? 280 : 225 }}
      role="img"
      tabIndex={0}
      onKeyDown={event => {
        if (!rows.length || !['ArrowLeft','ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        inspectedIndex.current = Math.max(0, Math.min(rows.length - 1, inspectedIndex.current + (event.key === 'ArrowLeft' ? -1 : 1)));
        inspect.current(inspectedIndex.current);
      }}
      aria-label={copy("Interactive daily closing price chart. Tap or long press a date to inspect values.","互動每日收市價圖表；點按或長按日期查看數值。","互动每日收盘价图表；点击或长按日期查看数值。")}
    />
  );
}
