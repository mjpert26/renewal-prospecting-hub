// Starts the Salesforce OAuth 2.0 web server flow with PKCE.
import crypto from "node:crypto";
import { cookie, appendCookie } from "../../lib/session.js";
import { LOGIN_URL } from "../../lib/salesforce.js";

export default function handler(req, res) {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const state = crypto.randomBytes(16).toString("base64url");
  appendCookie(res, cookie("rph_oauth", `${state}.${verifier}`, 600, "Lax"));
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.SF_CLIENT_ID,
    redirect_uri: `${process.env.APP_URL}/api/auth/callback`,
    scope: "api refresh_token openid",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });
  res.statusCode = 302;
  res.setHeader("Location", `${LOGIN_URL()}/services/oauth2/authorize?${params}`);
  res.end();
}
