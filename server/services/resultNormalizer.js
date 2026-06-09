const { z } = require("zod");
const { QUICK_CHAT_STARTERS, buildFallbackRewrites, buildRewriteRationales } = require("./rewriteService");

const DISCLAIMER = "本报告仅用于广告信任与转化优化、消费者理解分析和文本改写建议，不构成法律意见或平台审核结论。正式发布前，建议结合企业内部规范、平台规则和专业意见进行复核。";

const auditSchema = z.object({
  product: z.object({
    name: z.string().max(100).default(""),
    category: z.string().max(50).default("其他"),
    priceRange: z.string().max(100).default(""),
    sellingPoints: z.array(z.string()).max(20).default([]),
    proofMaterials: z.array(z.string()).max(20).default([])
  }),
  creative: z.object({
    text: z.string().min(1, "广告文案不能为空").max(5000, "广告文案不能超过5000字"),
    imageTexts: z.array(z.string()).max(20).default([]),
    imageDescriptions: z.array(z.string()).max(20).default([]),
    objective: z.string().max(50).default("种草")
  }),
  context: z.object({
    platform: z.string().max(50).default("通用"),
    targetAudience: z.string().max(50).default("自动推断"),
    marketingStyle: z.string().max(50).default("专业可信"),
    complianceMode: z.enum(["loose", "balanced", "strict"]).default("balanced")
  })
});

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function splitList(value) {
  return String(value || "")
    .split(/\n|；|;|、/)
    .map(item => item.trim())
    .filter(Boolean);
}

function parseJsonLoose(raw) {
  const text = String(raw || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");
  try {
    return JSON.parse(text);
  } catch (error) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw error;
  }
}

function validateAuditRequest(body) {
  const parsed = auditSchema.safeParse(body);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "请求参数不合法" };
  }
  return { data: parsed.data };
}

function normalizeLegacyRequest(body) {
  if (body?.product && body?.creative && body?.context) return body;

  return {
    product: {
      name: body?.productName || "",
      category: categoryLabel(body?.productCategory || body?.industry),
      priceRange: body?.priceRange || "",
      sellingPoints: splitList(body?.sellingPoints),
      proofMaterials: splitList(body?.proofMaterials)
    },
    creative: {
      text: body?.text || "",
      imageTexts: [body?.imageText].filter(Boolean),
      imageDescriptions: (body?.images || []).map(image => `${image.name || "上传图片"}，类型：${body?.imageType || "未选择"}`),
      objective: goalLabel(body?.adGoal)
    },
    context: {
      platform: platformLabel(body?.targetPlatform),
      targetAudience: audienceLabel(body?.targetAudience),
      marketingStyle: styleLabel(body?.marketingStyle),
      complianceMode: body?.complianceStrength || "balanced"
    }
  };
}

function categoryLabel(value) {
  return {
    beauty: "美妆护肤",
    food: "食品饮料",
    education: "教育培训",
    fashion: "服饰穿搭",
    digital: "数码家电",
    pet: "宠物用品",
    local_life: "本地生活",
    ai_tool: "AI工具",
    other: "其他"
  }[value] || value || "其他";
}

function platformLabel(value) {
  return {
    xiaohongshu: "小红书",
    douyin: "抖音",
    shipinhao: "视频号",
    tmall: "电商详情页",
    jd: "电商详情页",
    wechat: "微信私域",
    offline: "线下海报",
    general: "通用"
  }[value] || value || "通用";
}

function audienceLabel(value) {
  return {
    auto: "自动推断",
    student: "学生党",
    white_collar: "精致白领",
    ingredient: "成分党",
    price_sensitive: "价格敏感型",
    result_oriented: "功效导向型",
    beginner: "新手小白",
    expert: "专业达人",
    mom: "宝妈人群",
    senior: "银发人群",
    other: "其他"
  }[value] || value || "自动推断";
}

