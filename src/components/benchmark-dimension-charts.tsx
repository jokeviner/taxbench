"use client";

import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { categoryOptions, regions, type Model } from "@/lib/mock-data";
import "./benchmark-dimension-charts.css";

type Props = { models: Model[]; onInspect: (model: Model) => void };
type ActivePoint = { modelId: string; category: string; value: number };
const LABELS: Record<string, string> = {
  "规则与来源适用": "规则与法源", "数值与计算": "数值计算", "表格与申报": "表格申报",
  "争议处理与裁判适用": "争议与裁判", "年度与规则变化": "年度变化", "事实情境分析": "事实情境",
};
const ticks = [0, 25, 50, 75, 100];
const center = { x: 280, y: 151 };
const radius = 103;
function coordinate(index: number, value: number, extra = 0) {
  const angle = -Math.PI / 2 + index * Math.PI / 3;
  const distance = radius * Math.max(0, Math.min(100, value)) / 100 + extra;
  return { x: center.x + Math.cos(angle) * distance, y: center.y + Math.sin(angle) * distance };
}
function activateKey(event: KeyboardEvent<SVGCircleElement>, model: Model, onInspect: Props["onInspect"]) {
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onInspect(model); }
}
function ModelLegend({ models, onInspect }: Props) {
  return <div className="bd-legend" aria-label="图例">{models.map((model) => <button type="button" key={model.id} onClick={() => onInspect(model)}><i style={{ backgroundColor: model.color }} />{model.name}</button>)}</div>;
}

