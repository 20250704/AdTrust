const express = require("express");
const { getPlatformRules } = require("../services/retrievalService");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    note: "平台规则库为课程项目整理的表达策略摘要，仅用于营销内容优化参考，不代表平台审核结论。",
    rules: getPlatformRules()
  });
});

module.exports = { router };