function styleLabel(value) {
  return {
    seeding: "真实种草",
    trustworthy: "专业可信",
    conversion: "高转化促销",
    gentle_urgency: "温和紧迫",
    emotional: "情绪共鸣",
    premium: "高级品牌感",
    young: "年轻化口语",
    live_interactive: "直播间强互动"
  }[value] || value || "专业可信";
}

function goalLabel(value) {
  return {
    seeding: "种草",
    promotion: "促销转化",
    live: "直播带货",
    launch: "新品上市",
    trust_repair: "品牌信任修复",
    private_conversion: "私域社群转化"
  }[value] || value || "种草";
}

function inferBarriers(request, legalReferences) {
  const text = [
    request.creative.text,
    ...request.creative.imageTexts,
    ...request.product.sellingPoints
  ].join(" ");
  const barriers = [];

  legalReferences.forEach(rule => {
    const hit = (rule.highRiskPatterns || rule.forbiddenPatterns || []).some(pattern => text.includes(pattern));
    if (hit) {
      barriers.push({
        name: rule.topic,
        impactOnTrust: rule.summary,
        impactOnConversion: "消费者可能对真实性、适用条件或活动规则产生疑虑。",
        suggestion: `建议改用：${(rule.saferAlternatives || rule.allowedAlternatives || []).join("、")}`,
        complianceRelated: true
      });
    }
  });

  if (!barriers.length && !request.product.proofMaterials.length) {
    barriers.push({
      name: "证明材料不足",
      impactOnTrust: "当前卖点缺少可验证依据。",
      impactOnConversion: "用户可能知道卖点，但缺少立即行动的信心。",
      suggestion: "补充检测报告、用户反馈、活动规则或产品说明。",
      complianceRelated: false
    });
  }

  return barriers.slice(0, 6);
}

function scoreFromRequest(request, barriers) {
  const hasProof = request.product.proofMaterials.length > 0;
  const hasCta = /下单|领取|预约|咨询|私信|购买|报名|锁定|查看/.test(request.creative.text);
  const clarity = request.product.sellingPoints.length ? 80 : 58;
  const penalty = barriers.length * 6;
  const trustScore = clamp((hasProof ? 84 : 65) - penalty);
  const conversionAppeal = clamp((hasCta ? 78 : 62) + (request.context.marketingStyle.includes("转化") ? 8 : 0));
  const audienceFit = clamp(request.context.targetAudience === "自动推断" ? 68 : 78);
  const sellingPointClarity = clamp(clarity);
  const complianceSafety = clamp(86 - penalty + (request.context.complianceMode === "strict" ? 6 : request.context.complianceMode === "loose" ? -6 : 0));

  return {
    trustScore,
    conversionAppeal,
    audienceFit,
    sellingPointClarity,
    complianceSafety,
    overallMarketingScore: clamp((trustScore + conversionAppeal + audienceFit + sellingPointClarity + complianceSafety) / 5)
  };
}

function buildFallbackResult({ request, caseReferences, legalReferences, platformReferences = [], notice = "" }) {
  const trustBarriers = inferBarriers(request, legalReferences);
  const scores = scoreFromRequest(request, trustBarriers);
  const rewrites = buildFallbackRewrites(request);
  const detectedAudience = request.context.targetAudience === "自动推断" ? inferAudience(request) : request.context.targetAudience;
  const imageAnalysis = buildImageAnalysis(request);

  const result = {
    id: `audit-${Date.now()}`,
    createdAt: new Date().toISOString(),
    basicInfo: {
      productName: request.product.name,
      category: request.product.category,
      platform: request.context.platform,
      objective: request.creative.objective,
      detectedAudience,
      detectedCircle: detectedAudience,
      marketingStyle: request.context.marketingStyle
    },
    scores,
    consumerInsight: {
      persona: detectedAudience,
      circlePreference: circlePreference(detectedAudience),
      purchaseMotivation: request.creative.objective.includes("促销")
        ? "希望用清晰权益降低决策成本"
        : "希望先建立信任，再判断是否值得尝试",
      mainObjections: trustBarriers.map(item => item.name),
      preferredLanguage: preferredLanguage(detectedAudience),
      purchaseTriggers: ["真实依据", "明确卖点", "清晰行动入口"]
    },
    diagnosis: {
      trustBarriers,
      conversionBlockers: buildConversionBlockers(request, scores),
      effectiveElements: buildEffectiveElements(request),
      complianceGuardrails: legalReferences.map(rule => `${rule.topic}：${rule.summary}`).slice(0, 5),
      platformAdaptation: buildPlatformAdaptation(platformReferences),
      imageAnalysis
    },
    imageAnalysis,
    caseReferences,
    legalReferences,
    platformReferences,
    rewrites,
    rewriteRationales: [],
    chatStarters: QUICK_CHAT_STARTERS,
    markdownReport: "",
    disclaimer: DISCLAIMER,
    notice: notice || "当前为本地演示模式，配置 DeepSeek 后可获得深度分析。"
  };

  result.rewriteRationales = buildRewriteRationales(result);
  result.markdownReport = buildMarkdownReport(result);
  return result;
}

