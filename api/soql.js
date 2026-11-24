// Read-only SOQL proxy. Runs with the signed-in user's own Salesforce token.
import { getSession } from "../lib/session.js";
import { query, SfError } from "../lib/salesforce.js";

const MAX_LIMIT = 5000;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.json({ code: "tool_error", message: "POST only" });
  }
  const s = getSession(req);
  if (!s) {
    res.statusCode = 401;
    return res.json({ code: "needs_reauth", message: "Sign in with Salesforce." });
  }
  const { soql, limit } = req.body || {};
  if (typeof soql !== "string" || soql.length > 20000) {
    res.statusCode = 400;
    return res.json({ code: "tool_error", message: "Missing or oversized query." });
  }
  const n = Math.min(Math.max(parseInt(limit, 10) || 200, 1), MAX_LIMIT);
  try {
    const out = await query(s, soql, n, res);
    res.json(out);
  } catch (e) {
    if (e instanceof SfError) {
      res.statusCode = e.status;
      return res.json({ code: e.code, message: e.message });
    }
    console.error("soql error", e);
    res.statusCode = 502;
    res.json({ code: "server_unavailable", message: "Salesforce did not respond." });
  }
}
