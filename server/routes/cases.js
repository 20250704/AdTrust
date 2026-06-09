const express = require("express");
const { getCases } = require("../services/retrievalService");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    note: "案例库为课程项目模拟案例，用于学习分析，不代表真实品牌投放素材。",
    cases: getCases()
  });
});

module.exports = { router };
