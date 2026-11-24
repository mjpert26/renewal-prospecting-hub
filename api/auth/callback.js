// Completes the OAuth flow: exchanges the code for tokens and stores them in the session cookie.
import { parseCookies, cookie, appendCookie, setSession, canonicalId } from "../../lib/session.js";
import { LOGIN_URL, userInfo } from "../../lib/salesforce.js";

function fail(res, msg) {
  res.statusCode = 400;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(`Sign-in failed: ${msg}\n\nReturn to the app and try again.`);
}

export default async function handler(req, res) {
  const { code, state, error, error_description } = req.query;
  if (error) return fail(res, error_description || error);
  const [savedState, verifier] = (parseCookies(req).rph_oauth || "").split(".");
  appendCookie(res, cookie("rph_oauth", "", 0, "Lax"));
  if (!code || !state || state !== savedState || !verifier) return fail(res, "invalid or expired sign-in request");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: process.env.SF_CLIENT_ID,
    client_secret: process.env.SF_CLIENT_SECRET,
    redirect_uri: `${process.env.APP_URL}/api/auth/callback`,
    code_verifier: verifier,
  });
  const r = await fetch(`${LOGIN_URL()}/services/oauth2/token`, { method: "POST", body });
  const tok = await r.json().catch(() => ({}));
  if (!r.ok) return fail(res, tok.error_description || `token exchange failed (HTTP ${r.status})`);

  try {
    const info = await userInfo(tok.instance_url, tok.access_token);
    setSession(res, {
      at: tok.access_token,
      rt: tok.refresh_token || null,
      inst: tok.instance_url,
      uid: canonicalId(info.user_id),
      name: info.name,
      email: info.email,
    });
  } catch (e) {
    return fail(res, e.message);
  }
  res.statusCode = 302;
  res.setHeader("Location", "/");
  res.end();
}
