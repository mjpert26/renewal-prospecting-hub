// Serves the application page to signed-in users only. The page itself is the unmodified
// claude.ai artifact (app/index.html); this adds the runtime adapter and a ready gate.
import fs from "node:fs";
import path from "node:path";
import { getSession } from "../lib/session.js";

const INIT_LINE = "renderLists(); initLists(); updateCounts(); header(); showView(viewFromHash());";
let cached = null;

export function buildPage(html) {
  const tag = '<script src="/rph-runtime.js"></script>\n<script>\n(function(){\n"use strict";';
  let out = html.replace('<script>\n(function(){\n"use strict";', tag);
  if (out === html) out = html.replace("<script>", '<script src="/rph-runtime.js"></script>\n<script>');
  // Wait for the signed-in user to be known before the page runs its first query.
  out = out.replace(INIT_LINE, `(window.__rphReady||Promise.resolve()).then(function(){ ${INIT_LINE} });`);
  return out;
}

function page() {
  if (cached) return cached;
  const html = fs.readFileSync(path.join(process.cwd(), "app", "index.html"), "utf8");
  if (!html.includes(INIT_LINE)) console.warn("app/index.html init line not found; ready gate not applied");
  cached = buildPage(html);
  return cached;
}

export default function handler(req, res) {
  const s = getSession(req);
  if (!s) {
    // Inside an iframe the Salesforce login page cannot be shown, so offer a new tab instead.
    if (req.headers["sec-fetch-dest"] === "iframe") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.end(`<!doctype html><meta charset="utf-8"><body style="font-family:system-ui,sans-serif;padding:32px;color:#1f2a37">
<p>Your session has ended. Reload this Salesforce tab, or <a href="/api/auth/login" target="_blank" rel="noopener">open the Renewal Prospecting Hub in a new tab</a>.</p></body>`);
    }
    res.statusCode = 302;
    res.setHeader("Location", "/api/auth/login");
    return res.end();
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(page());
}
