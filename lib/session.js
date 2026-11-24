// Encrypted, HttpOnly session cookie holding the viewer's Salesforce tokens and identity.
// Tokens never reach the browser's JavaScript.
import crypto from "node:crypto";

export const SESSION_COOKIE = "rph_session";
const MAX_AGE = 60 * 60 * 12; // 12 hours

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be set (32+ characters).");
  return crypto.createHash("sha256").update(secret).digest();
}

export function seal(obj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(obj), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64url");
}

export function unseal(value) {
  try {
    const buf = Buffer.from(value, "base64url");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    const pt = Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]);
    return JSON.parse(pt.toString("utf8"));
  } catch {
    return null;
  }
}

export function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

// SameSite=None + Partitioned so the cookie also works when the app is framed inside Salesforce.
export function cookie(name, value, maxAge, sameSite = "None") {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "Secure", `SameSite=${sameSite}`, `Max-Age=${maxAge}`];
  if (sameSite === "None") parts.push("Partitioned");
  return parts.join("; ");
}

export function appendCookie(res, value) {
  const prev = res.getHeader("Set-Cookie");
  res.setHeader("Set-Cookie", prev ? [].concat(prev, value) : [value]);
}

export function getSession(req) {
  const raw = parseCookies(req)[SESSION_COOKIE];
  if (!raw) return null;
  const s = unseal(raw);
  if (!s || !s.exp || s.exp < Date.now()) return null;
  return s;
}

export function setSession(res, data) {
  const s = { ...data, exp: Date.now() + MAX_AGE * 1000 };
  appendCookie(res, cookie(SESSION_COOKIE, seal(s), MAX_AGE));
  return s;
}

export function clearSession(res) {
  appendCookie(res, cookie(SESSION_COOKIE, "", 0));
}

export function isManager(session) {
  const list = (process.env.MANAGER_EMAILS || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  return !!session && !!session.email && list.includes(session.email.toLowerCase());
}

// Salesforce 15- and 18-character IDs share the same first 15 characters.
export const canonicalId = (id) => String(id || "").slice(0, 15);
