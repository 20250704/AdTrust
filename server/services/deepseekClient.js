const OpenAI = require("openai");

function createClient() {
  return new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com"
  });
}

async function callDeepSeek({
  messages,
  model,
  temperature = 0.7,
  reasoning = false,
  responseFormat,
  thinking,
  reasoningEffort
}) {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error("DEEPSEEK_API_KEY 未配置");
  }

  const payload = {
    model:
      model ||
      (reasoning
        ? process.env.DEEPSEEK_REASONING_MODEL || "deepseek-v4-pro"
        : process.env.DEEPSEEK_MODEL || "deepseek-v4-flash"),
    messages,
    temperature,
    stream: false
  };

  if (thinking !== undefined) payload.thinking = thinking;
  if (reasoningEffort) payload.reasoning_effort = reasoningEffort;
  if (responseFormat) payload.response_format = responseFormat;

  const completion = await createClient().chat.completions.create(payload);
  return completion.choices?.[0]?.message?.content || "";
}

module.exports = { callDeepSeek };
