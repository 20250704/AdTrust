const { retrieveReferences } = require("./retrievalService");
const { buildFallbackResult } = require("./resultNormalizer");

function buildRetrievalQuery(request) {
  const text = [
    request.creative.text,
    ...request.creative.imageTexts,
    ...request.product.sellingPoints,
    ...request.product.proofMaterials
  ].join(" ");

  const topics = [];
  if (/第一|最好|最佳|100%|全网|最低/.test(text)) topics.push("绝对化表达");
  if (/3天|明显变化|保证|必定|喝了就能瘦|包瘦|提分/.test(text)) topics.push("功效承诺");
  if (/最低价|最后|名额|错过|限时/.test(text)) topics.push("价格促销表达");
  if (/专家|明星|用户|检测报告|销量/.test(text)) topics.push("用户评价与背书");
  if (request.product.category.includes("教育")) topics.push("教育培训结果承诺");
  if (request.product.category.includes("食品")) topics.push("食品健康功效表达");
  if (request.product.category.includes("美妆")) topics.push("美妆护肤效果表达");

  return {
    industry: request.product.category,
    platform: request.context.platform,
    targetAudience: request.context.targetAudience,
    marketingStyle: request.context.marketingStyle,
    detectedTrustBarriers: topics,
    complianceTopics: topics
  };
}

function buildLocalFallback(request, notice) {
  const retrieval = retrieveReferences(buildRetrievalQuery(request));
  const result = buildFallbackResult({
    request,
    caseReferences: retrieval.topCases,
    legalReferences: retrieval.topLegalRules,
    platformReferences: retrieval.topPlatformRules,
    notice
  });
  return { result, retrieval };
}

function logSafeEvent(info) {
  console.log(JSON.stringify({
    time: new Date().toISOString(),
    route: info.route,
    textLength: info.textLength,
    mode: info.mode,
    status: info.status
  }));
}

module.exports = {
  buildRetrievalQuery,
  buildLocalFallback,
  logSafeEvent
};
