"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ArrowRight, Check, CheckCircle2, ChevronDown, ChevronUp, CircleHelp, Eye, EyeOff, FileSearch, FlaskConical, KeyRound, LoaderCircle, RotateCcw, ShieldCheck, Square, TriangleAlert, X } from "lucide-react";
import type { Model } from "@/lib/mock-data";
import { mockFetch } from "@/lib/mock-client";
import "./trial-workspace.css";

const DEMO_ENDPOINT = "https://demo.taxbench.example/v1";
const DEMO_KEY = "demo_taxbench_public";
const VERIFIER_NAME = "TaxVerify";
const CATEGORIES = ["规则与来源适用", "数值与计算", "表格与申报", "争议处理与裁判适用", "年度与规则变化", "事实情境分析"];
type Phase = "idle" | "starting" | "running" | "completed" | "failed" | "cancelled";
type Question = { id: string; question: string; answer: string; score: number; maxScore: number; deductions: string[] };
type TrialResult = { score: number; correct: number; critical: number; total: number; tokens: number; duration: number; questions: Question[] };
type Claim = { id: string; text: string; status: "supported" | "uncertain" | "conflicting"; explanation: string; source: { title: string; code: string; excerpt: string; region: string; year: string | number } };
type VerifyResult = { supported: number; uncertain: number; conflicting: number; claims: Claim[] };
type TrialResponse = { id: string; status: "running" | "completed" | "failed"; progress: number; stage: string; current: number; total: number; result?: TrialResult; error?: string };
type VerifyResponse = { status: "running" | "completed" | "failed"; progress: number; stage: string; result?: VerifyResult; error?: string };
type TrialConfig = { modelId: string; endpoint: string; questionCount: 5 | 8 | 10; category?: string; simulateFailure?: boolean };
type FieldErrors = { endpoint?: string; key?: string };

function aborted(error: unknown) { return error instanceof Error && error.name === "AbortError"; }
function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException("Cancelled", "AbortError")); return; }
    const cancel = () => { clearTimeout(timer); reject(new DOMException("Cancelled", "AbortError")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", cancel); resolve(); }, ms);
    signal.addEventListener("abort", cancel, { once: true });
  });
}
async function request<T>(path: string, signal: AbortSignal, body?: unknown): Promise<T> {
  const response = await mockFetch(path, { method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json" }, signal, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  let data: T & { error?: string };
  try { data = await response.json(); } catch { throw new Error("服务未响应，请重试。"); }
  if (!response.ok) throw new Error(data.error || "请求失败，请重试。");
  return data;
}
function errorText(error: unknown) { return error instanceof Error ? error.message : "连接中断，请重试。"; }
function download(value: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}


function displayText(value: string) {
  return value
    .replace(/【[^】]*(?:模拟|演示|虚构|非真实)[^】]*】/g, "")
    .replace(/[（(][^）)]*(?:模拟|演示|虚构|非真实)[^）)]*[）)]/g, "")
    .replace(/；本条[^。\n]*(?:模拟|演示|真实法源)[^。\n]*[。]?/g, "。")
    .replace(/关闭失败模拟/g, "关闭连接失败测试")
    .replace(/，(?:也)?不能[^。！？\n]*(?:真实税务结论|实际税额)[。]?/g, "。")
    .replace(/，?不使用任何真实[^。！？\n]*([。！？]?)/g, "$1")
    .replace(/，?不引用真实判例/g, "")
    .split(/(?<=[。！？])|\n/)
    .filter((sentence) => /请|应如何|能否/.test(sentence) || !/不代表|不构成|不作为税务|不涉及真实|不对应任何真实|不对应真实|不证明任何真实|不能[^。]*(?:真实税务|实际税额)|不是实际|仅为交互|仅解释演示|仅为界面|不来自私有|不提供真实税率|不是真实|没有真实(?:法律|税率)/.test(sentence))
    .map((sentence) => sentence.replace(/非真实(?:法律依据|税法|法源)/g, "").replace(/(?:模拟|演示|虚构)(?:的)?/g, "").replace(/\s*·\s*$/g, "").trim())
    .filter(Boolean)
    .join("\n");
}

