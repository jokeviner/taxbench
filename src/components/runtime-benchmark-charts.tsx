"use client";

import { useId, useState } from "react";
import type { Model } from "@/lib/mock-data";
import { getModelAnalytics } from "@/lib/benchmark-analytics";
import "./runtime-benchmark-charts.css";

type Props = { models: Model[]; onInspect: (model: Model) => void };
type CostAxis = "cost" | "latency";
const number = (value: number, digits = 1) => value.toFixed(digits).replace(/\.0$/, "");
const clean = (value: string) => value.replace(/\s*·\s*虚构/g, "").replace(/[-_ ]?demo/gi, "").replace(/模拟|演示|虚构/g, "").trim();

// Local prototype analytics only; rendering never starts an evaluation or service call.
export default function RuntimeBenchmarkCharts({ models, onInspect }: Props) {
  const [selectedId, setSelectedId] = useState("");
  const selected = models.find(model => model.id === selectedId) ?? models[0];
  if (!selected) return <div className="rbc-empty">请选择模型</div>;
  const analytics = getModelAnalytics(selected);
  const errors = analytics.errorBreakdown.reduce((sum, item) => sum + item.count, 0);
  const reasonMax = Math.max(1, Math.ceil(Math.max(0, ...analytics.errorBreakdown.map(item => item.count)) / 5) * 5);
  const total = analytics.sampleCount;
  const circumference = 2 * Math.PI * 45;
  const completedLength = total > 0 ? analytics.completed / total * circumference : 0;
  return <div className="rbc-grid">
    <section className="rbc-panel"><Scatter models={models} onInspect={onInspect} /></section>
    <section className="rbc-panel">
      <div className="rbc-heading"><h3>执行与失分</h3><label className="rbc-select"><span className="rbc-sr-only">查看模型</span><select aria-label="选择执行统计模型" value={selected.id} onChange={event => setSelectedId(event.target.value)}>{models.map(model => <option value={model.id} key={model.id}>{clean(model.name)}</option>)}</select></label></div>
      <div className="rbc-execution">
        <svg viewBox="0 0 128 128" role="img" aria-label={"共 " + total + " 题，执行完成 " + analytics.completed + " 题，执行失败 " + analytics.failed + " 题"}>
          <circle cx="64" cy="64" r="45" fill="none" stroke="#c3978c" strokeWidth="12" />
          <circle cx="64" cy="64" r="45" fill="none" stroke="#64869b" strokeWidth="12" strokeDasharray={completedLength + " " + circumference} transform="rotate(-90 64 64)" />
          <text x="64" y="62" textAnchor="middle" className="rbc-ring-number">{analytics.completed}</text><text x="64" y="80" textAnchor="middle" className="rbc-ring-label">完成 / {total}</text>
        </svg>
        <dl className="rbc-execution-facts"><div><dt><i className="rbc-completed-dot" />执行完成</dt><dd>{analytics.completed}<small> 题</small></dd></div><div><dt><i className="rbc-failed-dot" />执行失败</dt><dd>{analytics.failed}<small> 题</small></dd></div><div><dt>整体题数</dt><dd>{total}<small> 题</small></dd></div></dl>
      </div>
      <div className="rbc-reasons"><div className="rbc-reasons-title"><h4>未完整通过 {errors}/{total} 题</h4></div>
        {errors > 0 ? <><div className="rbc-reason-axis" aria-hidden="true"><span /><div><span>0</span><span>{number(reasonMax / 2)}</span><span>{reasonMax} 题</span></div><span /></div><div className="rbc-reason-list">{analytics.errorBreakdown.map(item => <div key={item.label}><span>{item.label}</span><div className="rbc-reason-track"><i style={{ width: String(item.count / reasonMax * 100) + "%" }} /></div><b>{item.count}<small> 题</small></b></div>)}</div></> : <p className="rbc-all-passed">全部题目完整通过</p>}
      </div>
    </section>
  </div>;
}

