const SYSTEM_PROMPT = `你是 AdTrust AI 消费者信任与广告转化优化官。
你不是单纯的广告合规审查员，也不是只会把文案改得保守的工具。
你的任务是基于产品信息、目标消费者、投放平台、优秀案例和合规底线，判断广告是否可信、是否吸引消费者、是否有销售转化潜力，并生成可直接使用的多风格营销文案。

你必须：
1. 推断目标消费者画像、圈层偏好、购买动机和主要顾虑。
2. 判断当前广告中哪些表达有效，哪些表达削弱信任或转化。
3. 保留合法、真实、有依据的营销张力，例如限时、权益、稀缺感、行动召唤。
4. 不要把所有促销语言都改成平淡说明。
5. 焦虑营销和饥饿营销不是一律删除，而是改成真实、具体、可解释的紧迫表达。
6. 不得编造检测报告、销量数据、专家身份、用户反馈、法律条文或平台规则。
7. 改写不能只替换关键词，不能只在原文后插入建议，必须重新组织标题、卖点、信任依据和CTA。
8. 输出必须是严格 JSON。`;

const JSON_SCHEMA_HINT = `{
  "basicInfo": {
    "productName": "",
    "category": "",
    "platform": "",
    "objective": "",
    "detectedAudience": "",
    "detectedCircle": "",
    "marketingStyle": ""
  },
  "scores": {
    "trustScore": 0,
    "conversionAppeal": 0,
    "audienceFit": 0,
    "sellingPointClarity": 0,
    "complianceSafety": 0,
    "overallMarketingScore": 0
  },
  "consumerInsight": {
    "persona": "",
    "circlePreference": "",
    "purchaseMotivation": "",
    "mainObjections": [],
    "preferredLanguage": [],
    "purchaseTriggers": []
  },
  "diagnosis": {
    "trustBarriers": [],
    "conversionBlockers": [],
    "effectiveElements": [],
    "complianceGuardrails": [],
    "imageAnalysis": {}
  },
  "imageAnalysis": {
    "imageTexts": [],
    "visualDescriptions": [],
    "hierarchyJudgement": "",
    "headlineClarity": "",
    "sellingPointVisibility": "",
    "ctaClarity": "",
    "visualTrust": "",
    "textConsistency": "",
    "marketingObservations": []
  },
  "caseReferences": [],
  "legalReferences": [],
  "platformReferences": [],
  "rewrites": {
    "highTrustVersion": "",
    "highConversionVersion": "",
    "seedingVersion": "",
    "softUrgencyVersion": "",
    "platformAdaptedVersion": ""
  },
  "rewriteRationales": [],
  "chatStarters": [],
  "markdownReport": "",
  "disclaimer": ""
}`;

function buildAuditMessages({ request, caseReferences, legalReferences, platformReferences = [] }) {
  const userPrompt = `请基于以下信息完成广告信任与转化诊断：

【产品信息】
产品名称：${request.product.name || "未填写"}
产品品类：${request.product.category || "其他"}
价格区间：${request.product.priceRange || "未填写"}
核心卖点：${request.product.sellingPoints.join("；") || "未填写"}
证明材料：${request.product.proofMaterials.join("；") || "未提供"}

【广告素材】
广告文案：${request.creative.text}
图片文字：${request.creative.imageTexts.join("；") || "未提供"}
图片视觉描述：${request.creative.imageDescriptions.join("；") || "未提供"}
广告目标：${request.creative.objective || "未填写"}

【投放语境】
目标平台：${request.context.platform || "通用"}
目标消费者：${request.context.targetAudience || "自动推断"}
期望营销风格：${request.context.marketingStyle || "专业可信"}
合规强度：${request.context.complianceMode || "balanced"}

【参考案例】
${JSON.stringify(caseReferences, null, 2)}

【规则摘要】
${JSON.stringify(legalReferences, null, 2)}

【平台规则摘要】
${JSON.stringify(platformReferences, null, 2)}

请完成：
1. 推断消费者画像、圈层偏好、购买动机和主要顾虑。
2. 判断当前表达的有效元素、信任阻碍点、转化损耗点、合规底线提醒和平台适配建议。
3. 如果提供了图片文字或视觉描述，请输出图片广告分析。
4. 给出五项 0-100 评分：消费者信任度、转化吸引力、圈层匹配度、卖点清晰度、合规安全度，并给出综合营销分。
5. 生成高信任版、高转化版、种草真实版、温和紧迫版、平台适配版五种完整文案。
6. 每个版本必须有标题或开头、核心卖点、明确 CTA。
7. 高转化版和温和紧迫版必须保留真实、具体、可解释的营销张力。
8. 不得编造检测报告、销量数据、专家身份、用户反馈、法律条文或平台规则。
9. 平台适配建议只能基于输入的平台规则摘要和常识化表达策略，不要虚构平台审核结论。
10. 输出严格 JSON，不要输出 Markdown 代码块，不要输出 JSON 以外的解释文字。

JSON 字段必须符合以下结构：
${JSON_SCHEMA_HINT}`;

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt }
  ];
}

