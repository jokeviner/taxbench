"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";
import type { Model } from "@/lib/mock-data";
import { getModelAnalytics, BENCHMARK_PROTOCOL, type ModelAnalytics } from "@/lib/benchmark-analytics";
import "./model-benchmark-dialog.css";

// Presentation only. All report values come from deterministic local prototype data.
type Props = { model: Model | null; models: Model[]; onClose: () => void; onModelChange: (model: Model) => void };
type Metric = "score" | "accuracy" | "critical" | "citation";
type ReportTab = "overview" | "runtime" | "settings";
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
const clean = (value: string) => value.replace(/\s*·\s*虚构/g, "").replace(/[-_ ]?demo/gi, "").replace(/模拟|演示|虚构/g, "").trim();
const format = (value: number, digits = 1) => Number.isFinite(value) ? value.toFixed(digits).replace(/\.0$/, "") : "—";
const bounded = (value: number) => Math.min(100, Math.max(0, value));
const metrics: { key: Metric; label: string; unit: string }[] = [
  { key: "score", label: "综合得分", unit: "/100" },
  { key: "accuracy", label: "完整正确率", unit: "%" },
  { key: "critical", label: "关键项通过率", unit: "%" },
  { key: "citation", label: "引用可靠性", unit: "%" },
];

export function ModelBenchmarkDialog({ model, models, onClose, onModelChange }: Props) {
  const mounted = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const ref = useRef<HTMLDialogElement>(null), closeRef = useRef(onClose);
  const titleId = useId(), open = Boolean(model);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!mounted || !open || !ref.current) return;
    const dialog = ref.current;
    const prior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow, padding = document.body.style.paddingRight;
    const gap = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    document.body.style.overflow = "hidden";
    if (gap) document.body.style.paddingRight = String((parseFloat(getComputedStyle(document.body).paddingRight) || 0) + gap) + "px";
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLElement>("[data-mbd-initial-focus]")?.focus({ preventScroll: true });
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeRef.current(); return; }
      if (event.key !== "Tab") return;
      const items = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(el => el.tabIndex >= 0 && el.getClientRects().length > 0 && !el.closest("[inert]"));
      const first = items[0], last = items[items.length - 1];
      if (!first || !last) { event.preventDefault(); dialog.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    dialog.addEventListener("keydown", keydown);
    return () => {
      dialog.removeEventListener("keydown", keydown);
      if (dialog.open) dialog.close();
      document.body.style.overflow = overflow; document.body.style.paddingRight = padding;
      if (prior?.isConnected) prior.focus({ preventScroll: true });
    };
  }, [mounted, open]);
  if (!mounted || !model) return null;
  const peers = models.some(item => item.id === model.id) ? models : [...models, model];
  return createPortal(<dialog ref={ref} className="mbd-dialog" aria-labelledby={titleId} aria-modal="true" tabIndex={-1} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const box = event.currentTarget.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
  }}>
    <header className="mbd-header">
      <div className="mbd-heading"><span className="mbd-model-dot" style={{ background: model.color }} /><div><span className="mbd-kicker">MODEL BENCHMARK</span><h2 id={titleId}>{clean(model.name)}</h2><p>{clean(model.provider)}<span>版本 {clean(model.version)}</span><span>{BENCHMARK_PROTOCOL.publishedAt}</span></p></div></div>
      <div className="mbd-header-actions"><label className="mbd-model-select"><span>模型</span><select value={model.id} aria-label="切换模型报告" onChange={event => { const next = peers.find(item => item.id === event.target.value); if (next) onModelChange(next); }}>{peers.map(item => <option key={item.id} value={item.id}>{clean(item.name)}</option>)}</select><ChevronDown size={13} aria-hidden="true" /></label><button className="mbd-close" type="button" aria-label="关闭模型报告" data-mbd-initial-focus onClick={onClose}><X size={19} /></button></div>
    </header>
    <ModelReport model={model} models={peers} />
  </dialog>, document.body);
}

