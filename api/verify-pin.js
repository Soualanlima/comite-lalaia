const crypto = require("crypto");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const APP_PIN = process.env.APP_PIN;
  if (!APP_PIN) return res.status(500).json({ error: "APP_PIN not configured" });

  const { pin } = req.body || {};
  if (!pin || typeof pin !== "string") return res.status(400).json({ valid: false });

  // Constant-time comparison to prevent timing attacks
  const pinBuf = Buffer.from(pin);
  const correctBuf = Buffer.from(APP_PIN);
  const valid = pinBuf.length === correctBuf.length && crypto.timingSafeEqual(pinBuf, correctBuf);

  if (valid) {
    // Generate a session token
    const token = crypto.randomBytes(32).toString("hex");
    return res.status(200).json({ valid: true, token });
  }

  return res.status(200).json({ valid: false });
};
