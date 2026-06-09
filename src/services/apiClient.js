async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || error.error || "接口请求失败");
  }

  return response.json();
}

export function auditAd(payload) {
  return requestJson("/api/audit", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function rewriteChat(payload) {
  return requestJson("/api/rewrite-chat", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getHealth() {
  return requestJson("/api/health");
}

export function getCases() {
  return requestJson("/api/cases");
}

export function getLegalRules() {
  return requestJson("/api/legal-rules");
}

export function getPlatformRules() {
  return requestJson("/api/platform-rules");
}