function ModelReport({ model, models }: { model: Model; models: Model[] }) {
  const [tab, setTab] = useState<ReportTab>("overview"), id = useId();
  const analytics = getModelAnalytics(model);
  const rank = (key: Metric) => 1 + models.filter(peer => peer[key] > model[key]).length;
  const tabs: { key: ReportTab; label: string }[] = [{ key: "overview", label: "结果概览" }, { key: "runtime", label: "运行与错误" }, { key: "settings", label: "评测设置" }];
  return <>
    <div className="mbd-metric-strip">{metrics.map(metric => <div key={metric.key}><span>{metric.label}</span><strong>{format(model[metric.key])}<small>{metric.unit}</small></strong><em>排名 {rank(metric.key)}<span> / {models.length}</span></em></div>)}</div>
    <div className="mbd-tabs" role="tablist" aria-label="模型报告">
      {tabs.map((item, index) => <button key={item.key} type="button" role="tab" id={id + "-" + item.key + "-tab"} aria-controls={id + "-" + item.key + "-panel"} aria-selected={tab === item.key} tabIndex={tab === item.key ? 0 : -1} className={tab === item.key ? "mbd-active" : ""} onClick={() => setTab(item.key)} onKeyDown={event => {
        const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
        if (next < 0) return; event.preventDefault(); setTab(tabs[next].key); document.getElementById(id + "-" + tabs[next].key + "-tab")?.focus();
      }}>{item.label}</button>)}
    </div>
    <div className="mbd-content" role="tabpanel" id={id + "-" + tab + "-panel"} aria-labelledby={id + "-" + tab + "-tab"} tabIndex={0}>
      {tab === "overview" && <Overview model={model} models={models} />}
      {tab === "runtime" && <Runtime model={model} analytics={analytics} />}
      {tab === "settings" && <Settings model={model} analytics={analytics} />}
    </div>
  </>;
}

function ScoreBars({ title, values, color }: { title: string; values: Record<string, number>; color: string }) {
  return <section className="mbd-section"><div className="mbd-section-title"><h3>{title}</h3><span>得分 /100</span></div><div className="mbd-score-bars">{Object.entries(values).map(([label, value]) => <div className="mbd-score-row" key={label}><span>{label}</span><div className="mbd-track"><i style={{ width: String(bounded(value)) + "%", background: color }} /></div><b>{format(value)}</b></div>)}</div></section>;
}
function Overview({ model, models }: { model: Model; models: Model[] }) {
  const groups = [{ name: "任务类型", entries: Object.entries(model.categories) }, { name: "地区", entries: Object.entries(model.regions) }];
  return <>
    <div className="mbd-two-columns"><ScoreBars title="任务类型" values={model.categories} color={model.color} /><ScoreBars title="地区" values={model.regions} color={model.color} /></div>
    <section className="mbd-section"><div className="mbd-section-title"><h3>最高与最低得分</h3></div><div className="mbd-table-wrap"><table className="mbd-table"><thead><tr><th>维度</th><th>最高</th><th>得分</th><th>最低</th><th>得分</th><th>差值</th></tr></thead><tbody>{groups.map(group => {
      const sorted = [...group.entries].sort((a, b) => b[1] - a[1]), best = sorted[0], worst = sorted[sorted.length - 1];
      return best && worst ? <tr key={group.name}><th scope="row">{group.name}</th><td>{best[0]}</td><td className="mbd-number">{format(best[1])}</td><td>{worst[0]}</td><td className="mbd-number">{format(worst[1])}</td><td className="mbd-number">{format(best[1] - worst[1])}</td></tr> : null;
    })}</tbody></table></div></section>
    <section className="mbd-section"><div className="mbd-section-title"><h3>指标排名</h3><span>{models.length} 个模型</span></div><div className="mbd-table-wrap"><table className="mbd-table"><thead><tr><th>指标</th><th>当前值</th><th>排名</th><th>首位值</th><th>距首位</th></tr></thead><tbody>{metrics.map(metric => {
      const best = Math.max(...models.map(peer => peer[metric.key])), rank = 1 + models.filter(peer => peer[metric.key] > model[metric.key]).length;
      return <tr key={metric.key}><th scope="row">{metric.label}</th><td className="mbd-number">{format(model[metric.key])}</td><td className="mbd-number">{rank} / {models.length}</td><td className="mbd-number">{format(best)}</td><td className="mbd-number">{format(best - model[metric.key])}</td></tr>;
    })}</tbody></table></div></section>
  </>;
}

