const { similarity } = require("./similarity");
const { callModel } = require("./modelProvider");
const { buildRewriteRetryMessages } = require("./promptBuilder");

const QUICK_CHAT_STARTERS = [
  "帮我改得更像小红书",
  "帮我改得更适合直播间",
  "保留饥饿营销，但不要显得虚假",
  "写得更短更有记忆点",
  "强化学生党购买理由",
  "强化成分党信任感",
  "改得更高级，不要像硬广",
  "帮我生成3个标题",
  "帮我生成海报主标题",
  "帮我生成最终投放版"
];

const rewriteStrategies = [
  {
    name: "稀缺感事实化",
    wrong: "最后3个名额，错过就没了",
    better: "本轮活动名额有限，适合已经在比较同类产品的人先锁定权益"
  },
  {
    name: "焦虑感场景化",
    wrong: "再不买就亏大了",
    better: "如果你最近正好需要换新，这轮活动可以先作为对比参考"
  },
  {
    name: "功效表达体验化",
    wrong: "3天白一个度",
    better: "主打提亮和改善暗沉，适合想让肤色看起来更干净的人群"
  },
  {
    name: "低价表达规则化",
    wrong: "全网最低价",
    better: "当前活动价以官方页面为准，适合想趁节点入手的人先关注"
  },
  {
    name: "强推表达圈层化",
    wrong: "闭眼入",
    better: "适合懒得做复杂功课、想要稳定选择的新手用户"
  },
  {
    name: "权威表达证据化",
    wrong: "专家推荐",
    better: "如有检测报告或专业背书，可在详情页补充来源说明"
  }
];

function cleanText(value) {
  return String(value || "").trim();
}

function sentence(value) {
  return cleanText(value).replace(/[。！？!?\s]+$/g, "");
}

function getRequestFromResult(auditResult = {}) {
  const req = auditResult.originalRequest || auditResult.request || {};
  if (req.product && req.creative && req.context) return req;
  return {
    product: {
      name: req.productName || auditResult.basicInfo?.productName || "这款产品",
      category: auditResult.basicInfo?.category || req.productCategory || "其他",
      priceRange: req.priceRange || "",
      sellingPoints: splitLines(req.sellingPoints),
      proofMaterials: splitLines(req.proofMaterials)
    },
    creative: {
      text: auditResult.originalText || req.text || "",
      imageTexts: req.imageText ? [req.imageText] : [],
      imageDescriptions: [],
      objective: req.adGoal || auditResult.basicInfo?.objective || "种草"
    },
    context: {
      platform: auditResult.basicInfo?.platform || req.targetPlatform || "通用",
      targetAudience: auditResult.basicInfo?.detectedAudience || req.targetAudience || "目标消费者",
      marketingStyle: auditResult.basicInfo?.marketingStyle || req.marketingStyle || "专业可信",
      complianceMode: req.complianceStrength || "balanced"
    }
  };
}

function splitLines(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value || "")
    .split(/\n|；|;|、/)
    .map(item => item.trim())
    .filter(Boolean);
}

function joinPoints(points) {
  return (points || []).map(cleanText).filter(Boolean).join("、") || "卖点清晰、适合按需选择";
}

function proofLine(request) {
  return request.product.proofMaterials.length
    ? `可参考：${request.product.proofMaterials.join("、")}`
    : "建议以官方页面、真实反馈和活动规则为准";
}

function buildFallbackRewrites(request) {
  const product = cleanText(request.product.name) || "这款产品";
  const points = joinPoints(request.product.sellingPoints);
  const proof = proofLine(request);
  const platform = request.context.platform || "通用";

  return {
    highTrustVersion: `【先看清楚再选择】\n${product}主打${points}。它更适合想先确认依据、再决定是否尝试的人。${proof}。如果你的需求与使用场景匹配，可以先查看详情页说明，再决定是否购买或咨询。`,
    highConversionVersion: `【正在比较同类产品，先看这款】\n如果你已经有明确需求，${product}可以重点了解。核心卖点是${points}，当前权益以页面规则为准。建议先锁定活动入口，再结合证明材料和自身需求做最终判断。现在可以先咨询或领取权益。`,
    seedingVersion: `【这款我会先放进备选】\n最近在看同类产品时，${product}比较值得留意。吸引我的点是${points}。它不是人人都必须买，更适合需求接近、想少踩坑的人。建议先看说明和真实反馈，再决定要不要入手。`,
    softUrgencyVersion: `【这轮活动适合先锁定】\n如果你最近正好在比较同类产品，${product}这一轮权益可以先关注。重点卖点是${points}，限时、名额或权益请以官方页面规则为准。适合已经有需求的人先确认是否匹配，避免后面重新比较。`,
    platformAdaptedVersion: buildPlatformVersion(platform, product, points, proof)
  };
}

