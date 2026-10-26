/** All data in this module is fictional and exists only for the interactive demo. */
export type Model = {
  id: string;
  name: string;
  provider: string;
  version: string;
  color: string;
  score: number;
  accuracy: number;
  critical: number;
  citation: number;
  cost: number;
  latency: number;
  delta: number;
  series: number[];
  regions: Record<string, number>;
  categories: Record<string, number>;
};

export type CaseStudy = {
  id: string;
  title: string;
  region: string;
  category: string;
  difficulty: string;
  summary: string;
  question: string;
  answer: string;
  modelId: string;
  score: number;
  checks: Array<{ id: string; label: string; points: number; max: number; reason: string; quote: string }>;
  evidence: Array<{ id: string; title: string; authority: string; date: string; excerpt: string; status: string }>;
  tags: string[];
};

export const regions = ["中国内地", "中国香港", "新加坡", "马来西亚"];
export const categoryOptions = [
  "规则与来源适用", "数值与计算", "表格与申报", "争议处理与裁判适用", "年度与规则变化", "事实情境分析",
];

const limitScore = (value: number) => Math.round(Math.min(99, Math.max(0, value)) * 10) / 10;
function fictionalModel(
  id: string, name: string, provider: string, color: string,
  score: number, accuracy: number, critical: number, citation: number,
  cost: number, latency: number, delta: number, index: number,
): Model {
  return {
    id, name, provider, color, score, accuracy, critical, citation, cost, latency, delta,
    version: "2026.10-demo",
    series: [-8.1, -7, -5.6, -5.9, -3.2, -2.5, -1.3, 0].map((difference, i) => limitScore(score + difference + (i === 7 ? 0 : index * 0.15))),
    regions: Object.fromEntries(regions.map((region, i) => [region, limitScore(score + [2.4, -1.4, 1.3, -2.3][(i + index) % 4])])),
    categories: Object.fromEntries(categoryOptions.map((category, i) => [category, limitScore(score + [4.2, 1.9, -3.4, -5, -.5, 2.8][(i + index) % 6])])),
  };
}

/** Scores, providers, prices, version history and model names are made up. */
export const models: Model[] = [
  fictionalModel("atlas-pro", "Atlas Pro", "澄星实验室 · 虚构", "#138b72", 84.2, 73.8, 79.6, 92.1, 1.84, 104, 2.7, 0),
  fictionalModel("cedar-reasoner", "Cedar Reasoner", "杉序智能 · 虚构", "#476ada", 81.8, 69.2, 76.3, 89.7, 1.26, 126, 3.1, 1),
  fictionalModel("harbor-deep", "Harbor Deep", "港湾计算 · 虚构", "#bd8b36", 79.6, 64.6, 73.8, 87.5, 2.12, 142, 1.9, 2),
  fictionalModel("aster-scholar", "Aster Scholar", "紫苑研究 · 虚构", "#9274b9", 77.4, 61.3, 70.8, 90.2, 1.48, 118, 2.4, 3),
  fictionalModel("quartz-core", "Quartz Core", "晶原科技 · 虚构", "#d87958", 75.1, 56.7, 67.9, 83.4, 0.86, 82, 1.3, 4),
  fictionalModel("finch-fast", "Finch Fast", "青雀实验室 · 虚构", "#39a0b1", 72.8, 52.9, 63.8, 81.6, 0.34, 38, 3.8, 5),
  fictionalModel("lumen-edge", "Lumen Edge", "微光智能 · 虚构", "#cf6f9c", 70.6, 48.8, 59.2, 80.3, 0.49, 54, 1.5, 6),
  fictionalModel("aurora-research", "Aurora Research", "极昼研究 · 虚构", "#7b8f4e", 68.9, 45.4, 57.9, 84.1, 1.07, 97, 0.8, 7),
  fictionalModel("vale-mini", "Vale Mini", "谷屿计算 · 虚构", "#8592a8", 65.3, 39.6, 52.1, 75.8, 0.18, 29, 2.2, 8),
];

type CaseSeed = {
  id: string; title: string; region: string; category: string; difficulty: string;
  summary: string; question: string; answer: string; modelId: string; tags: string[];
};

