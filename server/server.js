require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const { createRateLimiter } = require("./services/rateLimiter");
const { router: auditRouter, handleAudit } = require("./routes/audit");
const { router: rewriteChatRouter, handleRewriteChat } = require("./routes/rewriteChat");
const { router: imageExtractRouter, handleExtractImage } = require("./routes/imageExtract");
const { router: casesRouter } = require("./routes/cases");
const { router: legalRulesRouter } = require("./routes/legalRules");
const { router: platformRulesRouter } = require("./routes/platformRules");
const { router: healthRouter } = require("./routes/health");

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = path.join(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const SRC_DIR = path.join(ROOT_DIR, "src");

const app = express();
const isProduction = process.env.NODE_ENV === "production";

app.set("trust proxy", 1);
if (!isProduction) {
  app.use(cors());
} else if (process.env.ALLOWED_ORIGIN) {
  app.use(cors({
    origin(origin, callback) {
      if (!origin || origin === process.env.ALLOWED_ORIGIN) {
        callback(null, true);
        return;
      }
      callback(new Error("当前来源不允许访问 API"));
    }
  }));
}
app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: true, limit: "8mb" }));

const noStoreStatic = {
  etag: false,
  lastModified: false,
  setHeaders(res) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
};

app.use(express.static(PUBLIC_DIR, noStoreStatic));
app.use("/src", express.static(SRC_DIR, noStoreStatic));
app.use("/assets", express.static(path.join(PUBLIC_DIR, "assets")));

app.use("/api/health", healthRouter);
app.use("/api/audit", createRateLimiter({ max: 10, message: "AI诊断请求过于频繁，请稍后再试。" }), auditRouter);
app.use("/api/rewrite-chat", createRateLimiter({ max: 20, message: "追问改写请求过于频繁，请稍后再试。" }), rewriteChatRouter);
app.use("/api/extract-image", createRateLimiter({ max: 20, message: "图片识别请求过于频繁，请稍后再试。" }), imageExtractRouter);
app.use("/api/cases", casesRouter);
app.use("/api/legal-rules", legalRulesRouter);
app.use("/api/platform-rules", platformRulesRouter);

function sendIndex(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
}

app.get("/", (req, res) => {
  sendIndex(res);
});

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    res.status(404).json({
      ok: false,
      message: "API 不存在",
      fallbackAvailable: false
    });
    return;
  }
  sendIndex(res);
});

app.use((error, req, res, next) => {
  console.error(JSON.stringify({
    time: new Date().toISOString(),
    route: req.path,
    status: "server_error",
    message: error.message
  }));
  const isUploadLimit = error.code === "LIMIT_FILE_SIZE" || error.code === "LIMIT_FILE_COUNT" || error.type === "entity.too.large";
  const isBadUpload = /仅支持 jpg、png、webp/.test(error.message || "");
  const status = isUploadLimit ? 413 : isBadUpload ? 400 : error.status || 500;
  res.status(status).json({
    ok: false,
    message: isUploadLimit
      ? "请求内容过大，请减少文本或图片大小后重试。"
      : isBadUpload
        ? "仅支持 jpg、png、webp 图片。"
      : "服务暂不可用，已启用本地兜底逻辑，页面不会空白。",
    fallbackAvailable: true
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`AdTrust AI server listening on port ${PORT}`);
  });
}

module.exports = {
  app,
  handleAudit,
  handleRewriteChat,
  handleExtractImage
};