function Scatter({ models, onInspect }: Props) {
  const [axis, setAxis] = useState<CostAxis>("cost");
  const [activeId, setActiveId] = useState("");
  const id = useId();
  const width = 560, height = 298, left = 43, right = 17, top = 21, bottom = 42;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const maximum = Math.max(0, ...models.map(model => model[axis]));
  const step = axis === "cost" ? Math.max(.1, Math.ceil(maximum / 4 * 10) / 10) : Math.max(10, Math.ceil(maximum / 4 / 10) * 10);
  const xMax = step * 4;
  const x = (value: number) => left + Math.max(0, value) / xMax * plotWidth;
  const y = (value: number) => top + (100 - Math.min(100, Math.max(0, value))) / 100 * plotHeight;
  const xLabel = (value: number) => axis === "cost" ? "$" + value.toFixed(2) : number(value, 0) + "s";
  const active = models.find(model => model.id === activeId);
  return <>
    <div className="rbc-heading"><h3>{axis === "cost" ? "成本与综合得分" : "耗时与综合得分"}</h3><div className="rbc-axis-switch" aria-label="散点图横轴"><button type="button" className={axis === "cost" ? "rbc-axis-active" : ""} aria-pressed={axis === "cost"} onClick={() => setAxis("cost")}>成本</button><button type="button" className={axis === "latency" ? "rbc-axis-active" : ""} aria-pressed={axis === "latency"} onClick={() => setAxis("latency")}>耗时</button></div></div>
    <div className="rbc-scatter">
      <svg viewBox={"0 0 " + width + " " + height} role="group" aria-label={(axis === "cost" ? "每题成本USD" : "平均耗时秒") + "与综合得分散点图"}>
        {[0, 25, 50, 75, 100].map(value => <g key={value}><line x1={left} x2={width - right} y1={y(value)} y2={y(value)} className="rbc-grid-line" /><text x={left - 10} y={y(value) + 4} textAnchor="end" className="rbc-tick">{value}</text></g>)}
        {[0, 1, 2, 3, 4].map(index => <g key={index}><line x1={x(index * step)} x2={x(index * step)} y1={top} y2={height - bottom} className="rbc-grid-line" /><text x={x(index * step)} y={height - bottom + 21} textAnchor="middle" className="rbc-tick">{xLabel(index * step)}</text></g>)}
        <rect x={left} y={top} width={plotWidth} height={plotHeight} className="rbc-plot-frame" /><text x={left} y="10" className="rbc-axis-label">综合得分 /100</text><text x={width - right} y={height - 3} textAnchor="end" className="rbc-axis-label">{axis === "cost" ? "成本（USD /题）" : "平均耗时（秒 /题）"}</text>
        {models.map(model => <g key={model.id} className="rbc-scatter-point" role="button" tabIndex={0} aria-label={"查看 " + clean(model.name) + "，综合得分 " + number(model.score) + "，" + (axis === "cost" ? "成本 " : "耗时 ") + xLabel(model[axis])} aria-describedby={activeId === model.id ? id : undefined} onMouseEnter={() => setActiveId(model.id)} onMouseLeave={() => setActiveId("")} onFocus={() => setActiveId(model.id)} onBlur={() => setActiveId("")} onClick={() => onInspect(model)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onInspect(model); } }}>
          <title>{clean(model.name) + " · " + number(model.score) + " · " + xLabel(model[axis])}</title><circle cx={x(model[axis])} cy={y(model.score)} r="13" fill="transparent" /><circle cx={x(model[axis])} cy={y(model.score)} r={activeId === model.id ? 11 : 8} fill={model.color} opacity=".15" /><circle cx={x(model[axis])} cy={y(model.score)} r={activeId === model.id ? 5.5 : 4.5} fill={model.color} stroke="#fff" strokeWidth="1.6" />
        </g>)}
      </svg>
      {active && <div className="rbc-point-tooltip" id={id} role="tooltip"><i style={{ background: active.color }} /><strong>{clean(active.name)}</strong><span>{number(active.score)} 分</span><span>{xLabel(active[axis])} /题</span></div>}
    </div>
    <div className="rbc-model-legend">{models.map(model => <button type="button" key={model.id} onClick={() => onInspect(model)}><i style={{ background: model.color }} />{clean(model.name)}</button>)}</div>
  </>;
}