function fictionalCase(seed: CaseSeed, index: number): CaseStudy {
  const points = [[30, 20, 20, 18], [25, 25, 18, 17], [25, 22, 20, 16], [25, 20, 20, 15]][index];
  const quotes = ["先核对服务实际履行期间", "区分主体、年度与交易事实", "保留合同与业务交付记录", "材料不足时将结论标为待核验"];
  return {
    ...seed,
    score: points.reduce((sum, value) => sum + value, 0),
    answer: `${seed.answer}\n\n演示判断步骤：${quotes.join("；")}。\n\n以上回答使用虚构规则，不能作为实际税务意见。`,
    checks: ["识别交易和适用范围", "区分期间与主体条件", "解释证据和计算路径", "披露例外与信息缺口"].map((label, i) => ({
      id: `${seed.id}-CHECK-${i + 1}`, label, points: points[i], max: [30, 25, 25, 20][i],
      reason: i === 0 ? "演示作答正确识别了主要判断对象。" : "演示作答覆盖主要要求，但还可补充一项独立条件。",
      quote: quotes[i],
    })),
    evidence: [
      { id: `${seed.id}-SOURCE-1`, title: `${seed.region}演示规则 D-${index + 1}01`, authority: "模拟规则集 · 非真实法律依据", date: "2026-10-01", excerpt: "【虚构引文】判断服务归属应结合交易主体、实际履行期间和可核查的交付证据。此段仅为界面演示而编写，不对应任何真实法条。", status: "支持 · 模拟" },
      { id: `${seed.id}-SOURCE-2`, title: "演示证据清单与例外说明", authority: "模拟工作底稿 · 非正式税务文件", date: "2026-10-12", excerpt: "【虚构引文】单一付款记录不代表全部事实已确认；信息不足的结论应标明假设与待补材料。", status: "待确认 · 模拟" },
    ],
  };
}

/** Independent public demonstration cases, not questions from the private 240-item set. */
export const cases: CaseStudy[] = [
  fictionalCase({
    id: "DEMO-CN-001", title: "跨年度咨询服务费用的期间判断", region: "中国内地", category: "年度与规则变化", difficulty: "进阶",
    summary: "根据合同服务期、付款和交付记录，判断跨年度咨询费用的归属期间及待补材料。",
    question: "【虚构税务场景】澄海公司于2026年支付境外咨询服务费，合同服务期横跨两个年度，交付记录尚不完整。请仅依据演示规则D-101分析需要核对的事实、期间划分路径和待补材料；不要引用真实法律。",
    answer: "按演示规则D-101，付款日期不能独自决定服务归属。先将合同约定、实际服务和交付记录放入同一时间线，再说明各年度的判断假设；缺少交付证据的部分应保留待核验状态。",
    modelId: "atlas-pro", tags: ["公开演示", "非真实法源", "跨年度", "证据链"],
  }, 0),
  fictionalCase({
    id: "DEMO-HK-002", title: "跨境顾问服务收入的来源判断", region: "中国香港", category: "事实情境分析", difficulty: "进阶",
    summary: "识别顾问服务的实际活动、执行主体与交付地点，列明收入来源判断所需证据。",
    question: "【虚构税务场景】香港杉海公司为不同地区客户提供顾问服务，合同在甲地签署、部分活动由乙地团队执行。请按演示规则D-201列出判断收入归属仍需哪些活动证据，禁止以客户或收款账户所在地直接下结论。",
    answer: "在虚构规则下，应逐项识别构成收入的业务活动、执行主体和交付地点。合同和收款记录只是证据链的一部分；若关键执行记录缺失，不应作出确定的归属结论。",
    modelId: "cedar-reasoner", tags: ["公开演示", "非真实法源", "跨境服务", "事实识别"],
  }, 1),
  fictionalCase({
    id: "DEMO-SG-003", title: "关联服务成本分摊与证据要求", region: "新加坡", category: "数值与计算", difficulty: "中等",
    summary: "计算关联服务成本的分摊金额，说明成本池、受益权重和复核记录的证据要求。",
    question: "【虚构税务场景】新加坡星湾公司与两家关联企业共享服务，演示成本池为100单位、受益权重为2:3:5。请给出分摊结果，并区分算术正确与交易条件得到证明这两件事；所有条件仅为演示设定。",
    answer: "按演示权重，三方分摊为20、30、50单位。算术成立并不能证明成本池范围或受益权重适当，还需解释服务内容、受益记录和一致的分摊方法。",
    modelId: "harbor-deep", tags: ["公开演示", "非真实法源", "分摊计算", "关联服务"],
  }, 2),
  fictionalCase({
    id: "DEMO-MY-004", title: "软件订阅付款的分类与申报信息", region: "马来西亚", category: "表格与申报", difficulty: "中等",
    summary: "区分软件订阅与支持服务的付款性质，列明分类和申报准备所需信息。",
    question: "【虚构税务场景】马来西亚谷原公司向境外服务商支付软件订阅和支持费用，合同将两项收费合并。请按演示规则D-401提出分类问题、需补材料及申报准备步骤，不提供真实税率或法定表格名称。",
    answer: "应先区分取得的使用权、技术支持与其他服务，并补齐合同分项、交易对方和履行信息。演示规则不能推导真实税率或申报期限，材料不足的部分应保留待确认。",
    modelId: "aster-scholar", tags: ["公开演示", "非真实法源", "付款分类", "申报准备"],
  }, 3),
];

