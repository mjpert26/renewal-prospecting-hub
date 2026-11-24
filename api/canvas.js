// Salesforce Canvas entry point. Salesforce POSTs a signed request containing the
// viewer's OAuth token; we verify it with the Connected App consumer secret and start a session.
import crypto from "node:crypto";
import { setSession, canonicalId } from "../lib/session.js";

export function verifySignedRequest(signed, secret) {
  const [sig, payload] = String(signed || "").split(".");
  if (!sig || !payload) return null;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest();
  const given = Buffer.from(sig, "base64");
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end("Canvas apps must use the Signed Request access method (POST).");
  }
  const env = verifySignedRequest(req.body && req.body.signed_request, process.env.SF_CLIENT_SECRET);
  if (!env || !env.client || !env.context || !env.context.user) {
    res.statusCode = 401;
    return res.end("Invalid signed request.");
  }
  const u = env.context.user;
  setSession(res, {
    at: env.client.oauthToken,
    rt: env.client.refreshToken || null,
    inst: env.client.instanceUrl,
    uid: canonicalId(u.userId),
    name: u.fullName,
    email: u.email,
    canvas: true,
  });
  res.statusCode = 303;
  res.setHeader("Location", "/");
  res.end();
}