export function CapabilityRadar({ models, onInspect }: Props) {
  const [active, setActive] = useState<ActivePoint | null>(null);
  const activeModel = models.find((model) => model.id === active?.modelId);
  function nearestPoint(event: MouseEvent<SVGCircleElement>, fallback: ActivePoint): ActivePoint {
    const svg = event.currentTarget.ownerSVGElement;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return fallback;
    const screenPoint = svg.createSVGPoint();
    screenPoint.x = event.clientX; screenPoint.y = event.clientY;
    const localPoint = screenPoint.matrixTransform(matrix.inverse());
    let nearest = fallback;
    let distance = Number.POSITIVE_INFINITY;
    for (const model of models) {
      categoryOptions.forEach((category, index) => {
        const value = model.categories[category];
        const point = coordinate(index, value);
        const squaredDistance = (point.x - localPoint.x) ** 2 + (point.y - localPoint.y) ** 2;
        if (squaredDistance < distance) { distance = squaredDistance; nearest = { modelId: model.id, category, value }; }
      });
    }
    return nearest;
  }
  function pointerPoint(event: MouseEvent<SVGCircleElement>, fallback: ActivePoint) {
    const nearest = nearestPoint(event, fallback);
    setActive((previous) => previous?.modelId === nearest.modelId && previous.category === nearest.category ? previous : nearest);
  }

  return <div className="bd-chart bd-radar-chart">
    <div className="bd-chart-heading"><h4>六类任务综合得分 <span>/100</span></h4><span>所选 {models.length} 模型</span></div>
    {!models.length ? <div className="bd-empty">选择模型</div> : <>
      <ModelLegend models={models} onInspect={onInspect} />
      <div className="bd-radar-layout">
        <div className="bd-radar-figure">
          <svg viewBox="0 0 560 303" role="group" aria-label="六类任务能力雷达，统一零起点和100分上限">
            <g aria-hidden="true">{ticks.filter((tick) => tick > 0).reverse().map((tick) => <polygon key={tick} points={categoryOptions.map((_, index) => { const point = coordinate(index, tick); return `${point.x},${point.y}`; }).join(" ")} fill={tick === 100 ? "#f8fafc" : "none"} stroke="#e0e7ee" strokeWidth={.8} />)}
              {categoryOptions.map((category, index) => { const point = coordinate(index, 100); const label = coordinate(index, 100, 25); return <g key={category}><line x1={center.x} y1={center.y} x2={point.x} y2={point.y} stroke="#dfe7ef" strokeWidth={.8} /><text x={label.x} y={label.y + (index === 3 ? 7 : 3)} textAnchor={index === 0 || index === 3 ? "middle" : index < 3 ? "start" : "end"} className="bd-radar-axis-label">{LABELS[category] || category}</text></g>; })}
              {ticks.map((tick) => <text key={tick} x={center.x + 6} y={center.y - radius * tick / 100 + 3} className="bd-radar-tick">{tick}</text>)}
            </g>
            {models.map((model) => <polygon key={model.id} points={categoryOptions.map((category, index) => { const point = coordinate(index, model.categories[category]); return `${point.x},${point.y}`; }).join(" ")} fill={model.color} fillOpacity={activeModel && activeModel.id !== model.id ? .025 : .065} stroke={model.color} strokeWidth={activeModel?.id === model.id ? 2.1 : 1.5} strokeOpacity={activeModel && activeModel.id !== model.id ? .35 : .85} aria-hidden="true" />)}
            {models.map((model) => categoryOptions.map((category, index) => { const value = model.categories[category]; const point = coordinate(index, value); const focused = active?.modelId === model.id && active.category === category; return <g key={`${model.id}-${category}`}><circle cx={point.x} cy={point.y} r={focused ? 4.2 : 2.7} fill={model.color} stroke="white" strokeWidth={1} pointerEvents="none" aria-hidden="true" /><circle className="bd-radar-hit" cx={point.x} cy={point.y} r={8} fill="transparent" stroke={focused ? model.color : "transparent"} strokeWidth={1} tabIndex={0} role="button" aria-label={`${model.name}，${category}，${value.toFixed(1)}分`} onMouseEnter={(event) => pointerPoint(event, { modelId: model.id, category, value })} onMouseMove={(event) => pointerPoint(event, { modelId: model.id, category, value })} onMouseLeave={() => setActive(null)} onFocus={() => setActive({ modelId: model.id, category, value })} onBlur={() => setActive(null)} onClick={(event) => { const nearest = event.detail === 0 ? { modelId: model.id, category, value } : nearestPoint(event, { modelId: model.id, category, value }); onInspect(models.find((candidate) => candidate.id === nearest.modelId) ?? model); }} onKeyDown={(event) => activateKey(event, model, onInspect)}><title>{`${activeModel?.name ?? model.name} · ${active?.category ?? category}：${(active?.value ?? value).toFixed(1)}`}</title></circle></g>; }))}
          </svg>
          <div className="bd-point-readout" aria-live="polite">{active && activeModel ? <><i style={{ backgroundColor: activeModel.color }} /><span>{activeModel.name} · {LABELS[active.category] || active.category}</span><strong>{active.value.toFixed(1)}</strong></> : <span>0–100</span>}</div>
        </div>
        <div className="bd-radar-table-scroll"><table className="bd-radar-table"><thead><tr><th scope="col">任务</th>{models.map((model) => <th scope="col" key={model.id}><button type="button" title={model.name} onClick={() => onInspect(model)}><i style={{ backgroundColor: model.color }} /><span>{model.name}</span></button></th>)}</tr></thead><tbody>{categoryOptions.map((category) => <tr key={category} className={active?.category === category ? "bd-data-active" : ""}><th scope="row" title={category}>{LABELS[category] || category}</th>{models.map((model) => <td key={model.id}><button type="button" onMouseEnter={() => setActive({ modelId: model.id, category, value: model.categories[category] })} onMouseLeave={() => setActive(null)} onFocus={() => setActive({ modelId: model.id, category, value: model.categories[category] })} onBlur={() => setActive(null)} onClick={() => onInspect(model)} aria-label={`${model.name}，${category}，${model.categories[category].toFixed(1)}分`}>{model.categories[category].toFixed(1)}</button></td>)}</tr>)}</tbody></table></div>
      </div>
    </>}
  </div>;
}

export function RegionGroupedBars({ models, onInspect }: Props) {
  return <div className="bd-chart bd-region-chart">
    <div className="bd-chart-heading"><h4>四地区综合得分 <span>/100</span></h4><span>所选 {models.length} 模型</span></div>
    {!models.length ? <div className="bd-empty">选择模型</div> : <>
      <ModelLegend models={models} onInspect={onInspect} />
      <div className="bd-region-axis" aria-hidden="true">{ticks.map((tick) => <span key={tick} style={{ left: `${tick}%` }}>{tick}</span>)}</div>
      <div className="bd-region-groups">{regions.map((region) => <div className="bd-region-group" key={region}><h5>{region}</h5><div className="bd-region-bars">{models.map((model) => <button type="button" className="bd-region-bar" key={model.id} onClick={() => onInspect(model)} aria-label={`${model.name}，${region}，${model.regions[region].toFixed(1)}分`} title={`${model.name} · ${region}：${model.regions[region].toFixed(1)}`}><span className="bd-region-track"><i style={{ width: `${Math.max(0, Math.min(100, model.regions[region]))}%`, backgroundColor: model.color }} /></span><strong style={{ color: model.color }}>{model.regions[region].toFixed(1)}</strong></button>)}</div></div>)}</div>
    </>}
  </div>;
}
