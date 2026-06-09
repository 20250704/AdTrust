const express = require("express");
const { checkModelConnection } = require("../services/modelProvider");

const router = express.Router();

router.get("/", async (req, res) => {
  const health = await checkModelConnection({ force: req.query.force === "1" });
  res.json(health);
});

module.exports = { router };
