// The Ghost Producer's door on Signal's own site: the person's own key for Anthropic or
// OpenRouter, kept in this browser only and sent only to that service. Without a key, Signal
// works with the producer's notebook (pre-written questions). The streaming calls are the
// Subtextual app's ai.js, trimmed to the two providers.
const STORE = "signal-ai";
export const PROVIDERS = [
  { id: "anthropic", name: "Anthropic", keyHint: "sk-ant-…", model: "claude-sonnet-5-5" },
  { id: "openrouter", name: "OpenRouter", keyHint: "sk-or-…", model: "anthropic/claude-sonnet-5.5" },
];
const nameOf = (id) => PROVIDERS.find((p) => p.id === id)?.name || "Anthropic";

export function loadAI() {
  try {
    const v = JSON.parse(localStorage.getItem(STORE));
    if (v && typeof v.key === "string") return v;
  } catch {}
  return null;
}
export function saveAI(v) {
  try {
    if (v) localStorage.setItem(STORE, JSON.stringify(v));
    else localStorage.removeItem(STORE);
  } catch {}
}

class AIError extends Error {}

async function failure(res, provider) {
  let detail = "";
  try {
    const body = await res.json();
    detail = body?.error?.message || body?.message || "";
  } catch {}
  const who = nameOf(provider);
  if (res.status === 401 || res.status === 403) return new AIError(`${who} didn’t accept the key.`);
  if (res.status === 429) return new AIError(`${who} is rate-limiting this key. Try again in a moment.`);
  if (res.status >= 500) return new AIError(`${who} is busy right now. Try again in a moment.`);
  return new AIError(detail ? `${who}: ${detail}` : `The request to ${who} failed (${res.status}).`);
}

async function readEvents(res, on) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cut;
    while ((cut = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, cut).trim();
      buffer = buffer.slice(cut + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;
      let event;
      try {
        event = JSON.parse(data);
      } catch {
        continue;
      }
      on(event);
    }
  }
}

async function askAnthropic({ key, model, system, user, signal, onText, maxTokens = 1200 }) {
  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal,
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model, max_tokens: maxTokens, stream: true, system, messages: [{ role: "user", content: user }] }),
    });
  } catch (e) {
    if (e.name === "AbortError") throw e;
    throw new AIError("Couldn’t reach Anthropic. Check your connection.");
  }
  if (!res.ok) throw await failure(res, "anthropic");
  let text = "";
  await readEvents(res, (event) => {
    if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
      text += event.delta.text;
      onText?.(text);
    } else if (event.type === "error") throw new AIError(event.error?.message || "The answer stopped early.");
  });
  return text;
}

async function askOpenRouter({ key, model, system, user, signal, onText, maxTokens = 1200 }) {
  let res;
  try {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${key}`, "X-Title": "Signal" },
      body: JSON.stringify({
        model,
        stream: true,
        max_tokens: maxTokens,
        reasoning: { enabled: false },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
  } catch (e) {
    if (e.name === "AbortError") throw e;
    throw new AIError("Couldn’t reach OpenRouter. Check your connection.");
  }
  if (!res.ok) throw await failure(res, "openrouter");
  let text = "";
  await readEvents(res, (event) => {
    if (event.error) throw new AIError(event.error.message || "The answer stopped early.");
    const piece = event.choices?.[0]?.delta?.content;
    if (piece) {
      text += piece;
      onText?.(text);
    }
  });
  return text;
}

// The door Signal expects: { ready, model, needs, ask, setup, failed }.
export function door({ setup }) {
  return {
    ready: () => !!loadAI()?.key,
    model: () => loadAI()?.model || "",
    needs: () => "The Ghost Producer needs your own Anthropic or OpenRouter key.",
    setup,
    failed: () => {},
    ask: (o) => {
      const s = loadAI();
      if (!s?.key) return Promise.reject(new AIError("No key yet."));
      const call = s.provider === "openrouter" ? askOpenRouter : askAnthropic;
      return call({ ...o, key: s.key, model: s.model || PROVIDERS.find((p) => p.id === s.provider)?.model });
    },
  };
}
