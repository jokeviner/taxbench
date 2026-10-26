"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { ArrowDown, ArrowDownUp, ArrowRight, ArrowUp, Check, ChevronDown, Radar, MapPin, ChartColumn, Activity } from "lucide-react";
import { categoryOptions, regions, type Model } from "@/lib/mock-data";
import { getModelAnalytics, type ModelAnalytics } from "@/lib/benchmark-analytics";
import { CapabilityRadar, RegionGroupedBars } from "./benchmark-dimension-charts";
import RuntimeBenchmarkCharts from "./runtime-benchmark-charts";
import "./benchmark-report.css";

type ReportTab = "tasks" | "regions" | "scores" | "runtime";
type CellMode = "score" | "difference";
type Sort = { key: string; direction: "asc" | "desc" };
type Props = { models: Model[]; onInspect: (model: Model) => void; onCompare: (models: Model[]) => void };

const TABS: Array<{ id: ReportTab; label: string }> = [
  { id: "tasks", label: "任务表现" }, { id: "regions", label: "地区表现" },
  { id: "scores", label: "评分对比" }, { id: "runtime", label: "运行分析" },
];
const CATEGORY_LABELS: Record<string, string> = {
  "规则与来源适用": "规则与法源", "数值与计算": "数值计算", "表格与申报": "表格申报",
  "争议处理与裁判适用": "争议与裁判", "年度与规则变化": "年度变化", "事实情境分析": "事实情境",
};
const METRICS: Array<{ key: "score" | "accuracy" | "critical" | "citation"; label: string; unit: string }> = [
  { key: "score", label: "综合得分", unit: "/100" },
  { key: "accuracy", label: "完整正确率", unit: "%" },
  { key: "critical", label: "关键项通过率", unit: "%" },
  { key: "citation", label: "引用可靠性", unit: "%" },
];
function fixed(value: number) { return value.toFixed(1); }
function signed(value: number) { const rounded = Math.round(value * 10) / 10; return `${rounded > 0 ? "+" : ""}${fixed(rounded)}`; }
function heatColor(value: number, mode: CellMode) {
  if (mode === "difference") {
    const opacity = Math.min(Math.abs(value) / 15, 1) * .25 + .025;
    return value >= 0 ? `rgba(46, 128, 112, ${opacity})` : `rgba(175, 112, 94, ${opacity})`;
  }
  return `rgba(49, 91, 154, ${Math.max(.035, Math.min(.34, (value - 45) / 55 * .34))})`;
}