function inferAudience(request) {
  const text = `${request.product.category} ${request.product.name} ${request.product.sellingPoints.join(" ")} ${request.creative.text}`;
  if (/成分|配方|检测|报告/.test(text)) return "成分党";
  if (/学生|平价|预算|性价比/.test(text)) return "学生党";
  if (/通勤|精致|效率|质感/.test(text)) return "精致白领";
  if (/宝妈|孩子|家庭/.test(text)) return "宝妈人群";
  return "功效导向型";
}

function circlePreference(audience) {
  if (audience.includes("成分")) return "偏好成分、参数、检测来源和适用条件，反感空泛功效承诺。";
  if (audience.includes("学生")) return "偏好性价比、真实体验和低试错成本，反感高压促销。";
  if (audience.includes("白领")) return "偏好效率、质感、稳定体验和克制表达。";
  return "偏好明确问题、真实依据、可理解的购买理由。";
}

function preferredLanguage(audience) {
  if (audience.includes("成分")) return ["成分", "检测", "适用肤质", "依据"];
  if (audience.includes("学生")) return ["平价", "预算友好", "入门", "不盲买"];
  if (audience.includes("白领")) return ["省心", "通勤", "质感", "稳定"];
  return ["适用条件", "真实反馈", "场景", "选择理由"];
}

function buildConversionBlockers(request, scores) {
  const blockers = [];
  if (!request.product.sellingPoints.length) blockers.push("卖点不够清晰，用户难以快速理解产品价值。");
  if (!request.product.proofMaterials.length) blockers.push("证明材料不足，可信度支撑不够。");
  if (scores.conversionAppeal < 70) blockers.push("行动召唤偏弱，缺少明确下一步动作。");
  if (!blockers.length) blockers.push("当前转化链路较完整，建议继续强化证据和平台表达细节。");
  return blockers;
}

function buildEffectiveElements(request) {
  const items = [];
  if (request.product.sellingPoints.length) items.push(`已有核心卖点：${request.product.sellingPoints.join("、")}`);
  if (request.creative.objective) items.push(`广告目标清晰：${request.creative.objective}`);
  if (request.context.platform !== "通用") items.push(`投放平台明确：${request.context.platform}`);
  return items.length ? items : ["已有基础广告文本，可继续强化消费者画像和购买理由。"];
}