function buildPlatformVersion(platform, product, points, proof) {
  if (platform.includes("小红书")) {
    return `【不是闭眼入，但值得收藏】\n做了一轮同类对比后，${product}比较适合先放进备选。它的亮点是${points}，表达不需要夸张，重点是看它是否符合你的使用场景。${proof}，建议按需选择。`;
  }
  if (platform.includes("抖音")) {
    return `【先说结论】\n正在找同类产品的人，可以先看${product}。核心卖点：${points}。活动权益看页面规则，有需求就先点进来对比，别只看一句口号。`;
  }
  if (platform.includes("私域") || platform.includes("微信")) {
    return `【给大家一个理性参考】\n${product}适合有相关需求的人先了解。卖点是${points}。${proof}。需要的话可以先私信确认是否匹配，再决定要不要下单。`;
  }
  if (platform.includes("电商") || platform.includes("详情页") || platform.includes("淘宝") || platform.includes("天猫") || platform.includes("京东")) {
    return `【适用场景】有相关需求，并希望先看清卖点的人。\n【核心卖点】${points}\n【购买建议】${proof}。下单前建议确认规格、活动规则和适用条件。\n【行动入口】查看详情页并对比是否适合自己。`;
  }
  if (platform.includes("海报") || platform.includes("线下")) {
    return `【${product}】\n${points}\n活动规则以页面或门店说明为准，有需求可扫码咨询。`;
  }
  return `【先了解，再选择】\n${product}的核心价值是${points}。${proof}。建议结合目标平台调整表达节奏，并保留清晰的咨询或购买入口。`;
}

function buildRewriteRationales(result) {
  const barriers = result.diagnosis?.trustBarriers || [];
  return [
    "五个版本均重新组织标题、卖点、信任依据和CTA，避免只替换关键词。",
    "高转化版保留权益、行动召唤和选择理由，但把紧迫感落到具体规则。",
    "温和紧迫版保留限时、权益、错过成本等行动推动力，同时避免虚假稀缺。",
    "种草真实版用体验语气替代硬性承诺，更适合内容平台。",
    "平台适配版按目标渠道调整信息密度、语气和行动入口。",
    ...barriers.slice(0, 2).map(item => `针对“${item.name || item}”降低了信任阻碍。`)
  ];
}

async function ensureRewriteDiversity({ request, result }) {
  const keys = [
    ["highTrustVersion", "高信任版"],
    ["highConversionVersion", "高转化版"],
    ["seedingVersion", "种草真实版"],
    ["softUrgencyVersion", "温和紧迫版"],
    ["platformAdaptedVersion", "平台适配版"]
  ];
  const original = request.creative.text;

  for (const [key, label] of keys) {
    const current = result.rewrites?.[key] || "";
    if (!current || similarity(original, current) <= 0.65) continue;

    try {
      const raw = await callModel({
        messages: buildRewriteRetryMessages({ request, versionName: label, currentRewrite: current }),
        temperature: 0.85
      });
      const parsed = JSON.parse(String(raw).replace(/^```json\s*|\s*```$/g, ""));
      if (parsed.rewrite && similarity(original, parsed.rewrite) <= 0.65) {
        result.rewrites[key] = parsed.rewrite;
        result.rewriteRationales = [
          ...(result.rewriteRationales || []),
          parsed.rationale || `${label}已重新组织文案结构。`
        ];
      }
    } catch (error) {
      const fallback = buildFallbackRewrites(request);
      result.rewrites[key] = fallback[key] || current;
      result.rewriteRationales = [
        ...(result.rewriteRationales || []),
        `${label}使用本地完整改写兜底，避免只做关键词替换。`
      ];
    }
  }

  return result;
}

