// Saved lists and Hitlist storage. GET ?path=<collection> lists documents;
// PUT ?path=<doc> writes one; DELETE ?path=<doc> removes one.
import { getSession, isManager } from "../lib/session.js";
import { listCollection, setDoc, deleteDoc, AccessError } from "../lib/store.js";

export default async function handler(req, res) {
  const s = getSession(req);
  if (!s) {
    res.statusCode = 401;
    return res.json({ code: "needs_reauth" });
  }
  const viewer = { uid: s.uid, manager: isManager(s) };
  const path = req.query.path;
  try {
    if (req.method === "GET") return res.json({ docs: await listCollection(path, viewer) });
    if (req.method === "PUT") {
      await setDoc(path, req.body, viewer);
      return res.json({ ok: true });
    }
    if (req.method === "DELETE") {
      await deleteDoc(path, viewer);
      return res.json({ ok: true });
    }
    res.statusCode = 405;
    res.json({ error: "Method not allowed" });
  } catch (e) {
    if (e instanceof AccessError) {
      res.statusCode = e.status;
      return res.json({ error: e.message });
    }
    console.error("db error", e);
    res.statusCode = 500;
    res.json({ error: "Storage error" });
  }
}
