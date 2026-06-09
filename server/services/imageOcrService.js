const fs = require("fs");
const path = require("path");
const { createWorker } = require("tesseract.js");

const OCR_LANG = process.env.OCR_LANG || "chi_sim+eng";
const OCR_CACHE_DIR = path.join(__dirname, "..", ".ocr-cache", "tessdata");
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function normalizeBase64Image(item = {}) {
  return {
    fileName: item.fileName || item.name || "上传图片",
    imageBase64: item.imageBase64 || item.dataUrl || "",
    imageType: item.imageType || item.type || "广告图片",
    manualText: item.manualText || item.imageText || "",
    manualDescription: item.manualDescription || item.visualDescription || ""
  };
}

function dataUrlToBuffer(value) {
  const input = String(value || "");
  if (!input) return null;
  const base64 = input.includes(",") ? input.split(",").pop() : input;
  return Buffer.from(base64, "base64");
}

function isSupportedImageBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isWebp = buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  return isPng || isJpeg || isWebp;
}

function cleanOcrText(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function copyIfNeeded(source, target) {
  if (!fs.existsSync(source)) return false;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (!fs.existsSync(target)) fs.copyFileSync(source, target);
  return true;
}

function ensureLocalLangPath() {
  const root = path.join(__dirname, "..", "..");
  const chiSource = path.join(root, "node_modules", "@tesseract.js-data", "chi_sim", "4.0.0", "chi_sim.traineddata.gz");
  const engSource = path.join(root, "node_modules", "@tesseract.js-data", "eng", "4.0.0", "eng.traineddata.gz");
  const ok = [
    copyIfNeeded(chiSource, path.join(OCR_CACHE_DIR, "chi_sim.traineddata.gz")),
    copyIfNeeded(engSource, path.join(OCR_CACHE_DIR, "eng.traineddata.gz"))
  ].every(Boolean);
  return ok ? OCR_CACHE_DIR : "";
}

async function recognizeImages(images) {
  const normalized = images.map(image => {
    const source = image.buffer || dataUrlToBuffer(image.imageBase64);
    return { image, source };
  });
  if (!normalized.some(item => isSupportedImageBuffer(item.source))) {
    return normalized.map(() => ({
      text: "",
      confidence: 0,
      error: "图片格式无效或图片数据不完整"
    }));
  }

  const langPath = ensureLocalLangPath();
  if (!langPath) {
    throw new Error("本地 OCR 语言包未安装");
  }

  const worker = await createWorker(OCR_LANG, 1, {
    langPath,
    cachePath: path.join(__dirname, "..", ".ocr-cache")
  });
  try {
    const results = [];
    for (const item of normalized) {
      if (!isSupportedImageBuffer(item.source)) {
        results.push({ text: "", confidence: 0, error: "图片格式无效或图片数据不完整" });
        continue;
      }
      if (item.source.length > MAX_IMAGE_BYTES) {
        results.push({ text: "", confidence: 0, error: "单张图片不能超过5MB，请压缩后重试或手动输入图片文字" });
        continue;
      }
      const ret = await worker.recognize(item.source);
      results.push({
        text: cleanOcrText(ret.data?.text),
        confidence: Math.max(0, Math.min(1, Number(ret.data?.confidence || 0) / 100)),
        error: ""
      });
    }
    return results;
  } finally {
    await worker.terminate();
  }
}

function buildMarketingObservations({ imageText, ocrText, hasOcrError }) {
  const text = imageText || "";
  const hasHeadline = text.length >= 6;
  const hasPrice = /¥|￥|元|折|券|优惠|满减|到手价|活动价|限时/.test(text);
  const hasCta = /立即|领取|咨询|预约|下单|购买|报名|扫码|私信|点击|查看/.test(text);
  const hasOverClaim = /第一|最好|最佳|100%|必瘦|必过|全网最低|根治|包治|3天/.test(text);

  return [
    hasOcrError
      ? "本地 OCR 识别失败，已切换为手动兜底。"
      : ocrText
        ? "已使用本地 OCR 提取图片文字，可继续手动修正。"
        : "本地 OCR 未提取到清晰文字，请手动补充主标题、卖点、价格和CTA。",
    hasHeadline ? "主标题有可识别文字，建议确认最大字号是否突出核心利益点。" : "主标题不够清晰，建议补充或放大首屏核心利益点。",
    hasPrice ? "价格或权益信息有线索，建议确认活动规则是否完整。" : "价格、优惠或权益不够清晰。",
    hasCta ? "CTA有线索，建议确认下一步动作是否足够明确。" : "CTA不够明确，建议增加立即领取、咨询、预约或下单入口。",
    hasOverClaim ? "图片中可能存在过度承诺或绝对化表达，建议弱化并补充依据。" : "暂未发现明显过度承诺，仍建议核对背书来源。"
  ];
}

function buildImageResult(image, ocrResult = {}) {
  const ocrText = ocrResult.text || "";
  const imageText = image.manualText || ocrText;
  const hasOcrError = Boolean(ocrResult.error);
  const provider = ocrText ? "ocr" : "manual";
  const visualDescription = image.manualDescription || `${image.imageType}已上传。${ocrText ? "本地 OCR 已提取图片文字，建议继续核对主标题、卖点、价格、权益和CTA。" : "未提取到清晰文字，请手动补充图片中的主标题、卖点、价格、权益和CTA。"}`;

  return {
    fileName: image.fileName,
    imageText,
    visualDescription,
    marketingObservations: buildMarketingObservations({ imageText, ocrText, hasOcrError }),
    confidence: image.manualText ? Math.max(0.65, ocrResult.confidence || 0) : (ocrResult.confidence || 0.35),
    provider,
    ocrError: hasOcrError ? ocrResult.error : ""
  };
}

async function extractImageInfo(input = {}) {
  const body = input.body || input || {};
  const files = input.files || (input.file ? [input.file] : []);
  const imagesFromFiles = files.map(file => ({
    fileName: file.originalname,
    buffer: file.buffer,
    imageType: file.mimetype || "广告图片",
    manualText: body.manualText || "",
    manualDescription: body.manualDescription || ""
  }));

  const rawImages = Array.isArray(body.images)
    ? body.images
    : [{ fileName: body.fileName, imageBase64: body.imageBase64, imageType: body.imageType, manualText: body.manualText, manualDescription: body.manualDescription }];

  const images = (imagesFromFiles.length ? imagesFromFiles : rawImages)
    .map(image => image.buffer ? image : normalizeBase64Image(image))
    .filter(image => image.buffer || image.imageBase64 || image.manualText || image.fileName)
    .slice(0, 5);

  let ocrResults = [];
  try {
    ocrResults = await recognizeImages(images);
  } catch (error) {
    ocrResults = images.map(() => ({
      text: "",
      confidence: 0,
      error: error.message || "OCR识别失败"
    }));
  }

  return {
    images: images.map((image, index) => buildImageResult(image, ocrResults[index] || {}))
  };
}

module.exports = { extractImageInfo };