function Runtime({ model, analytics }: { model: Model; analytics: ModelAnalytics }) {
  const calls = analytics.toolCalls.reduce((sum, item) => sum + item.value, 0);
  const errors = analytics.errorBreakdown.reduce((sum, item) => sum + item.count, 0);
  const palette = ["#426d9a", "#7896b6", "#a3b5c9", "#ccd7e3"];
  const citationColors = ["#577c93", "#a5b5c7", "#cbd5df"];
  const facts = [
    ["执行完成", analytics.completed + " / " + analytics.sampleCount + " 题"],
    ["执行失败", analytics.failed + " 题"],
    ["每题答题轮次", format(analytics.turns)],
    ["回答长度", analytics.answerTokens.toLocaleString("en-US") + " tokens /题"],
    ["参考答案长度", analytics.referenceTokens.toLocaleString("en-US") + " tokens /题"],
    ["平均耗时", format(model.latency) + " 秒"],
    ["P95 耗时", format(analytics.p95Latency) + " 秒"],
    ["答题成本", "$" + format(model.cost, 2) + " /题"],
  ];
  return <>
    <section className="mbd-section"><div className="mbd-section-title"><h3>答题运行</h3><span>{analytics.sampleCount} 题</span></div><dl className="mbd-facts">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><div className="mbd-execution-bar" aria-label={"执行完成 " + analytics.completed + " 题，失败 " + analytics.failed + " 题"}><span style={{ width: String(analytics.completed / analytics.sampleCount * 100) + "%" }} /><i style={{ width: String(analytics.failed / analytics.sampleCount * 100) + "%" }} /></div></section>
    <div className="mbd-two-columns">
      <section className="mbd-section"><div className="mbd-section-title"><h3>依据核验 · 工具调用 / 题</h3><span>合计 {format(calls)} 次</span></div><div className="mbd-stack" aria-label="核验工具调用占比">{analytics.toolCalls.map((item, index) => <i key={item.key} style={{ width: String(calls ? item.value / calls * 100 : 0) + "%", background: palette[index % palette.length] }} title={item.label + " " + format(item.value) + "次/题"} />)}</div><div className="mbd-distribution">{analytics.toolCalls.map((item, index) => <div key={item.key}><span><i style={{ background: palette[index % palette.length] }} />{item.label}</span><b>{format(item.value)} 次</b><em>{format(calls ? item.value / calls * 100 : 0)}%</em></div>)}</div></section>
      <section className="mbd-section"><div className="mbd-section-title"><h3>引用支持分布</h3><span>占核验引用</span></div><div className="mbd-stack" aria-label="引用支持比例">{analytics.citationBreakdown.map((item, index) => <i key={item.label} style={{ width: String(bounded(item.value)) + "%", background: citationColors[index % citationColors.length] }} title={item.label + " " + format(item.value) + "%"} />)}</div><div className="mbd-distribution">{analytics.citationBreakdown.map((item, index) => <div key={item.label}><span><i style={{ background: citationColors[index % citationColors.length] }} />{item.label}</span><b>{format(item.value)}%</b></div>)}</div></section>
    </div>
    <section className="mbd-section"><div className="mbd-section-title"><h3>未完整通过的主要原因</h3><span>{errors} 题</span></div><div className="mbd-error-bars">{analytics.errorBreakdown.map(item => <div key={item.label}><span>{item.label}</span><div className="mbd-track"><i style={{ width: String(errors ? item.count / errors * 100 : 0) + "%" }} /></div><b>{item.count} 题</b><em>{format(errors ? item.count / errors * 100 : 0)}%</em></div>)}</div></section>
  </>;
}

function Settings({ model, analytics }: { model: Model; analytics: ModelAnalytics }) {
  const protocol = BENCHMARK_PROTOCOL;
  const sections: { title: string; rows: [string, string][] }[] = [
    { title: "评测协议", rows: [["协议版本", protocol.version], ["发布日期", protocol.publishedAt], ["评测题数", String(protocol.questionCount)], ["运行轨道", protocol.track]] },
    { title: "运行参数", rows: [["Temperature", String(protocol.temperature)], ["最大输出", protocol.maxOutputTokens.toLocaleString("en-US") + " tokens"], ["单题时限", protocol.timeoutSeconds + " 秒"], ["每题答题轮次", String(analytics.turns)], ["答题工具调用", "0"]]},
    { title: "模型与评分", rows: [["模型", clean(model.name)], ["模型 ID", model.id], ["提供方", clean(model.provider)], ["模型版本", clean(model.version)], ["评分版本", protocol.scoringVersion]] },
  ];
  return <div className="mbd-settings">{sections.map(section => <section className="mbd-section" key={section.title}><div className="mbd-section-title"><h3>{section.title}</h3></div><dl>{section.rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>)}</div>;
}
