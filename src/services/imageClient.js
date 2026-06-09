export async function extractImage(image) {
  const response = await fetch("/api/extract-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      images: [
        {
          imageBase64: image.dataUrl,
          fileName: image.name,
          imageType: image.imageType || image.type,
          manualText: image.imageText || "",
          manualDescription: image.visualDescription || ""
        }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "图片识别接口暂不可用");
  }
  const result = await response.json();
  return result.images?.[0] || {
    fileName: image.name,
    imageText: "",
    visualDescription: "图片识别暂不可用，请手动输入图片中的文字。",
    marketingObservations: ["请手动补充主标题、价格权益和行动按钮信息。"],
    confidence: 0,
    provider: "manual"
  };
}
