"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { regions, type CaseStudy, type Model } from "@/lib/mock-data";
import { getCaseResponses, getCaseQuestion, getCaseEvidence } from "@/lib/case-responses";
import "./case-explorer.css";

type Props = { cases: CaseStudy[]; models: Model[] };
const scoreLabel = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1);
const publicCode = (value: string) => value.replace(/^DEMO-/, "");

export default function CaseExplorer({ cases, models }: Props) {
  const [region, setRegion] = useState("");
  const [caseId, setCaseId] = useState(cases[0]?.id ?? "");
  const [modelId, setModelId] = useState(cases[0]?.modelId ?? models[0]?.id ?? "");
  const [responseOpen, setResponseOpen] = useState(true);
  const filtered = useMemo(() => region ? cases.filter((item) => item.region === region) : cases, [cases, region]);
  const activeCase = filtered.find((item) => item.id === caseId) ?? filtered[0];
  const responses = useMemo(() => activeCase ? getCaseResponses(activeCase, models) : [], [activeCase, models]);
  const response = responses.find((item) => item.modelId === modelId) ?? responses[0];
  const activeModel = models.find((item) => item.id === response?.modelId);
  const evidence = useMemo(() => activeCase ? getCaseEvidence(activeCase) : [], [activeCase]);
  const tabBar = useRef<HTMLDivElement | null>(null);
  const tabElements = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const bar = tabBar.current;
    const button = response ? tabElements.current[response.modelId] : null;
    if (!bar || !button) return;
    const left = button.offsetLeft;
    const right = left + button.offsetWidth;
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    if (left < bar.scrollLeft) bar.scrollTo({ left: Math.max(0, left - 6), behavior });
    else if (right > bar.scrollLeft + bar.clientWidth) bar.scrollTo({ left: right - bar.clientWidth + 6, behavior });
  }, [response?.modelId, activeCase?.id, response]);

  function chooseCase(id: string) { setCaseId(id); setResponseOpen(true); }
  function chooseRegion(next: string) {
    setRegion(next);
    const nextCases = next ? cases.filter((item) => item.region === next) : cases;
    if (!nextCases.some((item) => item.id === caseId)) setCaseId(nextCases[0]?.id ?? "");
    setResponseOpen(true);
  }
  function chooseModel(id: string) { setModelId(id); setResponseOpen(true); }
  function moveTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % responses.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + responses.length) % responses.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = responses.length - 1;
    else return;
    event.preventDefault();
    const target = responses[next];
    if (!target) return;
    chooseModel(target.modelId); tabElements.current[target.modelId]?.focus({ preventScroll: true });
  }

  if (!activeCase || !response) return <div className="ce-empty">暂无案例</div>;
  const maximum = response.checks.reduce((sum, check) => sum + check.max, 0);
  const selectionKey = `${activeCase.id}-${response.modelId}`;
  const paragraphs = response.answer.split(/\n\s*\n|\n/).map((paragraph) => paragraph.trim()).filter(Boolean);

  return <div className="ce-explorer">
    <div className="ce-regions" role="group" aria-label="按地区筛选案例">{["", ...regions].map((item) => <button type="button" key={item || "all"} className={region === item ? "ce-region ce-region-active" : "ce-region"} aria-pressed={region === item} onClick={() => chooseRegion(item)}>{item || "全部"}</button>)}</div>
    <div className="ce-case-options" role="group" aria-label="选择案例">{filtered.map((item) => <button key={item.id} type="button" className={activeCase.id === item.id ? "ce-case-option ce-case-option-active" : "ce-case-option"} aria-pressed={activeCase.id === item.id} onClick={() => chooseCase(item.id)}><span className="ce-case-option-meta"><span>{item.region}</span><small>{publicCode(item.id)}</small></span><strong>{item.title}</strong></button>)}</div>

    <article className="ce-viewer">
      <section className="ce-question" aria-label="案例题目"><div className="ce-question-heading"><h3>QUESTION</h3><div className="ce-question-tags"><span>{publicCode(activeCase.id)}</span><span>{activeCase.category}</span></div></div><p>{getCaseQuestion(activeCase)}</p></section>

      <div className="ce-model-tabs" ref={tabBar} role="tablist" aria-label="同题模型回答">{responses.map((item, index) => {
        const model = models.find((candidate) => candidate.id === item.modelId);
        const selected = response.modelId === item.modelId;
        return <button key={item.modelId} type="button" ref={(element) => { tabElements.current[item.modelId] = element; }} id={`ce-model-${item.modelId}`} role="tab" aria-selected={selected} aria-controls="ce-response-panel" tabIndex={selected ? 0 : -1} className={selected ? "ce-model-tab ce-model-tab-active" : "ce-model-tab"} onClick={() => chooseModel(item.modelId)} onKeyDown={(event) => moveTab(event, index)}><span className="ce-model-name"><i style={{ backgroundColor: model?.color ?? "#71869b" }} />{model?.name ?? item.modelId}</span><b>{scoreLabel(item.score)}</b></button>;
      })}</div>

      <div className="ce-response-panel" id="ce-response-panel" role="tabpanel" aria-labelledby={`ce-model-${response.modelId}`}>
        <div className="ce-response-heading"><button type="button" className="ce-response-toggle" onClick={() => setResponseOpen(!responseOpen)} aria-expanded={responseOpen} aria-controls="ce-response-body"><span>RESPONSE</span>{responseOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button><span className="ce-active-model">{activeModel?.name ?? response.modelId}</span></div>
        {responseOpen && <div className="ce-response-body" id="ce-response-body">{paragraphs.map((paragraph, index) => <p key={`${selectionKey}-${index}`}>{paragraph}</p>)}</div>}

        <div className="ce-score-footer"><div className={`ce-score-box ${response.score >= 85 ? "ce-score-high" : response.score >= 65 ? "ce-score-mid" : "ce-score-low"}`}><span>SCORE</span><strong>{scoreLabel(response.score)}<small>/{maximum}</small></strong><div className="ce-score-track"><i style={{ width: `${maximum ? response.score / maximum * 100 : 0}%` }} /></div></div><div className="ce-missed"><h4>MISSED CHECKS <span>{response.missedChecks.length}</span></h4>{response.missedChecks.length ? <p className="ce-missed-summary">{response.missedChecks.map((check) => check.reason.replace(/[。；\s]+$/g, "")).join("；")}。</p> : <p className="ce-all-passed"><CheckCircle2 size={14} /> 全部采分项通过</p>}</div></div>
      </div>

      <div className="ce-details-group">
        <details className="ce-details" key={`${selectionKey}-checks`}><summary><span>逐项评分 <small>{response.checks.length}</small></span><ChevronDown size={14} /></summary><div className="ce-check-list">{response.checks.map((check) => <div className="ce-check" key={check.id}><div className="ce-check-heading"><h4>{check.label}</h4><span className={check.points === check.max ? "ce-check-score ce-check-passed" : "ce-check-score"}>{scoreLabel(check.points)}<small>/{check.max}</small></span></div><p>{check.reason}</p><blockquote>{check.quote}</blockquote></div>)}</div></details>
        <details className="ce-details" key={`${selectionKey}-evidence`}><summary><span>参考依据 <small>{evidence.length}</small></span><ChevronDown size={14} /></summary><div className="ce-evidence-list">{evidence.map((source) => <div className="ce-evidence" key={source.id}><div className="ce-evidence-heading"><h4>{source.title}</h4><span>{publicCode(source.id)}</span></div><div className="ce-evidence-meta"><span>{source.authority}</span><time dateTime={source.date}>{source.date}</time></div><blockquote>{source.excerpt}</blockquote></div>)}</div></details>
      </div>
    </article>
  </div>;
}
