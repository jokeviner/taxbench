import { categoryOptions, experienceQuestions, models, regions } from "./mock-data.ts";

export type TrialPayload = {
  kind: "trial"; version: 1; at: number; nonce: string;
  modelId: string; count: 5 | 8 | 10; category: string; failure: boolean;
};
export type VerifyPayload = {
  kind: "verify"; version: 1; at: number; nonce: string;
  jobId: string; questionId: string; modelId: string;
};
type JobPayload = TrialPayload | VerifyPayload;

export class MockInputError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0", "X-TaxBench-Mode": "mock", "X-Content-Type-Options": "nosniff" },
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof MockInputError) return json({ error: error.message }, error.status);
  return json({ error: "无法处理演示请求，请检查输入后重试。" }, 400);
}

function rejectCredentialFields(value: unknown): void {
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (/^(api[_-]?key|key|token|secret|password|authorization|access[_-]?token)$/i.test(key)) {
      throw new MockInputError("演示接口不接收API Key、密码或访问令牌，请勿提交真实凭据。");
    }
    rejectCredentialFields(nested);
  }
}

export async function body(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("Content-Length") || 0) > 16_384) throw new MockInputError("演示请求内容过长。");
  let payload: unknown;
  try {
    const text = await request.text();
    if (text.length > 16_384) throw new MockInputError("演示请求内容过长。");
    payload = JSON.parse(text);
  } catch (error) {
    if (error instanceof MockInputError) throw error;
    throw new MockInputError("请提交有效的JSON对象。");
  }
  if (!payload || Array.isArray(payload) || typeof payload !== "object") throw new MockInputError("请求内容必须为JSON对象。");
  rejectCredentialFields(payload);
  return payload as Record<string, unknown>;
}

export function textField(payload: Record<string, unknown>, key: string, max = 200, required = true): string {
  const raw = payload[key];
  if (raw === undefined && !required) return "";
  if (typeof raw !== "string") throw new MockInputError(`请填写有效的${({ name: "姓名", organization: "机构", email: "邮箱", type: "需求类型", message: "需求说明" } as Record<string, string>)[key] || key}。`);
  const value = raw.trim();
  if ((required && !value) || value.length > max) throw new MockInputError(`请检查${({ name: "姓名", organization: "机构", email: "邮箱", type: "需求类型", message: "需求说明" } as Record<string, string>)[key] || key}，内容为空或过长。`);
  return value;
}

export function checkedEmail(payload: Record<string, unknown>): string {
  const value = textField(payload, "email", 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new MockInputError("请输入有效邮箱地址。");
  return value;
}

export function requireConsent(payload: Record<string, unknown>): void {
  if (payload.consent !== true) throw new MockInputError("请先勾选同意说明。");
}

export function checkedModel(value: unknown): string {
  if (typeof value !== "string" || !models.some((model) => model.id === value)) throw new MockInputError("请选择有效的演示模型。");
  return value;
}

export function checkedCategory(value: unknown): string {
  if (value === undefined || value === "" || value === "all" || value === "全部类型" || value === "全部任务") return "";
  if (typeof value !== "string" || !categoryOptions.includes(value)) throw new MockInputError("请选择有效的任务类型。");
  return value;
}

export function checkEndpoint(value: unknown): void {
  if (value === undefined || value === "") return;
  if (typeof value !== "string" || value.length > 500) throw new MockInputError("请输入有效的演示接口地址。");
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
  } catch { throw new MockInputError("接口地址需使用http或https，且不能包含账号、密码、参数或片段。演示不会连接该地址。"); }
  // The endpoint is deliberately neither requested, retained nor included in job tokens.
}

function checksum(value: string): string {
  let hash = 2_166_136_261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16_777_619);
  return (hash >>> 0).toString(36);
}

/** Self-contained public mock identifiers, not authentication or encrypted storage. */
export function encodeJob(payload: JobPayload): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const encoded = btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join("")).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return `${payload.kind}.${encoded}.${checksum(encoded)}`;
}

export function decodeJob<K extends JobPayload["kind"]>(id: string, kind: K): Extract<JobPayload, { kind: K }> {
  try {
    if (!id || id.length > 4096) throw new Error();
    const [prefix, encoded, check, extra] = id.split(".");
    if (prefix !== kind || !encoded || extra || checksum(encoded) !== check) throw new Error();
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(decoded, (character) => character.charCodeAt(0)))) as JobPayload;
    if (payload.kind !== kind || payload.version !== 1 || !Number.isFinite(payload.at) || payload.at < 0 || payload.at > Date.now() + 60_000 || typeof payload.nonce !== "string") throw new Error();
    if (payload.kind === "trial") {
      checkedModel(payload.modelId); checkedCategory(payload.category);
      if (![5, 8, 10].includes(payload.count) || typeof payload.failure !== "boolean") throw new Error();
    } else {
      checkedModel(payload.modelId);
      if (typeof payload.jobId !== "string" || typeof payload.questionId !== "string") throw new Error();
      const trial = decodeJob(payload.jobId, "trial");
      if (payload.questionId && !trialResult(trial).questions.some((question) => question.id === payload.questionId)) throw new Error();
    }
    return payload as Extract<JobPayload, { kind: K }>;
  } catch { throw new MockInputError("未找到该演示任务，标识无效或已损坏。请重新开始体验。", 404); }
}

