const express = require("express");
const { callModel, hasApiKey, getDefaultModel } = require("../services/modelProvider");
const { buildRewriteChatMessages } = require("../services/promptBuilder");
const { buildFallbackChatResponse, buildFinalVersion } = require("../services/rewriteService");
const { parseJsonLoose } = require("../services/resultNormalizer");

const router = express.Router();

function sanitizeError(error) {
  return String(error?.message || error || "模型调用失败")
    .replace(/sk-[A-Za-z0-9_-]+/g, "sk-***")
    .slice(0, 120);
}

function normalizeChatResult(result, fallback, body) {
  const normalized = {
    ...fallback,
    ...result,
    provider: "ai",
    notice: ""
  };
  if (normalized.newRewrite && !normalized.newCopy) normalized.newCopy = normalized.newRewrite;
  if (normalized.newCopy && !normalized.newRewrite) normalized.newRewrite = normalized.newCopy;
  if (!normalized.versionName) normalized.versionName = fallback.versionName;
  if (!normalized.finalVersion && /最终|投放/.test(body.userMessage || "")) {
    normalized.finalVersion = buildFinalVersion({
      auditResult: body.auditResult,
      currentCopy: normalized.newCopy || body.currentCopy || "",
      history: body.history || []
    });
  }
  return normalized;
}

async function handleRewriteChat(body = {}) {
  const auditResult = body.auditResult || {};
  const currentCopy = String(body.currentCopy || body.currentRewrite || "").trim();
  const userMessage = String(body.userMessage || "").trim();
  const history = Array.isArray(body.history) ? body.history : [];
  if (!userMessage) {
    return {
      status: 400,
      body: {
        ok: false,
        message: "userMessage 不能为空",
        fallbackAvailable: false
      }
    };
  }

  const fallback = buildFallbackChatResponse({ auditResult, currentCopy, userMessage, history });

  if (!hasApiKey()) {
    return {
      status: 200,
      body: {
        ...fallback,
        provider: "fallback",
        notice: "DeepSeek 未配置，当前使用本地改写兜底。"
      }
    };
  }

  try {
    const raw = await callModel({
      messages: buildRewriteChatMessages({ auditResult, currentCopy, userMessage, history }),
      model: getDefaultModel(),
      temperature: 0.78,
      responseFormat: { type: "json_object" }
    });
    const parsed = parseJsonLoose(raw);
    return { status: 200, body: normalizeChatResult(parsed, fallback, { auditResult, currentCopy, userMessage, history }) };
  } catch (error) {
    return {
      status: 200,
      body: {
        ...fallback,
        provider: "fallback",
        notice: `DeepSeek 调用失败，当前使用本地改写兜底：${sanitizeError(error)}`
      }
    };
  }
}

router.post("/", async (req, res) => {
  const result = await handleRewriteChat(req.body);
  res.status(result.status).json(result.body);
});

module.exports = { router, handleRewriteChat };