function buildImageAnalysis(request) {
  const imageTexts = request.creative.imageTexts || [];
  const imageDescriptions = request.creative.imageDescriptions || [];
  const joinedText = imageTexts.join("\n");
  const adText = request.creative.text || "";
  const hasImage = imageTexts.length > 0 || imageDescriptions.length > 0;
  const hasCta = /下单|领取|咨询|预约|购买|报名|扫码|私信|点击|查看|立即/.test(joinedText);
  const hasPrice = /¥|￥|元|折|券|优惠|满减|到手价|活动价/.test(joinedText);
  const hasOverClaim = /第一|最好|最佳|100%|必瘦|必过|全网最低|根治|包治|3天/.test(joinedText);

  return {
    imageTexts,
    visualDescriptions: imageDescriptions,
    hierarchyJudgement: hasImage
      ? "已纳入图片文字和视觉描述。建议现场补充主标题、卖点、价格和CTA，系统会一起参与诊断。"
      : "未上传图片素材，本次主要基于文字文案诊断。",
    headlineClarity: joinedText.length > 8 ? "可判断：已有可用于分析的图片文字。" : "待补充：建议手动输入图片主标题。",
    sellingPointVisibility: imageTexts.some(text => /主打|卖点|适合|成分|权益|课程|功能|优势/.test(text))
      ? "图片中已有卖点线索。"
      : "待优化：建议让核心卖点更直观可见。",
    ctaClarity: hasCta ? "CTA较明确。" : "CTA不够明确，建议补充下一步动作。",
    visualTrust: hasOverClaim ? "存在过度承诺或无来源强背书风险，建议弱化并补充依据。" : "未发现明显过度承诺线索，仍建议核对背书来源。",
    textConsistency: joinedText && adText
      ? "图片文字已与广告文案一起纳入诊断，建议保持卖点、价格和活动规则一致。"
      : "图片与文案一致性待补充素材后判断。",
    marketingObservations: [
      joinedText ? "图片文字已进入诊断上下文。" : "请手动补充图片中的主标题、卖点、价格和CTA。",
      hasPrice ? "价格或权益信息有线索，建议确认规则是否完整。" : "价格、优惠或权益不够清晰。",
      hasCta ? "行动召唤有线索。" : "CTA不够明确。",
      hasOverClaim ? "图片中可能存在过度承诺或绝对化表达。" : "暂未发现明显过度承诺。"
    ]
  };
}

function buildPlatformAdaptation(platformReferences = []) {
  return (platformReferences || []).map(item => ({
    platform: item.platform,
    contentStyle: item.contentStyle,
    preferredStructure: item.preferredStructure || [],
    trustSignals: item.trustSignals || [],
    conversionSignals: item.conversionSignals || [],
    avoidPatterns: item.avoidPatterns || [],
    rewriteTips: item.rewriteTips || []
  }));
}

function normalizeAiResult({ aiResult, fallbackResult, request, caseReferences, legalReferences, platformReferences = [] }) {
  const result = {
    ...fallbackResult,
    ...aiResult,
    id: fallbackResult.id,
    createdAt: fallbackResult.createdAt,
    caseReferences: aiResult.caseReferences?.length ? aiResult.caseReferences : caseReferences,
    legalReferences: aiResult.legalReferences?.length ? aiResult.legalReferences : legalReferences,
    platformReferences: aiResult.platformReferences?.length ? aiResult.platformReferences : platformReferences,
    disclaimer: DISCLAIMER,
    notice: ""
  };

  result.basicInfo = { ...fallbackResult.basicInfo, ...(aiResult.basicInfo || {}) };
  result.scores = normalizeScores({ ...fallbackResult.scores, ...(aiResult.scores || {}) });
  result.consumerInsight = { ...fallbackResult.consumerInsight, ...(aiResult.consumerInsight || {}) };
  result.diagnosis = { ...fallbackResult.diagnosis, ...(aiResult.diagnosis || {}) };
  result.diagnosis.platformAdaptation = result.diagnosis.platformAdaptation || buildPlatformAdaptation(result.platformReferences || []);
  result.imageAnalysis = aiResult.imageAnalysis || aiResult.diagnosis?.imageAnalysis || fallbackResult.imageAnalysis;
  result.diagnosis.imageAnalysis = result.imageAnalysis;
  result.rewrites = { ...fallbackResult.rewrites, ...(aiResult.rewrites || {}) };
  result.rewriteRationales = aiResult.rewriteRationales?.length ? aiResult.rewriteRationales : buildRewriteRationales(result);
  result.chatStarters = aiResult.chatStarters?.length ? Array.from(new Set([...aiResult.chatStarters, ...QUICK_CHAT_STARTERS])).slice(0, 10) : fallbackResult.chatStarters;
  result.markdownReport = buildMarkdownReport(result);
  result.originalRequest = request;
  return result;
}