export default function BenchmarkReport({ models, onInspect, onCompare }: Props) {
  const [tab, setTab] = useState<ReportTab>("tasks");
  const [mode, setMode] = useState<CellMode>("score");
  const [taskView, setTaskView] = useState<"radar" | "heatmap">("radar");
  const [regionView, setRegionView] = useState<"bars" | "heatmap">("bars");
  const [selectedIds, setSelectedIds] = useState(() => [...models].sort((a, b) => b.score - a.score).slice(0, 3).map((model) => model.id));
  const [sort, setSort] = useState<Sort>({ key: "score", direction: "desc" });
  const selected = useMemo(() => models.filter((model) => selectedIds.includes(model.id)), [models, selectedIds]);
  const analytics = useMemo(() => new Map<string, ModelAnalytics>(models.map((model) => [model.id, getModelAnalytics(model)])), [models]);
  const dimension = tab === "regions" ? "regions" : "categories";
  const columns = tab === "regions" ? regions : categoryOptions;
  const means = useMemo(() => Object.fromEntries((tab === "regions" ? regions : categoryOptions).map((key) => [key, models.length ? models.reduce((sum, model) => sum + (model[dimension][key] ?? 0), 0) / models.length : 0])), [models, dimension, tab]);
  const overallMean = models.length ? models.reduce((sum, model) => sum + model.score, 0) / models.length : 0;
  const ranked = useMemo(() => [...models].sort((a, b) => {
    const delta = sort.key === "name" ? a.name.localeCompare(b.name) : sort.key === "score" ? a.score - b.score : (a[dimension][sort.key] ?? 0) - (b[dimension][sort.key] ?? 0);
    return sort.direction === "asc" ? delta : -delta;
  }), [models, dimension, sort]);
  const toolKeys = selected.length ? analytics.get(selected[0].id)?.toolCalls ?? [] : [];
  const heatmapVisible = tab === "tasks" && taskView === "heatmap" || tab === "regions" && regionView === "heatmap";

  function switchTab(next: ReportTab) { setTab(next); setSort({ key: "score", direction: "desc" }); }
  function keyTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft") next = (index + TABS.length - 1) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    else return;
    event.preventDefault(); switchTab(TABS[next].id); document.getElementById(`br-tab-${TABS[next].id}`)?.focus();
  }
  function toggleModel(id: string) { setSelectedIds((previous) => previous.includes(id) ? previous.filter((item) => item !== id) : previous.length < 3 ? [...previous, id] : previous); }
  function changeSort(key: string) { setSort((previous) => ({ key, direction: previous.key === key && previous.direction === "desc" ? "asc" : "desc" })); }
  function sortIcon(key: string) { return sort.key !== key ? <ArrowDownUp size={11} /> : sort.direction === "desc" ? <ArrowDown size={11} /> : <ArrowUp size={11} />; }
  function ariaSort(key: string): "ascending" | "descending" | "none" { return sort.key === key ? sort.direction === "asc" ? "ascending" : "descending" : "none"; }

  return <section className="br-report" aria-label="基准分析">
    <div className="br-header">
      <div className="br-tabs" role="tablist" aria-label="分析维度">{TABS.map((item, index) => <button type="button" id={`br-tab-${item.id}`} role="tab" aria-selected={tab === item.id} aria-controls={`br-panel-${item.id}`} tabIndex={tab === item.id ? 0 : -1} key={item.id} className={tab === item.id ? "br-tab br-tab-active" : "br-tab"} onClick={() => switchTab(item.id)} onKeyDown={(event) => keyTab(event, index)}>{item.id === "tasks" ? <Radar size={13} aria-hidden="true" /> : item.id === "regions" ? <MapPin size={13} aria-hidden="true" /> : item.id === "scores" ? <ChartColumn size={13} aria-hidden="true" /> : <Activity size={13} aria-hidden="true" />}{item.label}</button>)}</div>
      {(tab === "tasks" || tab === "regions") && <div className="br-panel-controls"><div className="br-view-switch br-chart-view" role="group" aria-label="图表类型"><button type="button" aria-pressed={!heatmapVisible} className={!heatmapVisible ? "br-view-active" : ""} onClick={() => tab === "tasks" ? setTaskView("radar") : setRegionView("bars")}>{tab === "tasks" ? "能力雷达" : "分组条形图"}</button><button type="button" aria-pressed={heatmapVisible} className={heatmapVisible ? "br-view-active" : ""} onClick={() => tab === "tasks" ? setTaskView("heatmap") : setRegionView("heatmap")}>热力表</button></div>{heatmapVisible && <div className="br-view-switch" role="group" aria-label="表格显示方式"><button type="button" aria-pressed={mode === "score"} className={mode === "score" ? "br-view-active" : ""} onClick={() => setMode("score")}>得分</button><button type="button" aria-pressed={mode === "difference"} className={mode === "difference" ? "br-view-active" : ""} onClick={() => setMode("difference")}>相对平均差值</button></div>}</div>}
    </div>

    <div className="br-selection"><div className="br-model-chips" role="group" aria-label="对比模型，最多选择三个">{models.map((model) => {
      const chosen = selectedIds.includes(model.id);
      return <button type="button" key={model.id} aria-pressed={chosen} disabled={!chosen && selected.length >= 3} className={chosen ? "br-model-chip br-model-chip-selected" : "br-model-chip"} onClick={() => toggleModel(model.id)}><span className="br-model-mark" style={{ backgroundColor: model.color }}>{chosen && <Check size={9} strokeWidth={3} />}</span>{model.name}</button>;
    })}</div><div className="br-selection-actions"><span>{selected.length}/3</span><button type="button" className="br-compare-button" disabled={selected.length < 2} onClick={() => onCompare(selected)}>模型对比 <ArrowRight size={12} /></button></div></div>

    <div className="br-panel" id={`br-panel-${tab}`} role="tabpanel" aria-labelledby={`br-tab-${tab}`}>
      {tab === "tasks" && taskView === "radar" && <CapabilityRadar models={selected} onInspect={onInspect} />}
      {tab === "regions" && regionView === "bars" && <RegionGroupedBars models={selected} onInspect={onInspect} />}
      {heatmapVisible && <>
        <div className="br-table-meta"><span className="br-scope">全部模型 <b>{models.length}</b></span><div className="br-heat-legend" aria-label={mode === "score" ? "颜色由浅至深表示得分由低至高" : "绿色高于平均，棕色低于平均"}>{(mode === "score" ? [60, 80, 100] : [-12, 0, 12]).map((value) => <span key={value}><i style={{ backgroundColor: heatColor(value, mode) }} />{mode === "difference" ? signed(value) : value}</span>)}</div></div>
        <div className="br-table-scroll" tabIndex={0} aria-label={tab === "tasks" ? "全部模型任务得分表，可横向滚动" : "全部模型地区得分表，可横向滚动"}>
          <table className={`br-heat-table ${tab === "regions" ? "br-region-table" : ""}`}><caption className="br-sr-only">{tab === "tasks" ? "任务表现" : "地区表现"} · {mode === "score" ? "得分" : "相对全体模型平均差值"}</caption><thead><tr><th scope="col" aria-sort={ariaSort("name")}><button type="button" onClick={() => changeSort("name")}>模型 {sortIcon("name")}</button></th>{columns.map((key) => <th scope="col" key={key} aria-sort={ariaSort(key)}><button type="button" title={key} onClick={() => changeSort(key)}>{CATEGORY_LABELS[key] || key}{sortIcon(key)}</button></th>)}<th scope="col" aria-sort={ariaSort("score")}><button type="button" onClick={() => changeSort("score")}>综合{sortIcon("score")}</button></th></tr></thead>
            <tbody>{ranked.map((model) => <tr key={model.id}><th scope="row"><button className="br-model-link" type="button" onClick={() => onInspect(model)}><span className="br-color-dot" style={{ backgroundColor: model.color }} />{model.name}</button></th>{columns.map((key) => {
              const raw = model[dimension][key]; const value = mode === "difference" ? raw - means[key] : raw;
              return <td key={key}><button className={`br-heat-cell ${mode === "difference" ? value >= 0 ? "br-positive" : "br-negative" : ""}`} style={{ backgroundColor: heatColor(value, mode) }} type="button" onClick={() => onInspect(model)} aria-label={`${model.name}，${key}，${mode === "difference" ? "相对平均差值" : "得分"}${fixed(value)}`} title={`${model.name} · ${key}：${fixed(raw)}`} >{mode === "difference" ? signed(value) : fixed(value)}</button></td>;
            })}<td className="br-overall"><button type="button" title={`${model.name} · 综合得分：${fixed(model.score)}`} onClick={() => onInspect(model)}>{mode === "difference" ? signed(model.score - overallMean) : fixed(model.score)}</button></td></tr>)}</tbody>
            <tfoot><tr><th scope="row">{mode === "difference" ? "基准均分" : "全体均分"}</th>{columns.map((key) => <td key={key}>{fixed(means[key])}</td>)}<td>{fixed(overallMean)}</td></tr></tfoot>
          </table>
        </div>
      </>}

      {tab === "scores" && <>{selected.length ? <><div className="br-score-meta"><span>四项评分指标</span><span>所选 {selected.length} 模型</span></div><div className="br-metric-grid">{METRICS.map((metric) => <div className="br-metric-block" key={metric.key}><div className="br-metric-title"><h4>{metric.label}</h4><span>{metric.unit}</span></div><div className="br-metric-bars">{selected.map((model) => <button type="button" className="br-bar-row" key={model.id} onClick={() => onInspect(model)} aria-label={`${model.name}，${metric.label}${fixed(model[metric.key])}${metric.unit}`}><span className="br-bar-model">{model.name}</span><span className="br-bar-track"><i style={{ width: `${model[metric.key]}%`, backgroundColor: model.color }} /></span><strong>{fixed(model[metric.key])}</strong></button>)}</div><div className="br-axis"><span>0</span><span>50</span><span>100</span></div></div>)}</div></> : <div className="br-empty">选择模型</div>}</>}

      {tab === "runtime" && <>{selected.length ? <>
        <RuntimeBenchmarkCharts models={selected} onInspect={onInspect} />
        <div className="br-table-scroll" tabIndex={0} aria-label="所选模型运行指标，可横向滚动"><table className="br-runtime-table"><thead><tr><th scope="col">模型</th><th scope="col">成本 <small>USD/题</small></th><th scope="col">平均耗时 <small>秒</small></th><th scope="col">P95 <small>秒</small></th><th scope="col">核验调用 <small>/题</small></th><th scope="col">答案长度 <small>token/题</small></th><th scope="col">运行失败 <small>题</small></th></tr></thead><tbody>{selected.map((model) => {
          const data = analytics.get(model.id)!; const calls = data.toolCalls.reduce((sum, tool) => sum + tool.value, 0);
          return <tr key={model.id}><th scope="row"><button className="br-model-link" type="button" onClick={() => onInspect(model)}><span className="br-color-dot" style={{ backgroundColor: model.color }} />{model.name}</button></th><td>${model.cost.toFixed(2)}</td><td>{fixed(model.latency)}</td><td>{fixed(data.p95Latency)}</td><td>{fixed(calls)}</td><td>{Math.round(data.answerTokens).toLocaleString()}</td><td><span className={data.failed ? "br-failed-value" : ""}>{data.failed}</span><small className="br-total">/{data.sampleCount}</small></td></tr>;
        })}</tbody></table></div>
        <details className="br-call-details"><summary>核验调用明细 <ChevronDown size={13} /></summary><div className="br-table-scroll" tabIndex={0} aria-label="核验工具调用明细"><table className="br-call-table"><thead><tr><th scope="col">模型</th>{toolKeys.map((tool) => <th scope="col" key={tool.key}>{tool.label}<small>/题</small></th>)}<th scope="col">合计<small>/题</small></th></tr></thead><tbody>{selected.map((model) => {
          const data = analytics.get(model.id)!;
          return <tr key={model.id}><th scope="row"><span className="br-inline-model"><i style={{ backgroundColor: model.color }} />{model.name}</span></th>{toolKeys.map((tool) => <td key={tool.key}>{fixed(data.toolCalls.find((item) => item.key === tool.key)?.value ?? 0)}</td>)}<td>{fixed(data.toolCalls.reduce((sum, tool) => sum + tool.value, 0))}</td></tr>;
        })}</tbody></table></div></details>
      </> : <div className="br-empty">选择模型</div>}</>}
    </div>
  </section>;
}