function inferVersionName(userMessage) {
  if (/标题|海报/.test(userMessage)) return "标题方案";
  if (/最终|投放/.test(userMessage)) return "最终投放版";
  if (/小红书|种草/.test(userMessage)) return "种草真实版";
  if (/直播|促销|转化/.test(userMessage)) return "高转化版";
  if (/饥饿|紧迫|限时|错过/.test(userMessage)) return "温和紧迫版";
  if (/高级|官方|可信|成分/.test(userMessage)) return "高信任版";
  return "追问改写版";
}

function pickVariant(list, history = []) {
  const completedTurns = Math.ceil((history?.length || 0) / 2);
  return list[completedTurns % list.length];
}

function buildCopyByIntent({ auditResult, currentCopy, userMessage, history = [] }) {
  const request = getRequestFromResult(auditResult);
  const product = cleanText(request.product.name) || auditResult.basicInfo?.productName || "这款产品";
  const points = joinPoints(request.product.sellingPoints);
  const platform = auditResult.basicInfo?.platform || request.context.platform || "通用";
  const audience = auditResult.basicInfo?.detectedAudience || request.context.targetAudience || "目标消费者";
  const baseCta = platform.includes("私域") ? "需要的话可以先私信确认" : platform.includes("电商") ? "现在查看详情页并对比是否适合" : "可以先收藏或咨询了解";

  if (/3个标题/.test(userMessage)) {
    return pickVariant([
      `1. ${product}适合谁？先看这3个卖点\n2. 别急着下单，先确认${points.split("、")[0] || "核心需求"}\n3. ${audience}可以先关注的${product}选择`,
      `1. ${audience}别急着买，先看${product}是否匹配\n2. ${points.split("、")[0] || "核心卖点"}，是不是你的真实需求？\n3. 想少踩坑，先把${product}放进对比清单`
    ], history);
  }
  if (/海报主标题|标题/.test(userMessage)) {
    return pickVariant([
      `${product}\n${points.split("、").slice(0, 2).join(" · ")}\n${baseCta}`,
      `${points.split("、")[0] || product}，先看清再选择\n${product} · 活动规则以页面为准\n${baseCta}`
    ], history);
  }
  if (/小红书/.test(userMessage)) {
    return pickVariant([
      `【不是硬广，是真的先放进备选】\n最近在对比同类产品，${product}让我比较有兴趣的是${points}。它不是那种“闭眼入”的表达，更适合${audience}先看自己的需求。建议把说明、反馈和活动规则一起看，合适再入手。`,
      `【我会先收藏再慢慢对比】\n${product}比较打动我的地方是${points}。不想把它写成“必买”，更像是给${audience}一个参考：先看适用条件和真实反馈，和自己的需求对得上再下单。`
    ], history);
  }
  if (/直播/.test(userMessage)) {
    return pickVariant([
      `先看这里，正在比较同类产品的朋友可以停一下。${product}的重点是${points}，活动权益以页面规则为准。适合有明确需求的人先拍下或咨询，确认适合再下单。`,
      `直播间先说重点：${product}不是让所有人都冲，适合正在找这类产品的人。核心卖点是${points}。权益看页面说明，想要的先咨询，确认匹配再下单。`
    ], history);
  }
  if (/饥饿|紧迫|限时|错过/.test(userMessage)) {
    return pickVariant([
      `【这轮权益适合先锁定】\n如果你最近正好需要，${product}可以先关注。本轮权益以官方页面为准，核心卖点是${points}。不是催你立刻买，而是适合已经在比较的人先确认规则，避免后面重新做功课。`,
      `【别被催着买，但可以先占住权益】\n${product}这轮活动适合已经有需求的人先看看。卖点是${points}，权益、时间和数量以官方页面为准。确定适合再下单，避免错过当前可对比的活动窗口。`
    ], history);
  }
  if (/短|记忆点/.test(userMessage)) {
    return `${product}，主打${points.split("、").slice(0, 2).join("、")}。有需求先看规则和说明，适合再下单。`;
  }
  if (/学生/.test(userMessage)) {
    return `【预算有限也别盲买】\n${product}适合想先看清卖点的学生党。重点是${points}，建议先确认价格、活动权益和适用条件。合适再入手，降低试错成本。`;
  }
  if (/成分/.test(userMessage)) {
    return `【给成分党看的版本】\n${product}主打${points}。建议重点查看成分说明、检测依据和适用条件。不要只看夸张效果词，先确认是否符合自己的需求，再决定是否购买。`;
  }
  if (/高级/.test(userMessage)) {
    return `【克制一点，也更可信】\n${product}的价值在于${points}。表达上不做过度承诺，更建议用户基于真实需求、产品说明和活动规则做判断。适合的人，可以进一步查看详情或咨询。`;
  }

  return pickVariant([
    `${sentence(currentCopy) || `【先了解${product}】\n${product}主打${points}`}。\n根据你的要求，文案已重新组织为更清晰的标题、卖点和行动入口。${baseCta}。`,
    `【换个更好转化的说法】\n${product}主打${points}。这版先筛选${audience}，再给出选择理由和行动入口。${baseCta}。`
  ], history);
}

