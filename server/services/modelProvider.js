const OpenAI = require("openai");
const { callDeepSeek } = require("./deepseekClient");

let healthCache = null;

function getProvider() {
  return (process.env.MODEL_PROVIDER || "deepseek").toLowerCase();
}

function getDefaultModel() {
  if (getProvider() === "openai") return process.env.OPENAI_MODEL || "gpt-4o-mini";
  return process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
}

function hasApiKey() {
  if (getProvider() === "openai") return Boolean(process.env.OPENAI_API_KEY);
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

async function callOpenAI({ messages, model, temperature = 0.7, responseFormat }) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY 未配置");

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const payload = {
    model: model || process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages,
    temperature,
    stream: false
  };

  if (responseFormat) payload.response_format = responseFormat;

  const completion = await client.chat.completions.create(payload);
  return completion.choices?.[0]?.message?.content || "";
}

async function callModel({
  messages,
  model,
  temperature = 0.7,
  responseFormat,
  reasoning = false,
  thinking,
  reasoningEffort
}) {
  if (getProvider() === "openai") {
    return callOpenAI({ messages, model, temperature, responseFormat });
  }
  return callDeepSeek({
    messages,
    model,
    temperature,
    reasoning,
    responseFormat,
    thinking,
    reasoningEffort
  });
}

function baseHealth() {
  return {
    ok: true,
    runtimeMode: process.env.NODE_ENV === "production" ? "公网部署模式" : "本地开发模式",
    nodeEnv: process.env.NODE_ENV || "development",
    provider: getProvider() === "openai" ? "openai" : "deepseek",
    model: getDefaultModel(),
    hasApiKey: hasApiKey()
  };
}

function sanitizeError(error) {
  return String(error?.message || error || "模型连接失败")
    .replace(/sk-[A-Za-z0-9_-]+/g, "sk-***")
    .slice(0, 180);
}

async function withTimeout(promise, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("模型连接超时")), timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function checkModelConnection({ force = false } = {}) {
  const base = baseHealth();
  if (!base.hasApiKey) {
    return {
      ...base,
      connected: false,
      status: "missing_key",
      message: "DeepSeek 未配置：当前为本地演示模式"
    };
  }

  const now = Date.now();
  if (!force && healthCache && now - healthCache.checkedAt < 60_000) {
    return healthCache.value;
  }

  try {
    await withTimeout(callModel({
      messages: [
        { role: "system", content: "你是连接检测助手，只回复 OK。" },
        { role: "user", content: "请回复 OK" }
      ],
      model: base.model,
      temperature: 0
    }), 8000);

    const value = {
      ...base,
      connected: true,
      status: "connected",
      message: "DeepSeek 已连接"
    };
    healthCache = { checkedAt: now, value };
    return value;
  } catch (error) {
    const value = {
      ...base,
      connected: false,
      status: "connection_failed",
      message: "DeepSeek 未连通：当前为本地演示模式",
      error: sanitizeError(error)
    };
    healthCache = { checkedAt: now, value };
    return value;
  }
}

function getHealth() {
  return {
    ...baseHealth(),
    connected: false,
    status: hasApiKey() ? "configured_unverified" : "missing_key",
    message: hasApiKey() ? "DeepSeek 已配置，尚未完成连通检测" : "DeepSeek 未配置：当前为本地演示模式"
  };
}

module.exports = {
  callModel,
  getHealth,
  checkModelConnection,
  getProvider,
  getDefaultModel,
  hasApiKey
};
