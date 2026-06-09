const fs = require("fs");
const path = require("path");

const caseLibrary = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "caseLibrary.json"), "utf8"));
const legalRules = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "legalRules.json"), "utf8"));
const platformRules = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "platformRules.json"), "utf8"));

function includesAny(source, values) {
  const text = String(source || "");
  return (values || []).filter(Boolean).some(value => text.includes(String(value)));
}

function scoreCase(item, query) {
  const audience = query.audience || query.targetAudience;
  const style = query.style || query.marketingStyle;
  let score = 0;
  if (item.industry === query.industry) score += 4;
  if (item.platform === query.platform) score += 4;
  if (includesAny(item.audience, [audience])) score += 3;
  if (includesAny(item.style, [style])) score += 2;
  if (includesAny(`${item.copy || item.originalExample || ""} ${(item.usablePatterns || []).join(" ")} ${(item.avoidPatterns || []).join(" ")}`, query.detectedTrustBarriers || [])) score += 1;
  return score;
}

function scoreLegalRule(item, query) {
  let score = 0;
  if (includesAny(item.topic, query.complianceTopics || [])) score += 4;
  if (includesAny(`${item.summary} ${(item.highRiskPatterns || item.forbiddenPatterns || []).join(" ")}`, query.detectedTrustBarriers || [])) score += 3;
  if ((query.category || query.industry) === "教育培训" && item.topic.includes("教育")) score += 2;
  if ((query.category || query.industry) === "食品饮料" && item.topic.includes("食品")) score += 2;
  if ((query.category || query.industry) === "美妆护肤" && item.topic.includes("美妆")) score += 2;
  return score;
}

function scorePlatformRule(item, query) {
  let score = 0;
  if (item.platform === query.platform) score += 6;
  if (query.platform === "电商详情页" && /淘宝|天猫|京东/.test(item.platform)) score += 4;
  if (query.platform === "通用") score += 1;
  return score;
}

function getRelevantCases(query) {
  return caseLibrary
    .map(item => ({ ...item, _score: scoreCase(item, query) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 3)
    .map(({ _score, ...item }) => item);
}

function getRelevantLegalRules(query) {
  return legalRules
    .map(item => ({ ...item, _score: scoreLegalRule(item, query) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 5)
    .map(({ _score, ...item }) => item);
}

function getRelevantPlatformRules(query) {
  return platformRules
    .map(item => ({ ...item, _score: scorePlatformRule(item, query) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, query.platform === "通用" ? 3 : 1)
    .map(({ _score, ...item }) => item);
}

function retrieveReferences(query) {
  return {
    topCases: getRelevantCases(query),
    topLegalRules: getRelevantLegalRules(query),
    topPlatformRules: getRelevantPlatformRules(query)
  };
}

function getCases() {
  return caseLibrary;
}

function getLegalRules() {
  return legalRules;
}

function getPlatformRules() {
  return platformRules;
}

module.exports = {
  retrieveReferences,
  getRelevantCases,
  getRelevantLegalRules,
  getRelevantPlatformRules,
  getCases,
  getLegalRules,
  getPlatformRules
};
