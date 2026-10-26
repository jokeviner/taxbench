import type { Model } from "./mock-data";

/**
 * Deterministic mock analytics for the prototype, not measurements of real models.
 * Units: tokens and turns are averages per answer; latency is seconds; cost in
 * history is USD per question. Tool calls belong only to post-answer verification,
 * never to the closed-book answering model. No external services or storage.
 */
export type ModelAnalytics = {
  modelId: string;
  sampleCount: number;
  completed: number;
  failed: number;
  turns: number;
  answerTokens: number;
  referenceTokens: number;
  p95Latency: number;
  toolPhase?: "verification";
  toolCalls: Array<{ key: string; label: string; value: number }>;
  errorBreakdown: Array<{ label: string; count: number }>;
  citationBreakdown: Array<{ label: string; value: number }>;
  history: Array<{
    version: string;
    date: string;
    score: number;
    accuracy: number;
    critical: number;
    citation: number;
    cost: number;
    latency: number;
  }>;
};

export const BENCHMARK_PROTOCOL = {
  version: "TB-2026.10",
  publishedAt: "2026.10.25",
  questionCount: 240,
  track: "闭卷",
  temperature: 0.2,
  maxOutputTokens: 8192,
  timeoutSeconds: 300,
  scoringVersion: "Rubric v1.2",
} as const;

function seedFor(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index++) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16_777_619);
  }
  return hash >>> 0;
}

const rounded = (value: number, digits = 1): number =>
  Number(value.toFixed(digits));
const percentage = (value: number): number =>
  rounded(Math.max(0, Math.min(100, value)));

/** Allocate integer counts by largest remainder, preserving the exact total. */
function allocate(total: number, weights: number[]): number[] {
  const weightSum = weights.reduce((sum, value) => sum + value, 0);
  const exact = weights.map((weight) => total * weight / weightSum);
  const values = exact.map(Math.floor);
  let remaining = total - values.reduce((sum, value) => sum + value, 0);
  const order = exact.map((value, index) => ({
    index,
    remainder: value - values[index],
  })).sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const item of order) {
    if (remaining <= 0) break;
    values[item.index] += 1;
    remaining -= 1;
  }
  return values;
}

export function getModelAnalytics(model: Model): ModelAnalytics {
  const seed = seedFor(model.id);
  const sampleCount = BENCHMARK_PROTOCOL.questionCount;
  // Accuracy is reported over all 240 tasks, including execution failures.
  const notFullyPassed = Math.round(sampleCount * (1 - model.accuracy / 100));
  const failed = Math.min(notFullyPassed, 1 + seed % 6);
  const completed = sampleCount - failed;
  const reasonCounts = allocate(notFullyPassed - failed, [
    35 + seed % 8,
    29 + seed % 5,
    21 + seed % 4,
    15 + seed % 3,
  ]);

  // Use integer tenths so percentages total 100 at the displayed precision.
  // The existing support percentage is preserved exactly, rather than replaced.
  const remainingTenths = Math.max(0, 1000 - Math.round(model.citation * 10));
  const uncertainTenths = Math.round(remainingTenths * (0.6 + seed % 3 * 0.05));
  const conflictingTenths = remainingTenths - uncertainTenths;

  const dates = [
    "2026.08.20", "2026.09.05", "2026.09.20",
    "2026.10.05", "2026.10.15", BENCHMARK_PROTOCOL.publishedAt,
  ];
  const versions = [
    "TB-2026.08", "TB-2026.09-r1", "TB-2026.09-r2",
    "TB-2026.10-r1", "TB-2026.10-r2", BENCHMARK_PROTOCOL.version,
  ];
  const scoreOffsets = [8.1, 6.2, 4.8, 3.1, 1.4, 0];
  const history = dates.map((date, index) => {
    if (index === dates.length - 1) {
      return {
        version: BENCHMARK_PROTOCOL.version,
        date,
        score: model.score,
        accuracy: model.accuracy,
        critical: model.critical,
        citation: model.citation,
        cost: model.cost,
        latency: model.latency,
      };
    }
    const offset = scoreOffsets[index];
    return {
      version: versions[index],
      date,
      score: percentage(model.score - offset),
      accuracy: percentage(model.accuracy - offset * 1.3),
      critical: percentage(model.critical - offset * 1.15),
      citation: percentage(model.citation - offset * 0.65),
      cost: rounded(model.cost * (1 + (dates.length - 1 - index) * 0.055), 2),
      latency: rounded(model.latency + (dates.length - 1 - index) * (2 + seed % 3)),
    };
  });

  return {
    modelId: model.id,
    sampleCount,
    completed,
    failed,
    turns: 1,
    answerTokens: Math.round(1400 + model.latency * 12 + model.score * 11 + seed % 300),
    referenceTokens: 1180,
    p95Latency: Math.min(
      BENCHMARK_PROTOCOL.timeoutSeconds,
      Math.max(model.latency, Math.round(model.latency * 1.45 + seed % 15)),
    ),
    toolPhase: "verification",
    toolCalls: [
      { key: "web_search", label: "检索", value: rounded(2.2 + seed % 13 / 10) },
      { key: "lookup_authority", label: "依据查询", value: rounded(3.1 + seed % 17 / 10) },
      { key: "fetch_document", label: "文档读取", value: rounded(1.5 + seed % 11 / 10) },
      { key: "calculator", label: "计算", value: rounded(0.4 + seed % 7 / 10) },
    ],
    errorBreakdown: [
      { label: "适用依据判断", count: reasonCounts[0] },
      { label: "关键条件遗漏", count: reasonCounts[1] },
      { label: "计算与推导", count: reasonCounts[2] },
      { label: "引用支持不足", count: reasonCounts[3] },
      { label: "运行未完成", count: failed },
    ],
    citationBreakdown: [
      { label: "依据支持", value: model.citation },
      { label: "需要补证", value: uncertainTenths / 10 },
      { label: "存在冲突", value: conflictingTenths / 10 },
    ],
    history,
  };
}
