"use client";
import { mockFetch } from "@/lib/mock-client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Check, CheckCircle2, ChevronDown, CircleAlert, FileText, LoaderCircle, X } from "lucide-react";
import type { CaseStudy, Model } from "@/lib/mock-data";
import "./research-dialogs.css";

type Close = { onClose: () => void };
const clamp = (n: number) => Math.min(100, Math.max(0, Number.isFinite(n) ? n : 0));
const num = (n: number, digits = 1) => Number.isFinite(n) ? n.toFixed(digits).replace(/\.0$/, "") : "—";
function displayText(value: string) {
  return value
    .replace(/\n\n演示判断步骤：[\s\S]*$/g, "")
    .replace(/【[^】]*(?:虚构|模拟|演示|DEMO)[^】]*】/gi, "")
    .replace(/以上回答使用虚构规则，不能作为实际税务意见。/g, "")
    .replace(/此段仅为界面演示而编写，不对应任何真实法条。/g, "")
    .replace(/；所有条件仅为演示设定/g, "")
    .replace(/\s*·\s*非真实法律依据|\s*·\s*非正式税务文件/g, "")
    .replace(/模拟|演示|虚构|DEMO[-_\s]?/gi, "")
    .replace(/\s*·\s*$/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
const subscribeMounted = () => () => {};
const clientMounted = () => true;
const serverMounted = () => false;

function DialogShell({ open, title, eyebrow, description, children, onClose, className = "" }: {
  open: boolean; title: string; eyebrow: string; description?: string; children: ReactNode; className?: string;
} & Close) {
  const mounted = useSyncExternalStore(subscribeMounted, clientMounted, serverMounted);
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  const titleId = useId(), descriptionId = useId();
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!mounted || !open || !ref.current) return;
    const dialog = ref.current;
    const prior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow, previousPadding = document.body.style.paddingRight;
    const gutter = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    const padding = parseFloat(getComputedStyle(document.body).paddingRight) || 0;
    document.body.style.overflow = "hidden";
    if (gutter) document.body.style.paddingRight = String(padding + gutter) + "px";
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLElement>("[data-rd-initial-focus]")?.focus({ preventScroll: true });
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeRef.current(); return; }
      if (event.key !== "Tab") return;
      const items = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])')].filter(el => el.getClientRects().length && !el.closest("[inert]"));
      const first = items[0], last = items[items.length - 1];
      if (!first || !last) { event.preventDefault(); dialog.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    dialog.addEventListener("keydown", keydown);
    return () => {
      dialog.removeEventListener("keydown", keydown); if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow; document.body.style.paddingRight = previousPadding;
      if (prior?.isConnected) prior.focus({ preventScroll: true });
    };
  }, [mounted, open]);
  if (!mounted || !open) return null;
  return createPortal(<dialog ref={ref} className={"rd-dialog " + className} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} aria-modal="true" tabIndex={-1}
    onCancel={e => { e.preventDefault(); onClose(); }}
    onClick={e => { if (e.target !== e.currentTarget) return; const b = e.currentTarget.getBoundingClientRect(); if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom) onClose(); }}>
    <header className="rd-header"><div><p className="rd-eyebrow">{eyebrow}</p><h2 id={titleId}>{title}</h2>{description && <p id={descriptionId} className="rd-description">{description}</p>}</div><button type="button" className="rd-icon-button" onClick={onClose} aria-label="关闭对话框" data-rd-initial-focus><X size={20} aria-hidden="true" /></button></header>{children}
  </dialog>, document.body);
}