export function nonce(): string { return crypto.randomUUID().slice(0, 8); }
export function trialDuration(payload: TrialPayload): number { return 8_800 + (models.findIndex((model) => model.id === payload.modelId) % 4) * 300; }

export function trialResult(payload: TrialPayload) {
  const model = models.find((item) => item.id === payload.modelId)!;
  const modelIndex = models.indexOf(model);
  const preferred = payload.category ? experienceQuestions.filter((question) => question.category === payload.category) : experienceQuestions;
  const pool = preferred.length ? preferred : experienceQuestions;
  const questions = Array.from({ length: payload.count }, (_, index) => {
    const original = pool[index % pool.length];
    const variation = index >= pool.length;
    const score = Math.min(100, Math.max(30, Math.round(model.score + [8, -6, 3, -10, 5, -2, 1, -5, 2, -7][index])));
    return {
      id: `${original.id}-TRIAL-${index + 1}`,
      question: `${original.question}${variation ? "\n【演示变体】仅调整复核角度，不来自私有基准题。" : ""}`,
      answer: original.answer,
      score, maxScore: 100,
      deductions: score >= 90 ? ["演示扣分：一项证据补充说明不够具体。"] : ["演示扣分：未完整列明适用假设。", "演示扣分：对材料缺口的说明仍可补充。"],
    };
  });
  return {
    score: Math.round(questions.reduce((sum, question) => sum + question.score, 0) / questions.length * 10) / 10,
    correct: questions.filter((question) => question.score >= 80).length,
    critical: questions.filter((question) => question.score >= 75).length,
    total: payload.count,
    tokens: payload.count * (1_540 + modelIndex * 87),
    duration: trialDuration(payload),
    questions,
    mock: true,
    disclaimer: "模拟分数与扣分说明，仅用于体验交互，不代表真实模型能力或税务结论。",
  };
}

export function trialState(id: string, payload: TrialPayload) {
  const duration = trialDuration(payload);
  const elapsed = Math.max(0, Date.now() - payload.at);
  const failed = payload.failure && elapsed >= duration * 0.62;
  const progress = failed ? 62 : Math.min(100, Math.floor(elapsed / duration * 100));
  const status = failed ? "failed" : progress >= 100 ? "completed" : "running";
  const stage = failed ? "模拟连接失败" : progress < 12 ? "准备演示题目" : progress < 48 ? "生成模拟作答" : progress < 82 ? "执行模拟逐项评分" : progress < 100 ? "汇总演示结果" : "演示评测完成";
  return {
    id, status, progress, stage,
    current: status === "completed" ? payload.count : Math.min(payload.count, Math.max(1, Math.ceil(progress / 100 * payload.count))),
    total: payload.count, mock: true,
    ...(failed ? { error: "演示连接失败，请重试或关闭失败模拟。不涉及真实服务。" } : {}),
    ...(status === "completed" ? { result: trialResult(payload) } : {}),
  };
}

export function verifyResult(payload: VerifyPayload) {
  const trial = decodeJob(payload.jobId, "trial");
  const original = trialResult(trial).questions.find((question) => question.id === payload.questionId);
  const region = original ? experienceQuestions.find((question) => original.id.startsWith(question.id))?.region || regions[0] : regions[0];
  const texts = ["交易的判断需结合实际履行与交付记录。", "单一付款日期不能覆盖全部事实条件。", "现有合同分项足以支持全部费用分类。", "年度边界和适用假设需要进一步确认。", "信息缺口应单独标注并保留补正记录。"];
  const statuses = ["supported", "supported", "conflicting", "uncertain", "supported"] as const;
  const explanations = {
    supported: "模拟来源与这项表述一致；本条仅演示证据对照，不代表真实法源核验。",
    uncertain: "模拟材料缺少对应期间信息，保留不确定状态，需补充证据。",
    conflicting: "这项表述过于确定，与模拟来源要求保留材料缺口的条件冲突。",
  };
  const claims = texts.map((text, index) => ({
    id: `DEMO-CLAIM-${index + 1}`, text, status: statuses[index], explanation: explanations[statuses[index]],
    source: {
      title: `${region}演示证据集 · 非真实法律依据`, code: `DEMO-${index + 1}01`,
      excerpt: "【模拟引文，非真实法源】服务判断应关联主体、期间、合同和交付材料；信息不完整时不得作无条件结论。",
      region, year: 2026,
    },
  }));
  return {
    supported: claims.filter((claim) => claim.status === "supported").length,
    uncertain: claims.filter((claim) => claim.status === "uncertain").length,
    conflicting: claims.filter((claim) => claim.status === "conflicting").length,
    claims, mock: true,
    disclaimer: "来源与核验结论全部为模拟，不构成法律或税务意见。",
  };
}

export const verificationDuration = 5_200;
export function verifyState(id: string, payload: VerifyPayload) {
  const progress = Math.min(100, Math.max(0, Math.floor((Date.now() - payload.at) / verificationDuration * 100)));
  const stage = progress < 25 ? "提取模拟回答中的关键陈述" : progress < 65 ? "匹配模拟证据片段" : progress < 100 ? "检查支持、冲突与信息缺口" : "模拟法源核验完成";
  return { id, status: progress >= 100 ? "completed" : "running", progress, stage, mock: true, ...(progress >= 100 ? { result: verifyResult(payload) } : {}) };
}
