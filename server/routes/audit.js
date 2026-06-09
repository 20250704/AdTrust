const express = require("express");
const { callModel, hasApiKey, getDefaultModel } = require("../services/modelProvider");
const { buildAuditMessages, buildJsonRepairMessages } = require("../services/promptBuilder");
const { ensureRewriteDiversity } = require("../services/rewriteService");
const {
  validateAuditRequest,
  normalizeLegacyRequest,
  parseJsonLoose,
  normalizeAiResult,
  buildMarkdownReport
} = require("../services/resultNormalizer");
const { buildLocalFallback, logSafeEvent } = require("../services/fallbackEngine");

const router = express.Router();
const FALLBACK_NOTICE = "当前为本地演示模式，配置 DeepSeek 后可获得深度分析。";

async function handleAudit(body) {
  const normalizedBody = normalizeLegacyRequest(body);
  const validation = validateAuditRequest(normalizedBody);
  if (validation.error) {
    return {
      status: 400,
      body: {
        ok: false,
        message: validation.error,
        fallbackAvailable: false
      }
    };
  }

  const request = validation.data;
  const { result: fallbackResult, retrieval } = buildLocalFallback(request, FALLBACK_NOTICE);

  logSafeEvent({
    route: "/api/audit",
    textLength: request.creative.text.length,
    mode: request.context.complianceMode,
    status: "start"
  });

  if (!hasApiKey()) {
    fallbackResult.notice = FALLBACK_NOTICE;
    logSafeEvent({
      route: "/api/audit",
      textLength: request.creative.text.length,
      mode: request.context.complianceMode,
      status: "fallback_no_api_key"
    });
    return { status: 200, body: fallbackResult };
  }

  let raw = "";
  try {
    raw = await callModel({
      messages: buildAuditMessages({
        request,
        caseReferences: retrieval.topCases,
        legalReferences: retrieval.topLegalRules,
        platformReferences: retrieval.topPlatformRules
      }),
      model: getDefaultModel(),
      temperature: request.context.complianceMode === "strict" ? 0.35 : 0.65,
      responseFormat: { type: "json_object" }
    });

    const aiResult = parseJsonLoose(raw);
    let result = normalizeAiResult({
      aiResult,
      fallbackResult,
      request,
      caseReferences: retrieval.topCases,
      legalReferences: retrieval.topLegalRules,
      platformReferences: retrieval.topPlatformRules
    });
    result = await ensureRewriteDiversity({ request, result });
    result.markdownReport = buildMarkdownReport(result);

    logSafeEvent({
      route: "/api/audit",
      textLength: request.creative.text.length,
      mode: request.context.complianceMode,
      status: "ai_success"
    });
    return { status: 200, body: result };
  } catch (error) {
    try {
      const repairedRaw = await callModel({
        messages: buildJsonRepairMessages(raw || String(error.message || "")),
        model: getDefaultModel(),
        temperature: 0,
        responseFormat: { type: "json_object" }
      });
      const repaired = parseJsonLoose(repairedRaw);
      let result = normalizeAiResult({
        aiResult: repaired,
        fallbackResult,
        request,
        caseReferences: retrieval.topCases,
        legalReferences: retrieval.topLegalRules,
        platformReferences: retrieval.topPlatformRules
      });
      result = await ensureRewriteDiversity({ request, result });
      result.markdownReport = buildMarkdownReport(result);

      logSafeEvent({
        route: "/api/audit",
        textLength: request.creative.text.length,
        mode: request.context.complianceMode,
        status: "json_repaired"
      });
      return { status: 200, body: result };
    } catch (repairError) {
      fallbackResult.notice = FALLBACK_NOTICE;
      logSafeEvent({
        route: "/api/audit",
        textLength: request.creative.text.length,
        mode: request.context.complianceMode,
        status: "fallback_ai_failed"
      });
      return { status: 200, body: fallbackResult };
    }
  }
}

router.post("/", async (req, res) => {
  const result = await handleAudit(req.body);
  res.status(result.status).json(result.body);
});

module.exports = { router, handleAudit };
