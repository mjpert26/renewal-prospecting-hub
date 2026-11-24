export default function handler(req, res) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Signed out</title><body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:90vh;margin:0;color:#1f2a37">
<div style="text-align:center"><h1 style="font-size:20px">You are signed out of the Renewal Prospecting Hub.</h1>
<p><a href="/api/auth/login">Sign in with Salesforce</a></p></div></body>`);
}
