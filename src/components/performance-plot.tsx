"use client";

import { useId, useState } from "react";
import type { Model } from "@/lib/mock-data";
import "./performance-plot.css";

type Metric = "score" | "accuracy" | "critical" | "citation";
type Mode = "cost" | "latency";
type Props = { models: Model[]; metric: Metric; mode: Mode; onChoose: (model: Model) => void; compact?: boolean };
const metricNames: Record<Metric, string> = { score: "综合得分", accuracy: "完整正确率", critical: "关键项通过率", citation: "引用可靠性" };
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return sorted.length ? sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2 : 0;
};

export default function PerformancePlot({ models, metric, mode, onChoose, compact = false }: Props) {
  const [active, setActive] = useState("");
  const [showFrontier, setShowFrontier] = useState(true);
  const tooltipId = useId();
  const width = compact ? 600 : 1040, height = compact ? 338 : 430;
  const left = 52, right = 22, top = 39, bottom = 62;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const xStep = mode === "cost" ? .5 : 40;
  const xMax = Math.max(xStep * 4, Math.ceil(Math.max(0, ...models.map(model => model[mode])) / xStep) * xStep);
  const scores = models.map(model => model[metric]);
  const yMin = Math.max(0, Math.floor((Math.min(65, ...scores) - 5) / 5) * 5);
  const yMax = Math.min(100, Math.max(yMin + 20, Math.ceil((Math.max(85, ...scores) + 5) / 5) * 5));
  const yStep = yMax - yMin > 40 ? 10 : 5;
  const x = (value: number) => left + value / xMax * plotWidth;
  const y = (value: number) => top + (yMax - value) / (yMax - yMin) * plotHeight;
  const middleX = median(models.map(model => model[mode])), middleY = median(scores);
  const splitX = x(middleX), splitY = y(middleY);
  const xTicks = Array.from({ length: Math.round(xMax / xStep) + 1 }, (_, index) => index * xStep);
  const yTicks = Array.from({ length: Math.floor((yMax - yMin) / yStep) + 1 }, (_, index) => yMin + index * yStep);
  let highest = -Infinity;
  const frontier = [...models].sort((a, b) => a[mode] - b[mode] || b[metric] - a[metric]).filter(model => {
    if (model[metric] <= highest) return false;
    highest = model[metric]; return true;
  });
  const points = models.map(model => ({ model, x: x(model[mode]), y: y(model[metric]) }));
  const placed: { x: number; y: number; width: number; height: number }[] = [];
  const positions = new Map<string, { x: number; y: number; anchor: "start" | "end" }>();
  for (const point of [...points].sort((a, b) => b.model[metric] - a.model[metric])) {
    const labelWidth = point.model.name.length * (compact ? 6.4 : 7.1), labelHeight = 15;
    const candidates = [
      { dx: 11, dy: -12, anchor: "start" as const }, { dx: 11, dy: 19, anchor: "start" as const },
      { dx: -11, dy: -12, anchor: "end" as const }, { dx: -11, dy: 19, anchor: "end" as const },
      { dx: 7, dy: -28, anchor: "start" as const }, { dx: -7, dy: 34, anchor: "end" as const },
    ];
    for (const candidate of candidates) {
      const tx = point.x + candidate.dx, ty = point.y + candidate.dy;
      const box = { x: candidate.anchor === "start" ? tx : tx - labelWidth, y: ty - labelHeight + 3, width: labelWidth, height: labelHeight };
      if (box.x < left + 4 || box.x + box.width > width - right - 4 || box.y < top + 22 || box.y + box.height > height - bottom - 18) continue;
      if (placed.some(other => box.x < other.x + other.width + 5 && box.x + box.width + 5 > other.x && box.y < other.y + other.height + 3 && box.y + box.height + 3 > other.y)) continue;
      if (points.some(other => other.model.id !== point.model.id && other.x > box.x - 7 && other.x < box.x + box.width + 7 && other.y > box.y - 6 && other.y < box.y + box.height + 6)) continue;
      positions.set(point.model.id, { x: tx, y: ty, anchor: candidate.anchor }); placed.push(box); break;
    }
  }
  const focused = points.find(point => point.model.id === active);
  const dimension = mode === "cost" ? "成本" : "耗时";
  const formatX = (value: number) => mode === "cost" ? `$${value.toFixed(2)}` : `${value}s`;

  return <div className={`qp-plot ${compact ? "qp-compact" : ""}`}>
    <svg viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`${metricNames[metric]}与${dimension}象限图`}>
      <g aria-hidden="true">
        <rect x={left} y={top} width={splitX - left} height={splitY - top} fill="#eff7f4" />
        <rect x={splitX} y={top} width={width - right - splitX} height={splitY - top} fill="#f3f6fa" />
        <rect x={left} y={splitY} width={splitX - left} height={height - bottom - splitY} fill="#fafbfc" />
        <rect x={splitX} y={splitY} width={width - right - splitX} height={height - bottom - splitY} fill="#faf8f5" />
        {xTicks.map(value => <g key={value}><line className="qp-grid" x1={x(value)} x2={x(value)} y1={top} y2={height - bottom} /><text className="qp-tick" x={x(value)} y={height - bottom + 23} textAnchor="middle">{mode === "cost" ? `$${value.toFixed(1)}` : `${value}s`}</text></g>)}
        {yTicks.map(value => <g key={value}><line className="qp-grid" x1={left} x2={width - right} y1={y(value)} y2={y(value)} /><text className="qp-tick" x={left - 12} y={y(value) + 4} textAnchor="end">{value}</text></g>)}
        <rect className="qp-frame" x={left} y={top} width={plotWidth} height={plotHeight} />
        <line className="qp-median" x1={splitX} x2={splitX} y1={top} y2={height - bottom} />
        <line className="qp-median" x1={left} x2={width - right} y1={splitY} y2={splitY} />
        <text className="qp-quadrant qp-preferred" x={left + 12} y={top + 19}>高得分 · 低{dimension}</text>
        <text className="qp-quadrant" x={width - right - 12} y={top + 19} textAnchor="end">高得分 · 高{dimension}</text>
        <text className="qp-quadrant" x={left + 12} y={height - bottom - 12}>低得分 · 低{dimension}</text>
        <text className="qp-quadrant" x={width - right - 12} y={height - bottom - 12} textAnchor="end">低得分 · 高{dimension}</text>
        <text className="qp-axis" x={left} y={20}>{metricNames[metric]} ↑</text>
        <text className="qp-axis" x={width - right} y={height - 9} textAnchor="end">{mode === "cost" ? "每题成本（USD）" : "每题平均耗时（秒）"} →</text>
        {showFrontier && <polyline className="qp-frontier" points={frontier.map(model => `${x(model[mode])},${y(model[metric])}`).join(" ")} />}
      </g>
      {points.map(point => {
        const selected = point.model.id === active, label = positions.get(point.model.id);
        return <g key={point.model.id} className={`qp-point ${selected ? "qp-active" : ""}`} role="button" tabIndex={0}
          aria-label={`查看 ${point.model.name}，${metricNames[metric]} ${point.model[metric].toFixed(1)}，${dimension} ${formatX(point.model[mode])}`}
          aria-describedby={selected ? tooltipId : undefined}
          onMouseEnter={() => setActive(point.model.id)} onMouseLeave={() => setActive("")}
          onFocus={() => setActive(point.model.id)} onBlur={() => setActive("")}
          onClick={() => onChoose(point.model)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onChoose(point.model); } }}>
          <circle className="qp-hit" cx={point.x} cy={point.y} r={15} />
          <circle className="qp-halo" cx={point.x} cy={point.y} r={selected ? 13 : 9} fill={point.model.color} />
          <circle className="qp-marker" cx={point.x} cy={point.y} r={selected ? 6.5 : 5} fill={point.model.color} />
          {label && <text className="qp-label" x={label.x} y={label.y} textAnchor={label.anchor}>{point.model.name}</text>}
        </g>;
      })}
    </svg>
    {focused && <div className="qp-tooltip" role="tooltip" id={tooltipId} style={{ left: `${Math.max(23, Math.min(77, focused.x / width * 100))}%`, top: `${Math.max(24, focused.y / height * 100 - 5)}%` }}>
      <strong><i style={{ background: focused.model.color }} />{focused.model.name}</strong>
      <div><span>{metricNames[metric]}</span><b>{focused.model[metric].toFixed(1)}</b></div><div><span>{mode === "cost" ? "成本 / 题" : "耗时 / 题"}</span><b>{formatX(focused.model[mode])}</b></div>
    </div>}
    <div className="qp-legend"><button type="button" aria-pressed={showFrontier} onClick={() => setShowFrontier(!showFrontier)}><i className="qp-frontier-key" />效率前沿</button><span title={`得分中位数 ${middleY.toFixed(1)}；${dimension}中位数 ${formatX(middleX)}`}><i className="qp-median-key" />中位线</span></div>
  </div>;
}