function buildJsonRepairMessages(raw) {
  return [
    {
      role: "system",
      content: "请把用户提供的内容修复为有效 JSON。只输出 JSON，不要输出解释文字，不要使用 Markdown 代码块。"
    },
    {
      role: "user",
      content: `待修复内容：\n${raw || ""}\n\n目标 JSON 结构：\n${JSON_SCHEMA_HINT}`
    }
  ];
}

function buildRewriteRetryMessages({ request, versionName, currentRewrite }) {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `下面的「${versionName}」与原文相似度过高。请重新组织文案结构，不要只替换词语。

原文：
${request.creative.text}

当前改写：
${currentRewrite}

要求：
1. 只输出 JSON：{"rewrite":"新的完整广告文案","rationale":"为什么这样更能促成信任和转化"}。
2. 必须有标题或开头、核心卖点、明确CTA。
3. 高转化和温和紧迫表达要保留真实、具体、可解释的营销张力。
4. 不得编造证据、数据、专家、用户反馈或规则。`
    }
  ];
}

function buildRewriteChatMessages({ auditResult, currentCopy = "", userMessage, history = [] }) {
  return [
    {
      role: "system",
      content: `${SYSTEM_PROMPT}
你现在负责对话式继续改写。必须返回 JSON，不要输出 JSON 以外的解释文字。
如果用户要求“最终投放版”，必须额外输出 finalVersion 对象。
返回结构必须包含：
{
  "reply": "",
  "newCopy": "",
  "versionName": "",
  "changeNotes": [],
  "scoresAfterRewrite": {
    "trustScore": 0,
    "conversionAppeal": 0,
    "audienceFit": 0,
    "sellingPointClarity": 0,
    "complianceSafety": 0
  },
  "finalVersion": null
}`
    },
    ...history.slice(-6),
    {
      role: "user",
      content: `用户追问：${userMessage}

当前选中文案：
${currentCopy || "未提供"}

已有诊断结果：
${JSON.stringify(auditResult).slice(0, 14000)}

请严格完成：
1. 返回一版完整新文案，不能只替换关键词，不能只追加建议。
2. 新文案要有标题或开头、核心卖点和明确CTA。
3. 根据用户追问决定版本名称。
4. 高转化、直播、温和紧迫方向可以保留限时、权益、错过成本，但必须具体可信。
5. 不编造数据、报告、专家、用户反馈或规则。
6. 如果用户要求最终投放版，请返回 finalVersion：
{
  "finalTitle": "",
  "finalCopy": "",
  "cta": "",
  "whyThisWorks": [],
  "recommendedPlatform": "",
  "abTestSuggestion": []
}`
    }
  ];
}

module.exports = {
  SYSTEM_PROMPT,
  buildAuditMessages,
  buildJsonRepairMessages,
  buildRewriteRetryMessages,
  buildRewriteChatMessages
};