export function CaseDialog({ item, onClose }: { item: CaseStudy | null } & Close) {
  return <DialogShell open={!!item} title={item ? displayText(item.title) : "案例详情"} eyebrow="CASE DETAILS / 案例详情" description={item ? [item.id, item.region, item.category, item.difficulty].map(displayText).join(" · ") : undefined} onClose={onClose} className="rd-case-dialog">{item && <CaseContent key={item.id} item={item} />}</DialogShell>;
}
type CaseTab = "score" | "question" | "answer" | "evidence";
function CaseContent({ item }: { item: CaseStudy }) {
  const [active, setActive] = useState<CaseTab>("score"), id = useId();
  const tabs: { id: CaseTab; label: string; count?: number }[] = [{ id: "score", label: "评分与扣分", count: item.checks.length }, { id: "question", label: "完整题面" }, { id: "answer", label: "模型回答" }, { id: "evidence", label: "依据与原文", count: item.evidence.length }];
  const earned = item.checks.reduce((sum, c) => sum + c.points, 0), possible = item.checks.reduce((sum, c) => sum + c.max, 0);
  return <>
    
    <div className="rd-tabs" role="tablist" aria-label="案例内容">{tabs.map((tab, index) => <button key={tab.id} type="button" role="tab" id={id + "-" + tab.id + "-tab"} aria-selected={active === tab.id} aria-controls={id + "-" + tab.id + "-panel"} tabIndex={active === tab.id ? 0 : -1} className={"rd-tab" + (active === tab.id ? " rd-active" : "")} onClick={() => setActive(tab.id)} onKeyDown={e => {
      const target = e.key === "ArrowRight" ? (index + 1) % tabs.length : e.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : -1;
      if (target < 0) return; e.preventDefault(); setActive(tabs[target].id); document.getElementById(id + "-" + tabs[target].id + "-tab")?.focus();
    }}>{tab.label}{tab.count !== undefined && <span>{tab.count}</span>}</button>)}</div>
    <div className="rd-scroll" role="tabpanel" id={id + "-" + active + "-panel"} aria-labelledby={id + "-" + active + "-tab"} tabIndex={0}>
      {active === "score" && <><div className="rd-case-summary"><div><span className="rd-label">综合得分</span><strong>{num(item.score)}<small>/ 100</small></strong></div><div className="rd-summary-copy"><p>{displayText(item.summary)}</p><div className="rd-tag-list">{item.tags.filter(tag => !/模拟|演示|虚构|DEMO|非真实/gi.test(tag)).map(tag => <span className="rd-tag" key={tag}>{tag}</span>)}</div></div></div>
        <div className="rd-section-heading"><h3>逐项评分</h3><span>采分合计 {num(earned)} / {num(possible)}</span></div>
        <div className="rd-check-list">{item.checks.map(c => { const lost = Math.max(0, c.max - c.points); return <article key={c.id} className="rd-check-card"><div className="rd-check-heading"><div>{lost ? <CircleAlert size={18} className="rd-amber" /> : <CheckCircle2 size={18} />}<span className="rd-check-id">{displayText(c.id)}</span><h4>{displayText(c.label)}</h4></div><strong>{num(c.points)}<span> / {num(c.max)}</span></strong></div><div className="rd-score-track" aria-hidden="true"><span style={{ width: String(c.max > 0 ? clamp(c.points / c.max * 100) : 0) + "%" }} /></div><p>{displayText(c.reason)}</p>{c.quote && <blockquote><span>回答原文</span>{displayText(c.quote)}</blockquote>}<span className={"rd-point-note" + (lost ? " rd-amber" : "")}>{lost ? "本项失分 " + num(lost) : "本项未失分"}</span></article>; })}</div></>}
      {active === "question" && <article className="rd-prose"><span className="rd-content-kicker">QUESTION / 题目</span><h3>{displayText(item.title)}</h3><p className="rd-preserve">{displayText(item.question)}</p></article>}
      {active === "answer" && <article className="rd-prose"><span className="rd-content-kicker">MODEL ANSWER / 模型回答</span><h3>{displayText(item.modelId)}</h3><p className="rd-preserve">{displayText(item.answer)}</p></article>}
      {active === "evidence" && <><div className="rd-section-heading"><h3>引用依据</h3></div><div className="rd-evidence-list">{item.evidence.map(s => <details key={s.id} className="rd-evidence-card"><summary><FileText size={18} /><div><span className="rd-source-id">{displayText(s.id)}</span><h4>{displayText(s.title)}</h4><p>{displayText(s.authority)} · {s.date}</p></div><span className="rd-source-status">{displayText(s.status)}</span><ChevronDown className="rd-chevron" size={18} /></summary><div className="rd-evidence-body"><p className="rd-preserve">{displayText(s.excerpt)}</p></div></details>)}</div></>}
    </div>
  </>;
}