function normalizeScores(scores) {
  const normalized = {
    trustScore: clamp(scores.trustScore),
    conversionAppeal: clamp(scores.conversionAppeal),
    audienceFit: clamp(scores.audienceFit),
    sellingPointClarity: clamp(scores.sellingPointClarity),
    complianceSafety: clamp(scores.complianceSafety),
    overallMarketingScore: clamp(scores.overallMarketingScore)
  };

  if (!normalized.overallMarketingScore) {
    normalized.overallMarketingScore = clamp(
      (normalized.trustScore + normalized.conversionAppeal + normalized.audienceFit + normalized.sellingPointClarity + normalized.complianceSafety) / 5
    );
  }

  return normalized;
}

function buildMarkdownReport(result) {
  return `# AdTrust AI 消费者信任与广告转化优化报告

## 1. 产品与素材信息
- 产品名称：${result.basicInfo.productName}
- 产品品类：${result.basicInfo.category}
- 投放平台：${result.basicInfo.platform}
- 广告目标：${result.basicInfo.objective}

## 2. 目标消费者画像
${result.consumerInsight.persona}

## 3. 圈层偏好判断
${result.consumerInsight.circlePreference}

## 4. 五维营销评分
- 消费者信任度：${result.scores.trustScore}
- 转化吸引力：${result.scores.conversionAppeal}
- 圈层匹配度：${result.scores.audienceFit}
- 卖点清晰度：${result.scores.sellingPointClarity}
- 合规安全度：${result.scores.complianceSafety}
- 综合营销分：${result.scores.overallMarketingScore}

## 5. 当前广告有效元素
${(result.diagnosis.effectiveElements || []).map(item => `- ${stringifyItem(item)}`).join("\n")}

## 6. 信任阻碍点
${(result.diagnosis.trustBarriers || []).map(item => `- ${typeof item === "string" ? item : `${item.name || "信任阻碍"}：${item.suggestion || item.impactOnTrust || ""}`}`).join("\n")}

## 7. 转化损耗点
${(result.diagnosis.conversionBlockers || []).map(item => `- ${stringifyItem(item)}`).join("\n")}

## 8. 合规底线提醒
${(result.diagnosis.complianceGuardrails || []).map(item => `- ${stringifyItem(item)}`).join("\n")}

## 9. 图片广告分析
- 图片文字提取：${(result.imageAnalysis?.imageTexts || []).join("；") || "未提供图片文字"}
- 视觉层级判断：${result.imageAnalysis?.hierarchyJudgement || "未上传图片素材"}
- 主标题清晰度：${result.imageAnalysis?.headlineClarity || "待判断"}
- 卖点突出度：${result.imageAnalysis?.sellingPointVisibility || "待判断"}
- CTA 明确度：${result.imageAnalysis?.ctaClarity || "待判断"}
- 视觉信任感：${result.imageAnalysis?.visualTrust || "待判断"}
- 图片与文案一致性：${result.imageAnalysis?.textConsistency || "待判断"}

## 10. 参考案例
${(result.caseReferences || []).map(item => `- ${item.title || item.id || item.industry}（${item.platform || "通用"}）：${(item.whyItWorks || []).join("、")}；可复用结构：${(item.usablePatterns || []).join("、")}`).join("\n")}

## 11. 参考规则摘要
${(result.legalReferences || []).map(item => `- ${item.topic}：${item.summary}；高风险表达：${(item.highRiskPatterns || item.forbiddenPatterns || []).join("、")}；替代表达：${(item.saferAlternatives || item.allowedAlternatives || []).join("、")}；营销建议：${item.marketingAdvice || "补充真实依据和适用条件。"}`).join("\n")}

## 12. 平台适配建议
${(result.platformReferences || []).map(item => `- ${item.platform}：${item.contentStyle}；推荐结构：${(item.preferredStructure || []).join(" → ")}；避免表达：${(item.avoidPatterns || []).join("、")}`).join("\n") || "- 暂无匹配平台规则，建议按通用结构优化。"}

## 13. 多风格改写结果
### 高信任版
${result.rewrites.highTrustVersion}

### 高转化版
${result.rewrites.highConversionVersion}

### 种草真实版
${result.rewrites.seedingVersion}

### 温和紧迫版
${result.rewrites.softUrgencyVersion}

### 平台适配版
${result.rewrites.platformAdaptedVersion}

## 14. 推荐最终版本
建议优先使用平台适配版，并根据实际活动规则补充具体时间、权益和适用条件。

## 15. 后续A/B测试建议
- A版测试高信任表达，观察收藏、咨询和停留。
- B版测试高转化表达，观察点击、私信和下单。
- 对比标题、行动召唤和证明材料位置对转化的影响。

## 16. 免责声明
${result.disclaimer}`;
}