function buildFinalVersion({ auditResult, currentCopy, history = [] }) {
  const request = getRequestFromResult(auditResult);
  const product = cleanText(request.product.name) || auditResult.basicInfo?.productName || "这款产品";
  const platform = auditResult.basicInfo?.platform || request.context.platform || "通用";
  const audience = auditResult.basicInfo?.detectedAudience || request.context.targetAudience || "目标消费者";
  const copy = currentCopy || auditResult.rewrites?.platformVersion || auditResult.rewrites?.platformAdaptedVersion || "";
  const finalTitle = platform.includes("海报")
    ? `${product}，先看清权益再选择`
    : `${product}适合${audience}先了解`;

  return {
    finalTitle,
    finalCopy: copy || buildCopyByIntent({ auditResult, currentCopy, userMessage: "帮我生成最终投放版" }),
    cta: platform.includes("私域") ? "私信确认是否匹配" : platform.includes("电商") ? "查看详情页并确认活动规则" : "先收藏或咨询了解",
    whyThisWorks: [
      "标题先筛选目标人群，降低无效触达。",
      "正文保留核心卖点和行动入口，避免只做说明文。",
      "紧迫感来自活动规则和权益提醒，不制造虚假稀缺。",
      "保留信任边界，提醒用户结合说明和自身需求判断。"
    ],
    recommendedPlatform: platform,
    abTestSuggestion: [
      "A版突出信任依据，测试收藏和咨询。",
      "B版突出权益和CTA，测试点击和转化。",
      "标题可测试“人群筛选型”与“利益点直给型”。"
    ]
  };
}

function buildFallbackChatResponse({ auditResult, currentCopy = "", userMessage, history = [] }) {
  const versionName = inferVersionName(userMessage);
  const newCopy = buildCopyByIntent({ auditResult, currentCopy, userMessage, history });
  const finalVersion = /最终|投放/.test(userMessage)
    ? buildFinalVersion({ auditResult, currentCopy: newCopy, history })
    : null;

  return {
    reply: finalVersion ? "已生成最终投放版，可直接复制或导出。" : `已生成${versionName}，可继续追问微调。`,
    newCopy,
    newRewrite: newCopy,
    versionName,
    changeNotes: [
      "重新组织标题、卖点和CTA。",
      "保留核心卖点与营销张力。",
      "降低绝对化、无依据背书和虚假稀缺。"
    ],
    scoresAfterRewrite: {
      trustScore: 80,
      conversionAppeal: 82,
      audienceFit: 78,
      sellingPointClarity: 84,
      complianceSafety: 82
    },
    finalVersion
  };
}

module.exports = {
  QUICK_CHAT_STARTERS,
  rewriteStrategies,
  buildFallbackRewrites,
  buildRewriteRationales,
  ensureRewriteDiversity,
  buildFallbackChatResponse,
  buildFinalVersion
};
