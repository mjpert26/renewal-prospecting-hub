// Direct Salesforce REST API access using the signed-in user's own OAuth token,
// so Salesforce sharing rules and field-level security apply to every query.
import { setSession } from "./session.js";

export const API_VERSION = process.env.SF_API_VERSION || "v62.0";
export const LOGIN_URL = () => (process.env.SF_LOGIN_URL || "https://login.salesforce.com").replace(/\/$/, "");

export class SfError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function refreshToken(session) {
  if (!session.rt) return null;
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: session.rt,
    client_id: process.env.SF_CLIENT_ID,
    client_secret: process.env.SF_CLIENT_SECRET,
  });
  const r = await fetch(`${LOGIN_URL()}/services/oauth2/token`, { method: "POST", body });
  if (!r.ok) return null;
  const j = await r.json();
  return { ...session, at: j.access_token, inst: j.instance_url || session.inst };
}

function stripAttributes(v) {
  if (Array.isArray(v)) return v.map(stripAttributes);
  if (v && typeof v === "object") {
    const out = {};
    for (const [k, val] of Object.entries(v)) if (k !== "attributes") out[k] = stripAttributes(val);
    return out;
  }
  return v;
}

async function sfGet(session, path) {
  return fetch(session.inst + path, { headers: { Authorization: `Bearer ${session.at}`, Accept: "application/json" } });
}

// Runs a read-only SOQL query, following pagination until `limit` records are collected.
// Returns { records, session } where session is a refreshed session if the token was renewed.
export async function query(session, soql, limit, res) {
  if (!/^\s*select\s/i.test(soql)) throw new SfError("tool_error", "Only SELECT queries are allowed.");
  let current = session;
  let path = `/services/data/${API_VERSION}/query?q=${encodeURIComponent(soql)}`;
  const records = [];
  let refreshed = false;
  while (path && records.length < limit) {
    let r = await sfGet(current, path);
    if (r.status === 401 && !refreshed) {
      refreshed = true;
      const next = await refreshToken(current);
      if (!next) throw new SfError("needs_reauth", "Your Salesforce session expired. Sign in again.", 401);
      current = next;
      if (res) setSession(res, next);
      r = await sfGet(current, path);
    }
    if (r.status === 401) throw new SfError("needs_reauth", "Your Salesforce session expired. Sign in again.", 401);
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      const msg = Array.isArray(j) && j[0] ? `${j[0].errorCode}: ${j[0].message}` : `HTTP ${r.status}`;
      throw new SfError("tool_error", msg, 400);
    }
    records.push(...j.records);
    path = j.done ? null : j.nextRecordsUrl;
  }
  return { records: stripAttributes(records.slice(0, limit)) };
}

export async function userInfo(inst, accessToken) {
  const r = await fetch(`${inst}/services/oauth2/userinfo`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) throw new Error(`userinfo failed: HTTP ${r.status}`);
  return r.json();
}