export function CompareDialog({ models, onClose }: { models: Model[] } & Close) {
  const selected = models.slice(0, 3);
  return <DialogShell open={selected.length > 0} title="模型比较" eyebrow="MODEL COMPARISON / 模型对比" onClose={onClose} className="rd-compare-dialog">{selected.length > 0 && <CompareContent models={selected} />}</DialogShell>;
}
function CompareContent({ models }: { models: Model[] }) {
  const dims: { label: string; key: "score" | "accuracy" | "critical" | "citation" }[] = [{ label: "综合得分", key: "score" }, { label: "完整正确率", key: "accuracy" }, { label: "关键项通过", key: "critical" }, { label: "引用可靠性", key: "citation" }];
  const xy = (i: number, r: number) => { const a = -Math.PI / 2 + i * Math.PI / 2; return [190 + Math.cos(a) * r, 140 + Math.sin(a) * r]; };
  const polygon = (r: number) => dims.map((_, i) => xy(i, r).join(",")).join(" ");
  return <><div className="rd-scroll"><div className="rd-compare-top">
    <figure className="rd-radar"><figcaption>指标对比</figcaption><svg viewBox="0 0 380 280" role="img" aria-label="模型四项指标雷达图">
      {[25, 50, 75, 100].map(v => <polygon key={v} points={polygon(v * .91)} fill={v === 100 ? "#f7f9fc" : "none"} stroke="#dce5ef" />)}
      {dims.map((d, i) => { const p = xy(i, 91), l = xy(i, 120); return <g key={d.key}><line x1="190" y1="140" x2={p[0]} y2={p[1]} stroke="#dce5ef" /><text x={l[0]} y={l[1] + 4} textAnchor={i === 1 ? "start" : i === 3 ? "end" : "middle"}>{d.label}</text></g>; })}
      {models.map(m => <polygon key={m.id} points={dims.map((d, i) => xy(i, clamp(m[d.key]) * .91).join(",")).join(" ")} fill={m.color} fillOpacity=".08" stroke={m.color} strokeWidth="2"><title>{m.name + "：" + dims.map(d => d.label + num(m[d.key])).join("，")}</title></polygon>)}
    </svg><div className="rd-model-legend">{models.map(m => <span key={m.id}><i style={{ background: m.color }} />{displayText(m.name)}</span>)}</div></figure>
    <div className="rd-comparison-table-wrap"><table className="rd-comparison-table"><caption>指标对照</caption><thead><tr><th scope="col">指标</th>{models.map(m => <th key={m.id} scope="col"><span className="rd-model-dot" style={{ background: m.color }} />{displayText(m.name)}</th>)}</tr></thead><tbody>{dims.map(d => <tr key={d.key}><th scope="row">{d.label}</th>{models.map(m => <td key={m.id}>{num(m[d.key])}<span>{d.key === "score" ? " /100" : "%"}</span></td>)}</tr>)}<tr><th scope="row">成本 /题 </th>{models.map(m => <td key={m.id}>{"$" + num(m.cost, 3)}</td>)}</tr><tr><th scope="row">耗时 /题 </th>{models.map(m => <td key={m.id}>{num(m.latency)}<span> 秒</span></td>)}</tr></tbody></table></div>
    </div><div className="rd-breakdowns"><Breakdown title="按任务类型" field="categories" models={models} /><Breakdown title="按地区" field="regions" models={models} /></div></div>
    </>;
}
function Breakdown({ title, field, models }: { title: string; field: "regions" | "categories"; models: Model[] }) {
  const labels = [...new Set(models.flatMap(m => Object.keys(m[field])))];
  return <section className="rd-breakdown"><h3>{title}<span>得分 /100</span></h3>{labels.map(label => <div className="rd-bar-group" key={label}><h4>{label}</h4>{models.map(m => <div className="rd-bar-row" key={m.id}><span className="rd-bar-model" title={displayText(m.name)}>{displayText(m.name)}</span><div className="rd-bar-track"><span style={{ width: String(clamp(m[field][label] ?? 0)) + "%", background: m.color }} /></div><strong>{m[field][label] === undefined ? "—" : num(m[field][label])}</strong></div>)}</div>)}</section>;
}

