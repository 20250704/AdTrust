const express = require("express");
const { getLegalRules } = require("../services/retrievalService");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    note: "规则库为课程整理和公开规则摘要，仅作风险提示，不构成法律意见。",
    rules: getLegalRules()
  });
});

module.exports = { router };