export default function TrialWorkspace({ models }: { models: Model[] }) {
  const [modelName, setModelName] = useState("");
  const [endpoint, setEndpoint] = useState(DEMO_ENDPOINT);
  const [apiKey, setApiKey] = useState(DEMO_KEY);
  const [showKey, setShowKey] = useState(false);
  const [category, setCategory] = useState("");
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [phase, setPhase] = useState<Phase>("idle");
  const [trial, setTrial] = useState<TrialResponse | null>(null);
  const [message, setMessage] = useState("");
  const [jobId, setJobId] = useState("");
  const [runModel, setRunModel] = useState("");
  const [runQuestionCount, setRunQuestionCount] = useState(5);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [questionId, setQuestionId] = useState("");
  const [verifyPhase, setVerifyPhase] = useState<Phase>("idle");
  const [verification, setVerification] = useState<VerifyResponse | null>(null);
  const [verifyMessage, setVerifyMessage] = useState("");
  const [verifyId, setVerifyId] = useState("");
  const [verifiedQuestion, setVerifiedQuestion] = useState("");
  const [verifiedBy, setVerifiedBy] = useState("");
  const trialController = useRef<AbortController | null>(null);
  const verifyController = useRef<AbortController | null>(null);
  const lastConfig = useRef<TrialConfig | null>(null);
  const trialFailure = useRef<"create" | "poll" | "job">("create");
  const verifyFailure = useRef<"create" | "poll" | "job">("create");
  const result = phase === "completed" ? trial?.result : undefined;
  const busy = phase === "starting" || phase === "running";
  const verifyBusy = verifyPhase === "starting" || verifyPhase === "running";

  useEffect(() => () => { trialController.current?.abort(); verifyController.current?.abort(); }, []);

  function clearVerification() {
    verifyController.current?.abort(); setVerifyPhase("idle"); setVerification(null); setVerifyMessage(""); setVerifyId(""); setVerifiedQuestion("");
  }
  function preset() {
    setEndpoint(DEMO_ENDPOINT); setApiKey(DEMO_KEY); setCategory(""); setSimulateFailure(false); setErrors({});
  }
  async function pollTrial(id: string, controller: AbortController) {
    trialFailure.current = "poll";
    try {
      for (let tick = 0; tick < 120; tick++) {
        const data = await request<TrialResponse>(`/api/trials/${encodeURIComponent(id)}`, controller.signal);
        if (controller.signal.aborted) return;
        setTrial(data);
        if (data.status === "completed" && data.result) {
          setPhase("completed"); setExpanded(data.result.questions[0]?.id ?? null); setQuestionId(data.result.questions[0]?.id ?? ""); return;
        }
        if (data.status === "failed") { trialFailure.current = "job"; setPhase("failed"); setMessage(data.error || "连接失败，配置已保留。"); return; }
        await delay(700, controller.signal);
      }
      throw new Error("获取结果超时，请重试。");
    } catch (error) { if (!aborted(error) && !controller.signal.aborted) { setPhase("failed"); setMessage(errorText(error)); } }
  }
  async function startTrial(usePreset = false, retryConfig?: TrialConfig) {
    const actualModel = retryConfig?.modelId ?? models[0]?.id ?? "atlas-pro";
    const actualName = retryConfig ? runModel : modelName.trim() || "未命名模型";
    const actualEndpoint = retryConfig?.endpoint ?? (usePreset ? DEMO_ENDPOINT : endpoint.trim());
    const actualKey = usePreset ? DEMO_KEY : apiKey.trim();
    const nextErrors: FieldErrors = {};
    if (actualEndpoint !== DEMO_ENDPOINT) nextErrors.endpoint = "请使用预设配置。";
    if (actualKey !== DEMO_KEY) nextErrors.key = "请使用预设配置。";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    if (usePreset) preset();
    trialController.current?.abort(); clearVerification();
    const controller = new AbortController(); trialController.current = controller;
    const config: TrialConfig = retryConfig ?? { modelId: actualModel, endpoint: actualEndpoint, questionCount: 5, ...(usePreset || !category ? {} : { category }), simulateFailure: usePreset ? false : simulateFailure };
    lastConfig.current = config; setRunQuestionCount(config.questionCount); setPhase("starting"); setTrial(null); setMessage(""); setJobId(""); setExpanded(null); setRunModel(actualName);
    trialFailure.current = "create";
    try {
      // The demonstration key stays in this component and is never sent in a request.
      const created = await request<{ id: string }>("/api/trials", controller.signal, config);
      if (controller.signal.aborted) return;
      setJobId(created.id); setPhase("running"); await pollTrial(created.id, controller);
    } catch (error) { if (!aborted(error) && !controller.signal.aborted) { setPhase("failed"); setMessage(errorText(error)); } }
  }
  function retryTrial() {
    setMessage("");
    if (trialFailure.current === "poll" && jobId) {
      trialController.current?.abort(); const controller = new AbortController(); trialController.current = controller; setPhase("running"); void pollTrial(jobId, controller);
    } else { setSimulateFailure(false); void startTrial(false, lastConfig.current ? { ...lastConfig.current, simulateFailure: false } : undefined); }
  }
  function cancelTrial() { trialController.current?.abort(); setPhase("cancelled"); setMessage("已取消，配置已保留。"); }
  function reset() { trialController.current?.abort(); clearVerification(); setPhase("idle"); setTrial(null); setMessage(""); setJobId(""); setExpanded(null); setQuestionId(""); setErrors({}); }
  async function pollVerification(id: string, controller: AbortController) {
    verifyFailure.current = "poll";
    try {
      for (let tick = 0; tick < 100; tick++) {
        const data = await request<VerifyResponse>(`/api/verify/${encodeURIComponent(id)}`, controller.signal);
        if (controller.signal.aborted) return;
        setVerification(data);
        if (data.status === "completed" && data.result) { setVerifyPhase("completed"); return; }
        if (data.status === "failed") { verifyFailure.current = "job"; setVerifyPhase("failed"); setVerifyMessage(data.error || "依据核验失败，请重试。"); return; }
        await delay(700, controller.signal);
      }
      throw new Error("获取核验结果超时，请重试。");
    } catch (error) { if (!aborted(error) && !controller.signal.aborted) { setVerifyPhase("failed"); setVerifyMessage(errorText(error)); } }
  }
  async function startVerification(selectedQuestion = questionId) {
    if (!jobId || !result || !selectedQuestion) return;
    verifyController.current?.abort(); const controller = new AbortController(); verifyController.current = controller;
    setQuestionId(selectedQuestion); setVerifiedQuestion(selectedQuestion); setVerifiedBy(VERIFIER_NAME); setVerifyPhase("starting"); setVerification(null); setVerifyMessage(""); verifyFailure.current = "create";
    try {
      const created = await request<{ id: string }>("/api/verify", controller.signal, { jobId, questionId: selectedQuestion });
      if (controller.signal.aborted) return;
      setVerifyId(created.id); setVerifyPhase("running"); await pollVerification(created.id, controller);
    } catch (error) { if (!aborted(error) && !controller.signal.aborted) { setVerifyPhase("failed"); setVerifyMessage(errorText(error)); } }
  }
  function retryVerification() {
    if (verifyFailure.current === "poll" && verifyId) {
      verifyController.current?.abort(); const controller = new AbortController(); verifyController.current = controller; setVerifyPhase("running"); setVerifyMessage(""); void pollVerification(verifyId, controller);
    } else void startVerification(verifiedQuestion || questionId);
  }

  const step = result ? (verifyPhase !== "idle" ? 3 : 2) : 1;
  return <div className="tw-workspace">
    <ol className="tw-steps" aria-label="体验步骤">
      {["模型配置", "逐题评分", "依据核验"].map((label, index) => <li key={label} className={step === index + 1 ? "tw-step tw-step-current" : step > index + 1 ? "tw-step tw-step-done" : "tw-step"} aria-current={step === index + 1 ? "step" : undefined}><span className="tw-step-number">{step > index + 1 ? <Check size={14} /> : `0${index + 1}`}</span><span>{label}</span></li>)}
    </ol>
    <div className="tw-layout">
      <form className="tw-config" onSubmit={(event) => { event.preventDefault(); void startTrial(); }} noValidate>
        <div className="tw-config-heading"><div><h3>模型体验</h3></div><FlaskConical size={20} aria-hidden="true" /></div>
        <fieldset disabled={busy || verifyBusy} className="tw-fields">
          <label className="tw-label" htmlFor="tw-model">模型名称（选填）</label>
          <input id="tw-model" value={modelName} onChange={(event) => setModelName(event.target.value)} maxLength={100} autoComplete="off" />
          <label className="tw-label" htmlFor="tw-endpoint">API 地址</label>
          <input id="tw-endpoint" value={endpoint} onChange={(event) => { setEndpoint(event.target.value); setErrors((prev) => ({ ...prev, endpoint: undefined })); }} spellCheck={false} autoComplete="off" aria-invalid={!!errors.endpoint} aria-describedby={errors.endpoint ? "tw-endpoint-error" : undefined} />
          {errors.endpoint && <p className="tw-field-error" id="tw-endpoint-error">{errors.endpoint}</p>}
          <label className="tw-label" htmlFor="tw-key">API Key <KeyRound size={12} /></label>
          <div className="tw-key-wrap"><input id="tw-key" type={showKey ? "text" : "password"} value={apiKey} onChange={(event) => { setApiKey(event.target.value); setErrors((prev) => ({ ...prev, key: undefined })); }} autoComplete="off" spellCheck={false} aria-invalid={!!errors.key} aria-describedby={errors.key ? "tw-key-error" : undefined} /><button type="button" onClick={() => setShowKey(!showKey)} aria-label={showKey ? "隐藏 API Key" : "显示 API Key"}>{showKey ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
          {errors.key && <p className="tw-field-error" id="tw-key-error">{errors.key}</p>}
          <label className="tw-label" htmlFor="tw-category">任务分类</label><div className="tw-select-wrap"><select id="tw-category" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">全部任务</option>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14} aria-hidden="true" /></div>
        </fieldset>
        <div className="tw-config-actions"><button className="tw-primary" type="submit" disabled={busy || verifyBusy || !models.length}>{busy ? <LoaderCircle size={16} className="tw-spin" /> : <ArrowRight size={16} />} {busy ? "评测进行中" : "开始体验"}</button><button className="tw-text-button" type="button" disabled={busy || verifyBusy} onClick={preset}>使用预设配置</button></div>
        <details className="tw-demo-settings"><summary>更多设置</summary><label><input type="checkbox" checked={simulateFailure} disabled={busy || verifyBusy} onChange={(event) => setSimulateFailure(event.target.checked)} /> 连接失败测试</label></details>
      </form>

      <div className="tw-content" aria-busy={busy}>
        {phase === "idle" && <div className="tw-empty"><span className="tw-empty-icon"><FileSearch size={32} strokeWidth={1.3} /></span><h3>作答、评分与依据核验</h3><div className="tw-preview-rows"><div><span>01</span><b>作答</b></div><div><span>02</span><b>逐题评分</b></div><div><span>03</span><b>依据核验</b></div></div><button type="button" className="tw-primary" onClick={() => void startTrial(true)} disabled={!models.length}>使用预设配置开始 <ArrowRight size={15} /></button></div>}

        {busy && <div className="tw-running" role="status" aria-live="polite"><div className="tw-running-top"><span className="tw-eyebrow">EVALUATION IN PROGRESS</span><button className="tw-quiet-button" type="button" onClick={cancelTrial}><Square size={12} /> 取消</button></div><span className="tw-run-symbol"><LoaderCircle className="tw-spin" size={28} strokeWidth={1.4} /></span><h3>{displayText(trial?.stage || "正在准备题目")}</h3><p>{runModel} <span>·</span> {trial?.total || runQuestionCount} 道体验题</p><div className="tw-progress" role="progressbar" aria-label="评测进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(trial?.progress || 0))}><span style={{ width: `${Math.max(3, Math.min(100, trial?.progress || 0))}%` }} /></div><div className="tw-progress-meta"><span>{trial?.current ? `正在处理第 ${Math.min(trial.current, trial.total)} / ${trial.total} 题` : "连接服务"}</span><b>{Math.round(trial?.progress || 0)}%</b></div></div>}

        {(phase === "failed" || phase === "cancelled") && <div className="tw-state-panel" role={phase === "failed" ? "alert" : "status"}><span className={phase === "failed" ? "tw-state-icon tw-state-warning" : "tw-state-icon"}>{phase === "failed" ? <TriangleAlert size={27} /> : <Square size={23} />}</span><h3>{phase === "failed" ? "连接失败" : "评测已取消"}</h3><p>{displayText(message)}</p><div className="tw-state-actions"><button className="tw-primary" type="button" onClick={retryTrial}><RotateCcw size={15} /> {phase === "cancelled" ? "继续评测" : "重试评测"}</button><button className="tw-secondary" type="button" onClick={reset}>返回配置</button></div></div>}

        {result && <div className="tw-results">
          <div className="tw-result-heading"><div><span className="tw-complete"><CheckCircle2 size={14} /> 评测已完成</span><h3>{runModel}<span>评测结果</span></h3></div><div className="tw-result-actions"><button className="tw-quiet-button" onClick={() => download({ demo: true, model: runModel, result, verification: verification?.result ?? null }, "taxbench-demo-result.json")} type="button"><ArrowDownToLine size={14} /> JSON</button><button className="tw-icon-button" type="button" aria-label="重置体验" title="重置体验" onClick={reset}><RotateCcw size={15} /></button></div></div>
          <div className="tw-result-metrics"><div><span>得分</span><strong>{Number(result.score).toFixed(1)}<small>/100</small></strong></div><div><span>正确回答</span><strong>{result.correct}<small>/{result.total}</small></strong></div><div><span>关键判断通过</span><strong>{result.critical}<small>/{result.total}</small></strong></div></div>
          <div className="tw-result-meta"><span>{result.total} 道独立体验题</span><span>{Number(result.tokens).toLocaleString()} token</span><span>{(result.duration / 1000).toFixed(1)} 秒</span></div>
          <div className="tw-question-heading"><h4>逐题评分</h4></div>
          <div className="tw-question-list">{result.questions.map((question, index) => <div className="tw-question" key={question.id}><button className="tw-question-toggle" type="button" aria-expanded={expanded === question.id} aria-controls={`tw-answer-${question.id}`} onClick={() => setExpanded(expanded === question.id ? null : question.id)}><span className="tw-question-index">{String(index + 1).padStart(2, "0")}</span><span className="tw-question-title">{displayText(question.question)}</span><b className={question.score >= 80 ? "tw-question-score tw-good-score" : "tw-question-score"}>{question.score}<small>/{question.maxScore}</small></b>{expanded === question.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button>{expanded === question.id && <div className="tw-answer" id={`tw-answer-${question.id}`}><div className="tw-question-full"><span className="tw-answer-label">完整题面</span><p>{displayText(question.question)}</p></div><span className="tw-answer-label">模型回答</span><p>{displayText(question.answer)}</p><div className="tw-deductions"><span>{question.deductions.length ? "扣分说明" : "评分说明"}</span>{question.deductions.length ? <ul>{question.deductions.map((deduction, i) => <li key={i}>{displayText(deduction)}</li>)}</ul> : <p>本题无扣分项。</p>}</div><button className="tw-text-button" type="button" disabled={verifyBusy} onClick={() => void startVerification(question.id)}><FileSearch size={14} /> 核验本题依据 <ArrowRight size={13} /></button></div>}</div>)}</div>

          <section className="tw-verification" aria-label="回答依据核验">
            <div className="tw-verify-heading"><span className="tw-verify-icon"><ShieldCheck size={20} /></span><div><h4>TaxVerify 依据核验</h4></div></div>
            <div className="tw-verify-form"><label><span>选择待核验的回答</span><div className="tw-select-wrap"><select value={questionId} disabled={verifyBusy} onChange={(event) => setQuestionId(event.target.value)} aria-label="选择要验证的题目">{result.questions.map((question, index) => <option value={question.id} key={question.id}>第 {index + 1} 题 · {displayText(question.question).slice(0, 26)}</option>)}</select><ChevronDown size={14} /></div></label><button className="tw-verify-button" type="button" disabled={verifyBusy || !questionId} onClick={() => void startVerification()}>{verifyBusy ? <LoaderCircle size={15} className="tw-spin" /> : <FileSearch size={15} />}{verifyBusy ? "正在核验" : verification?.result ? "重新核验" : "核验依据"}</button></div>
            {verifyBusy && <div className="tw-verify-progress" role="status" aria-live="polite"><div><span>{displayText(verification?.stage || "正在提取回答中的判断")}</span><button className="tw-quiet-button" type="button" onClick={() => { verifyController.current?.abort(); setVerifyPhase("cancelled"); }}><X size={13} /> 取消核验</button></div><div className="tw-progress"><span style={{ width: `${Math.max(4, verification?.progress || 0)}%` }} /></div></div>}
            {verifyPhase === "failed" && <div className="tw-inline-error" role="alert"><TriangleAlert size={16} /><span>{displayText(verifyMessage)}</span><button type="button" onClick={retryVerification}>重试</button></div>}
            {verifyPhase === "cancelled" && <p className="tw-muted tw-cancelled-note">核验已取消，评测结果已保留。</p>}
            {verifyPhase === "completed" && verification?.result && <div className="tw-claims"><div className="tw-claims-summary"><span><CheckCircle2 size={14} /> 有支持 {verification.result.supported}</span><span><CircleHelp size={14} /> 待补证 {verification.result.uncertain}</span><span><TriangleAlert size={14} /> 有冲突 {verification.result.conflicting}</span></div><p className="tw-verifier-note">{verifiedBy} · 第 {result.questions.findIndex((question) => question.id === verifiedQuestion) + 1} 题</p>{verification.result.claims.map((claim) => <article className={`tw-claim tw-claim-${claim.status}`} key={claim.id}><div className="tw-claim-title"><span>{claim.status === "supported" ? <CheckCircle2 size={15} /> : claim.status === "uncertain" ? <CircleHelp size={15} /> : <TriangleAlert size={15} />}</span><h5>{displayText(claim.text)}</h5><b>{claim.status === "supported" ? "有支持" : claim.status === "uncertain" ? "待补证" : "有冲突"}</b></div><p>{displayText(claim.explanation)}</p><details><summary>查看依据 <ChevronDown size={13} /></summary><div className="tw-source"><span>{claim.source.region} · {claim.source.year}</span><strong>{displayText(claim.source.title)}</strong><small>{claim.source.code.replace(/^DEMO-/, "")}</small><blockquote>{displayText(claim.source.excerpt)}</blockquote></div></details></article>)}</div>}
          </section>
        </div>}
      </div>
    </div>
  </div>;
}
