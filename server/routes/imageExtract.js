const express = require("express");
const multer = require("multer");
const { extractImageInfo } = require("../services/imageOcrService");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5
  },
  fileFilter(req, file, callback) {
    if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) {
      callback(null, true);
      return;
    }
    callback(new Error("仅支持 jpg、png、webp 图片"));
  }
});

async function handleExtractImage(req = {}) {
  const result = await extractImageInfo(req);
  return {
    status: 200,
    body: result
  };
}

router.post("/", upload.array("images", 5), async (req, res, next) => {
  try {
    const result = await handleExtractImage(req);
    res.status(result.status).json(result.body);
  } catch (error) {
    next(error);
  }
});

module.exports = { router, handleExtractImage };