const CONTACT_TYPES = ["业务合作", "模型参评", "学术合作"] as const;
type ContactType = typeof CONTACT_TYPES[number];
type ContactFields = { name: string; org: string; email: string; type: ContactType; message: string; consent: boolean };
type ContactErrors = Partial<Record<keyof ContactFields, string>>;
export function ContactDialog({ open, onClose, initialType }: { open: boolean; initialType?: string } & Close) {
  return <DialogShell open={open} title="合作咨询" eyebrow="CONTACT / 合作咨询" onClose={onClose} className="rd-contact-dialog"><ContactForm initialType={initialType} onClose={onClose} /></DialogShell>;
}
function ContactForm({ initialType, onClose }: { initialType?: string } & Close) {
  const id = useId(), firstType = CONTACT_TYPES.includes(initialType as ContactType) ? initialType as ContactType : "业务合作";
  const [form, setForm] = useState<ContactFields>({ name: "", org: "", email: "", type: firstType, message: "", consent: true });
  const [errors, setErrors] = useState<ContactErrors>({}), [submitError, setSubmitError] = useState(""), [pending, setPending] = useState(false), [receipt, setReceipt] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => requestRef.current?.abort(), []);
  const fieldId = (key: string) => id + "-" + key;
  function update<K extends keyof ContactFields>(key: K, value: ContactFields[K]) { setForm(p => ({ ...p, [key]: value })); setErrors(p => ({ ...p, [key]: undefined })); setSubmitError(""); }
  const errorText = (key: keyof ContactFields) => errors[key] ? <span className="rd-field-error" id={fieldId(key) + "-error"}>{errors[key]}</span> : null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending) return;
    const next: ContactErrors = {};
    if (form.name.trim().length < 2) next.name = "称呼至少2个字符。";
    if (!form.org.trim()) next.org = "请填写机构、团队或“独立研究者”。";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = "邮箱格式不正确。";
    if (form.message.trim().length < 10) next.message = "需求说明至少10个字符。";
    setErrors(next); if (Object.keys(next).length) { document.getElementById(fieldId(Object.keys(next)[0]))?.focus(); return; }
    setPending(true); setSubmitError("");
    const controller = new AbortController(); requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await mockFetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, name: form.name.trim(), org: form.org.trim(), email: form.email.trim(), message: form.message.trim() }), signal: controller.signal });
      const data = await response.json().catch(() => null) as { error?: string; message?: string; receipt?: unknown; fieldErrors?: ContactErrors } | null;
      if (!response.ok) { if (data?.fieldErrors) setErrors(data.fieldErrors); throw new Error(data?.error || data?.message || "提交失败（HTTP " + response.status + "），请重试。"); }
      const raw = data?.receipt; setReceipt(typeof raw === "string" ? raw : raw && typeof raw === "object" && "id" in raw ? String(raw.id) : "RECEIVED");
    } catch (error) { setSubmitError(controller.signal.aborted ? "请求超时或已取消，请重试。" : error instanceof Error ? error.message : "提交失败，请稍后重试。"); }
    finally { window.clearTimeout(timeout); setPending(false); }
  }
  if (receipt) return <div className="rd-success rd-scroll" role="status" aria-live="polite"><span className="rd-success-icon"><Check size={26} /></span><h3>提交完成</h3><div className="rd-receipt"><span>回执编号</span><code>{displayText(receipt)}</code></div><button type="button" className="rd-button rd-primary" onClick={onClose}>返回页面<ArrowRight size={16} /></button></div>;
  const propsFor = (key: keyof ContactFields) => ({ id: fieldId(key), name: key, "aria-invalid": Boolean(errors[key]), "aria-describedby": errors[key] ? fieldId(key) + "-error" : undefined, disabled: pending });
  return <><form className="rd-contact-form rd-scroll" onSubmit={submit} noValidate aria-busy={pending}>
    <div className="rd-form-grid">
      <label className="rd-field" htmlFor={fieldId("name")}>称呼 <span className="rd-required">*</span><input {...propsFor("name")} value={form.name} maxLength={80} autoComplete="off" placeholder="姓名" onChange={e => update("name", e.target.value)} />{errorText("name")}</label>
      <label className="rd-field" htmlFor={fieldId("org")}>机构 / 团队 <span className="rd-required">*</span><input {...propsFor("org")} value={form.org} maxLength={160} autoComplete="off" placeholder="机构或团队名称" onChange={e => update("org", e.target.value)} />{errorText("org")}</label>
      <label className="rd-field rd-field-wide" htmlFor={fieldId("email")}>邮箱 <span className="rd-required">*</span><input {...propsFor("email")} type="email" value={form.email} maxLength={160} autoComplete="off" placeholder="you@example.com" onChange={e => update("email", e.target.value)} />{errorText("email")}</label>
      <label className="rd-field rd-field-wide" htmlFor={fieldId("type")}>咨询方向<select {...propsFor("type")} value={form.type} onChange={e => update("type", e.target.value as ContactType)}>{CONTACT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</select></label>
      <label className="rd-field rd-field-wide" htmlFor={fieldId("message")}>需求说明 <span className="rd-required">*</span><textarea {...propsFor("message")} value={form.message} maxLength={2000} rows={4} placeholder="合作需求" onChange={e => update("message", e.target.value)} /><span className="rd-character-count">{form.message.length} / 2000</span>{errorText("message")}</label>
    </div>
    {submitError && <div className="rd-form-alert" role="alert"><CircleAlert size={17} /><span>{displayText(submitError)}</span></div>}
    <div className="rd-form-actions"><button type="button" className="rd-button rd-secondary" onClick={onClose}>取消</button><button type="submit" className="rd-button rd-primary" disabled={pending}>{pending ? <><LoaderCircle className="rd-spin" size={16} />提交中</> : <>提交咨询<ArrowRight size={16} /></>}</button></div>
  </form></>;
}
