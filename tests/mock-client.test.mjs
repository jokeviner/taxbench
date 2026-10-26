import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mockFetch } from "../src/lib/mock-client.ts";

const originalFetch = globalThis.fetch;
let networkCalls = 0;
globalThis.fetch = () => {
  networkCalls += 1;
  throw new Error("Static demo must not make network requests");
};
after(() => {
  globalThis.fetch = originalFetch;
  assert.equal(networkCalls, 0);
});

async function post(path, body) {
  const response = await mockFetch(path, { method: "POST", body: JSON.stringify(body) });
  return { response, data: await response.json() };
}

test("bootstrap supplies the same public models and cases without a server", async () => {
  const response = await mockFetch("/api/bootstrap");
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.models.length, 9);
  assert.equal(data.cases.length, 4);
  assert.equal(data.regions.length, 4);
  assert.equal(data.categories.length, 6);
  assert.equal(data.experienceQuestions, undefined);
});

test("trial and per-question verification complete with consistent progress and counts", async () => {
  const originalNow = Date.now;
  let clock = originalNow();
  Date.now = () => clock;
  try {
    const { data: bootstrap } = { data: await (await mockFetch("/api/bootstrap")).json() };
    const created = await post("/api/trials", {
      modelId: bootstrap.models[0].id,
      endpoint: "https://demo.taxbench.example/v1",
      questionCount: 5,
    });
    assert.equal(created.response.status, 201);
    const first = await (await mockFetch(`/api/trials/${created.data.id}`)).json();
    assert.equal(first.status, "running");
    assert.equal(first.result, undefined);
    clock += created.data.duration + 1;
    const complete = await (await mockFetch(`/api/trials/${created.data.id}`)).json();
    assert.equal(complete.status, "completed");
    assert.equal(complete.progress, 100);
    assert.equal(complete.result.questions.length, 5);
    const mean = complete.result.questions.reduce((sum, question) => sum + question.score, 0) / 5;
    assert.equal(complete.result.score, Math.round(mean * 10) / 10);
    const verification = await post("/api/verify", {
      jobId: created.data.id,
      questionId: complete.result.questions[0].id,
    });
    assert.equal(verification.response.status, 201);
    clock += verification.data.duration + 1;
    const verified = await (await mockFetch(`/api/verify/${verification.data.id}`)).json();
    assert.equal(verified.status, "completed");
    assert.equal(verified.result.claims.length, verified.result.supported + verified.result.uncertain + verified.result.conflicting);
    const invalid = await post("/api/verify", { jobId: created.data.id, questionId: "not-a-trial-question" });
    assert.equal(invalid.response.status, 404);
  } finally {
    Date.now = originalNow;
  }
});

test("failure simulation returns a failed task and retry can succeed", async () => {
  const originalNow = Date.now;
  let clock = originalNow();
  Date.now = () => clock;
  try {
    const bootstrap = await (await mockFetch("/api/bootstrap")).json();
    const config = { modelId: bootstrap.models[0].id, questionCount: 5, simulateFailure: true };
    const failed = await post("/api/trials", config);
    clock += failed.data.duration + 1;
    const state = await (await mockFetch(`/api/trials/${failed.data.id}`)).json();
    assert.equal(state.status, "failed");
    assert.equal(state.result, undefined);
    assert.ok(state.error);
    const retry = await post("/api/trials", { ...config, simulateFailure: false });
    clock += retry.data.duration + 1;
    assert.equal((await (await mockFetch(`/api/trials/${retry.data.id}`)).json()).status, "completed");
  } finally {
    Date.now = originalNow;
  }
});

test("request cancellation works before and during local async processing", async () => {
  const first = new AbortController();
  first.abort();
  await assert.rejects(mockFetch("/api/bootstrap", { signal: first.signal }), { name: "AbortError" });
  const second = new AbortController();
  const waiting = mockFetch("/api/bootstrap", { signal: second.signal });
  second.abort();
  await assert.rejects(waiting, { name: "AbortError" });
});

test("form submissions validate locally and return receipts without retaining personal fields", async () => {
  const invalid = await post("/api/subscribe", { email: "invalid", consent: true });
  assert.equal(invalid.response.status, 400);
  const email = "demo@example.com";
  const subscription = await post("/api/subscribe", { email, consent: true });
  assert.equal(subscription.response.status, 201);
  assert.ok(subscription.data.receipt);
  assert.equal(JSON.stringify(subscription.data).includes(email), false);
  const contact = await post("/api/contact", {
    name: "体验用户", org: "研究团队", email, type: "学术合作", message: "希望了解评测方法与后续合作。", consent: true,
  });
  assert.equal(contact.response.status, 201);
  assert.ok(contact.data.receipt);
  assert.equal(JSON.stringify(contact.data).includes(email), false);
  const credential = await post("/api/trials", { apiKey: "never-send-real-credentials" });
  assert.equal(credential.response.status, 400);
});

test("unknown, external and malformed routes cannot trigger an external request", async () => {
  for (const path of ["/api/unknown", "https://example.com/api/bootstrap", "/api/trials/broken"]) {
    assert.equal((await mockFetch(path)).ok, false);
  }
});
