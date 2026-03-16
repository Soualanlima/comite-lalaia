const https = require("https");

function callClaude(apiKey, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request(
      {
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "prompt-caching-2024-07-31",
          "Content-Length": Buffer.byteLength(body)
        }
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          try {
            resolve({ status: res.statusCode, data: JSON.parse(raw) });
          } catch (e) {
            reject(new Error("API retornou resposta invalida: " + raw.slice(0, 200)));
          }
        });
      }
    );
    req.on("error", (e) => reject(new Error("Erro de conexao: " + e.message)));
    req.setTimeout(59000, () => {
      req.destroy();
      reject(new Error("Timeout na chamada a API"));
    });
    req.write(body);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  }

  const { shared_context, agent_prompt, message, debate_context, max_tokens } = req.body || {};

  if (!message) {
    return res.status(400).json({ error: "Missing 'message' field" });
  }

  // Build system array with cache_control on shared context
  const systemArr = [];
  if (shared_context) {
    systemArr.push({
      type: "text",
      text: shared_context,
      cache_control: { type: "ephemeral" }
    });
  }
  if (agent_prompt) {
    systemArr.push({
      type: "text",
      text: agent_prompt
    });
  }

  // Build messages with optional debate_context caching
  let messages;
  if (debate_context) {
    messages = [{
      role: "user",
      content: [
        {
          type: "text",
          text: debate_context,
          cache_control: { type: "ephemeral" }
        },
        {
          type: "text",
          text: message
        }
      ]
    }];
  } else {
    messages = [{ role: "user", content: message }];
  }

  const payload = {
    model: "claude-opus-4-20250514",
    max_tokens: max_tokens || 1000,
    system: systemArr.length > 0 ? systemArr : undefined,
    messages: messages
  };

  try {
    const result = await callClaude(API_KEY, payload);

    if (result.status !== 200) {
      const errMsg = result.data?.error?.message || JSON.stringify(result.data);
      return res.status(result.status).json({ error: errMsg });
    }

    const text = result.data?.content?.[0]?.text || "Sem resposta.";
    return res.status(200).json({ text });

  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
};
