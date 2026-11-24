import { getSession, isManager } from "../lib/session.js";

export default function handler(req, res) {
  const s = getSession(req);
  if (!s) {
    res.statusCode = 401;
    return res.json({ code: "needs_reauth" });
  }
  res.json({ id: s.uid, name: s.name, email: s.email, manager: isManager(s), canvas: !!s.canvas });
}
