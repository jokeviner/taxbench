/** Browser-local API adapter. Requests are validated and discarded without network or storage. */
import { cases, categoryOptions, meta, models, regions } from "./mock-data.ts";
import {
  body, checkedCategory, checkedEmail, checkedModel, checkEndpoint, decodeJob,
  encodeJob, errorResponse, json, MockInputError, nonce, requireConsent,
  textField, trialDuration, trialResult, trialState, verificationDuration, verifyState,
  type TrialPayload, type VerifyPayload,
} from "./mock-runtime.ts";

const LOCAL_ORIGIN = "https://taxbench.local";

function abortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
}

function checkAborted(signal?: AbortSignal | null): void {
  if (signal?.aborted) throw abortError();
}

function responseDelay(milliseconds: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(abortError()); return; }
    const cancel = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", cancel);
      resolve();
    }, milliseconds);
    signal?.addEventListener("abort", cancel, { once: true });
  });
}

function methodNotAllowed(method: string): Response {
  const response = json({ error: "此接口不支持该请求方式。" }, 405);
  response.headers.set("Allow", method);
  return response;
}

async function dispatch(request: Request, pathname: string): Promise<Response> {
  const method = request.method;
  if (pathname === "/api/bootstrap") {
    if (method !== "GET") return methodNotAllowed("GET");
    return json({ models, cases, meta, regions, categories: categoryOptions });
  }
  if (pathname === "/api/trials") {
    if (method !== "POST") return methodNotAllowed("POST");
    const payload = await body(request);
    const modelId = checkedModel(payload.modelId);
    checkEndpoint(payload.endpoint);
    if (payload.questionCount !== 5 && payload.questionCount !== 8 && payload.questionCount !== 10) {
      throw new MockInputError("体验题量仅支持5、8或10题。");
    }
    if (payload.simulateFailure !== undefined && typeof payload.simulateFailure !== "boolean") {
      throw new MockInputError("失败模拟参数必须为布尔值。");
    }
    const job: TrialPayload = {
      kind: "trial", version: 1, at: Date.now(), nonce: nonce(), modelId,
      count: payload.questionCount, category: checkedCategory(payload.category),
      failure: payload.simulateFailure === true,
    };
    return json({ id: encodeJob(job), createdAt: new Date(job.at).toISOString(), duration: trialDuration(job), questionCount: job.count, mock: true }, 201);
  }
  const trialMatch = /^\/api\/trials\/([^/]+)$/.exec(pathname);
  if (trialMatch) {
    if (method !== "GET") return methodNotAllowed("GET");
    const id = decodeURIComponent(trialMatch[1]);
    return json(trialState(id, decodeJob(id, "trial")));
  }
  if (pathname === "/api/verify") {
    if (method !== "POST") return methodNotAllowed("POST");
    const payload = await body(request);
    const jobId = textField(payload, "jobId", 4096);
    const trial = decodeJob(jobId, "trial");
    if (trial.failure) throw new MockInputError("失败的演示任务没有可核验的结果，请重新开始体验。");
    const questionId = textField(payload, "questionId", 120, false);
    if (questionId && !trialResult(trial).questions.some((question) => question.id === questionId)) {
      throw new MockInputError("未找到该体验题目。", 404);
    }
    const modelId = payload.modelId === undefined ? models[2].id : checkedModel(payload.modelId);
    const job: VerifyPayload = { kind: "verify", version: 1, at: Date.now(), nonce: nonce(), jobId, questionId, modelId };
    return json({ id: encodeJob(job), createdAt: new Date(job.at).toISOString(), duration: verificationDuration, mock: true }, 201);
  }
  const verifyMatch = /^\/api\/verify\/([^/]+)$/.exec(pathname);
  if (verifyMatch) {
    if (method !== "GET") return methodNotAllowed("GET");
    const id = decodeURIComponent(verifyMatch[1]);
    return json(verifyState(id, decodeJob(id, "verify")));
  }
  if (pathname === "/api/contact") {
    if (method !== "POST") return methodNotAllowed("POST");
    const payload = await body(request);
    if (payload.organization === undefined && typeof payload.org === "string") payload.organization = payload.org;
    textField(payload, "name", 80);
    textField(payload, "organization", 160);
    checkedEmail(payload);
    textField(payload, "type", 80);
    textField(payload, "message", 3000);
    requireConsent(payload);
    const receipt = `DEMO-${Date.now().toString(36).toUpperCase()}-${nonce().toUpperCase()}`;
    return json({ id: receipt, receipt, createdAt: new Date().toISOString(), mock: true, message: "演示回执已生成。未发送邮件，也未保存您填写的联系信息。" }, 201);
  }
  if (pathname === "/api/subscribe") {
    if (method !== "POST") return methodNotAllowed("POST");
    const payload = await body(request);
    checkedEmail(payload);
    requireConsent(payload);
    const receipt = `DEMO-SUB-${Date.now().toString(36).toUpperCase()}-${nonce().toUpperCase()}`;
    return json({ id: receipt, receipt, createdAt: new Date().toISOString(), mock: true, message: "订阅流程演示完成。没有保存邮箱或添加订阅，也不会发送邮件。" }, 201);
  }
  return json({ error: "未找到该接口。" }, 404);
}

/** Fetch-compatible local requests; AbortSignal rejects with AbortError just as fetch does. */
export async function mockFetch(path: string, init: RequestInit = {}): Promise<Response> {
  checkAborted(init.signal);
  await responseDelay(init.method?.toUpperCase() === "POST" ? 220 : 140, init.signal);
  checkAborted(init.signal);
  try {
    const url = new URL(path, LOCAL_ORIGIN);
    if (url.origin !== LOCAL_ORIGIN || url.username || url.password || url.search || url.hash) {
      return json({ error: "仅支持本地接口请求。" }, 404);
    }
    const request = new Request(url, init);
    const response = await dispatch(request, url.pathname);
    checkAborted(init.signal);
    return response;
  } catch (error) {
    checkAborted(init.signal);
    return errorResponse(error);
  }
}
