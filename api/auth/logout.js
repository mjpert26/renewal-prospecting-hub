import { clearSession } from "../../lib/session.js";

export default function handler(req, res) {
  clearSession(res);
  res.statusCode = 302;
  res.setHeader("Location", "/api/auth/signed-out");
  res.end();
}