function stringifyItem(item) {
  if (typeof item === "string") return item;
  return item.name || item.summary || item.reason || JSON.stringify(item);
}

function toFrontendResult(result, request) {
  return {
    id: result.id,
    createdAt: result.createdAt,
    originalText: request.creative.text,
    request,
    summary: { marketingConclusion: marketingConclusion(result) },
    metrics: {
      trustScore: result.scores.trustScore,
      conversionAppeal: result.scores.conversionAppeal,
      audienceFit: result.scores.audienceFit,
      sellingPointClarity: result.scores.sellingPointClarity,
      complianceSafety: result.scores.complianceSafety
    },
    consumerProfile: {
      inferredAudience: result.basicInfo.detectedAudience,
      motivation: result.consumerInsight.purchaseMotivation,
      priceSensitivity: request.product.priceRange ? "中等" : "待判断",
      mainConcerns: (result.consumerInsight.mainObjections || []).join("、") || "证据是否充分、是否适合自己",
      preferredTone: (result.consumerInsight.preferredLanguage || []).join("、"),
      purchaseTrigger: (result.consumerInsight.purchaseTriggers || []).join("、"),
      category: result.basicInfo.category
    },
    frictionItems: result.diagnosis.trustBarriers || [],
    conversionLosses: result.diagnosis.conversionBlockers || [],
    complianceReminders: result.diagnosis.complianceGuardrails || [],
    caseReferences: result.caseReferences,
    legalReferences: result.legalReferences,
    platformReferences: result.platformReferences || [],
    platformAdaptation: result.diagnosis.platformAdaptation || [],
    rewrites: {
      highTrustVersion: result.rewrites.highTrustVersion,
      highConversionVersion: result.rewrites.highConversionVersion,
      seedingRealVersion: result.rewrites.seedingVersion,
      gentleUrgencyVersion: result.rewrites.softUrgencyVersion,
      platformVersion: result.rewrites.platformAdaptedVersion,
      rewriteDiff: result.rewriteRationales
    },
    chatStarters: result.chatStarters,
    markdownReport: result.markdownReport,
    disclaimer: result.disclaimer,
    notice: result.notice || ""
  };
}

function marketingConclusion(result) {
  if (result.scores.trustScore < 65 && result.scores.conversionAppeal >= 70) {
    return "当前文案信任感不足，但具备一定转化潜力，建议保留紧迫感，同时补充真实依据。";
  }
  if (result.scores.conversionAppeal >= 75 && result.scores.audienceFit < 70) {
    return "当前文案吸引力较强，但目标人群不够精准，建议强化目标圈层语言。";
  }
  if (result.scores.complianceSafety < 70) {
    return "当前文案促销氛围较好，但证明材料或表达边界不足，建议补充活动规则和真实反馈。";
  }
  return "当前文案具备基础信任感和转化潜力，建议进一步强化目标人群语言和购买理由。";
}

module.exports = {
  DISCLAIMER,
  validateAuditRequest,
  normalizeLegacyRequest,
  parseJsonLoose,
  buildFallbackResult,
  normalizeAiResult,
  buildMarkdownReport,
  toFrontendResult
};