/** Eight explicitly fictional trial inputs; ten-question trials include two labelled variants. */
export const experienceQuestions = [
  {
    id: "DEMO-EX-001", region: "中国内地", category: "规则与来源适用",
    question: "【独立虚构体验题，非真实税法】松岚研究室的体验资料中，演示规则E-101甲版只适用于服务A，乙版只适用于服务B。当前任务属于服务B，但工作底稿引用了甲版。请说明应如何选择演示依据、记录版本，并指出仅凭旧底稿不能确认什么。",
    answer: "应先确认任务确属演示服务B，再使用适用于B的E-101乙版，并在底稿记录版本、适用范围和引用位置。甲版可以作为历史材料保留，不能直接替代乙版依据。仅凭旧底稿无法确认当前判断有效，也不能据这些虚构规则推导任何真实税务结论。",
  },
  {
    id: "DEMO-EX-002", region: "中国香港", category: "数值与计算",
    question: "【独立虚构体验题，非真实税法】香港青屿实验组有三笔模拟记录：已核验48单位、已核验32单位、凭证缺失20单位。虚构规则E-102要求仅汇总已核验记录，缺件单独列示且不得记为零。请计算当前确认合计、待补金额和全部记录名义合计，并说明三者的区别。",
    answer: "当前已核验合计为48+32=80单位，待补记录为20单位，全部记录名义合计为100单位。80表示按演示规则可确认的部分，20仍需补证；100只是清单合计，不代表全部已经核实。缺失凭证不能把20改写成零，也不能把100作为真实应税金额。",
  },
  {
    id: "DEMO-EX-003", region: "新加坡", category: "表格与申报",
    question: "【独立虚构体验题，非真实税法】新加坡橙洲实验组填写虚构体验单T-03。演示清单要求主体标识、材料期间、复核人三项齐备才能标为“待提交”；现有前两项，复核人尚未填写。请给出当前状态、补正步骤和可以保留的记录，不使用任何真实法定表格或期限。",
    answer: "当前应标为“待补正”，不能标为“待提交”或“已提交”。应补充有授权的演示复核人并记录复核时间，再按T-03清单检查三项是否齐备。已填写的主体标识和材料期间可以保留并注明来源。这里的状态和清单仅为交互设定，不对应真实申报义务或截止日期。",
  },
  {
    id: "DEMO-EX-004", region: "马来西亚", category: "争议处理与裁判适用",
    question: "【独立虚构体验题，非真实税法】马来西亚榕叶实验组收到两份互相冲突的演示文件：未签署的草稿称交付已完成，双方确认的补充记录称仍缺附件。虚构规则E-104要求优先核对双方确认记录，并保留冲突说明。请拟定复核结论与下一步证据请求，不引用真实判例。",
    answer: "按虚构E-104，应以双方确认的补充记录作为当前复核依据，将交付状态保留为“附件待补”，而不是认定全部完成。应并列保存草稿与确认记录，记录冲突内容、版本和来源，向相关人员请求缺失附件及交付确认。该处理仅解释演示证据关系，不是实际裁判结论。",
  },
  {
    id: "DEMO-EX-005", region: "中国内地", category: "年度与规则变化",
    question: "【独立虚构体验题，非真实税法】中国内地北溪实验组把记录分为演示期A和演示期B。规则E-105新稿明确只适用于B，旧稿仍适用于A；一份合并底稿把两期全部改用了新稿。请说明如何拆分复核、保留修订痕迹，以及不能从这一设定推导的真实税务事项。",
    answer: "应先按记录所属演示期拆分：A期按旧稿复核，B期按新稿复核，并逐项记录所用版本和适用范围。对合并底稿保留原值、修订值、修改理由和复核日期，不能无痕替换。A/B不是实际纳税年度，虚构新稿也不证明任何真实法规的生效、追溯适用或税率变化。",
  },
  {
    id: "DEMO-EX-006", region: "中国香港", category: "事实情境分析",
    question: "【独立虚构体验题，非真实税法】香港石湾实验组的一份演示合同列了三项交付，邮件只确认其中两项，第三项只有口头说明。体验规则E-106要求每项结论至少对应一份可查记录。请区分已支持与待确认事项，并列出一项最小补证请求，不因合同已签就推定全部履行。",
    answer: "前两项可以标记为“有邮件支持”，但仍应记录邮件与具体交付的对应关系；第三项应标为“待补证”，口头说明不能替代体验规则要求的可查记录。最小补证请求是第三项交付的接收确认或可核验交付记录。合同已签只能说明合同存在，不能证明所有交付均完成。",
  },
  {
    id: "DEMO-EX-007", region: "新加坡", category: "数值与计算",
    question: "【独立虚构体验题，非真实税法】新加坡苔原实验组有96个演示预算单位，约定按已核验工作量3:1分给甲乙两组；其中乙组的工作量证明尚未复核。请给出按约定比例的暂算结果，并说明为何算术结果不能直接升级为最终确认结果。不提供真实税率。",
    answer: "按3:1暂算，甲组为96×3/4=72单位，乙组为96×1/4=24单位，两者合计96。这个结果只证明算术遵守设定比例，不能证明乙组工作量或比例基础已经核实。应将72/24标为暂算，补查乙组证明并完成复核后再确认，不能将演示单位解释成实际税额。",
  },
  {
    id: "DEMO-EX-008", region: "马来西亚", category: "规则与来源适用",
    question: "【独立虚构体验题，非真实税法】马来西亚蒲雨实验组保存一张演示规则E-108截图，缺少版本号和完整上下文；一份内部摘要却将它写成无条件规则。请说明当前能否确认该摘要、应补哪些来源信息，以及在依据不完整时如何表述结论。",
    answer: "当前不能确认内部摘要是完整且适用的规则表达。应补充E-108的完整演示原文、版本号、适用范围及截图前后段落，并核对有无条件或例外。补证前可写“依据不完整，暂不作无条件判断”，保留摘要作为待复核材料。这里没有真实法律效力或真实税率信息。",
  },
];

export const meta = {
  mock: true,
  demo: true,
  title: "TaxBench 演示研究工作台",
  label: "全部数据均为模拟",
  version: "2026.10-demo",
  updatedAt: "2026-10-25",
  totalQuestions: 240,
  privateQuestionCount: 240,
  experienceQuestionCount: 8,
  publicCaseCount: cases.length,
  modelCount: models.length,
  regionCount: regions.length,
  categoryCount: categoryOptions.length,
  benchmark: {
    id: "private-tax240-demo", name: "四地区税务能力基准 · 演示元数据", version: "2026.10-demo",
    questionCount: 240, isPrivate: true, contentExposed: false,
  },
  disclaimer: "所有模型、供应商、成绩、成本与引用均为虚构演示。240道私有基准题仅展示元数据，不提供题目；8道体验题和公开案例独立编写，不来自私有题库。10题体验包含2道明确标注的演示变体。不产生模型费用。",
};
