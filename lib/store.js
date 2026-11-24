// Document store for saved lists and Hitlists, backed by Upstash Redis (REST API).
// Each collection path is one Redis hash: field = document id, value = JSON document.
// Access rules mirror the original capabilities.json:
//   data/users/{uid}        -> owner only (saved filter lists)
//   hitlists                -> each rep's summary doc; the manager can list all of them
//   hitlists/{uid}/items    -> owner read/write; the manager can read (read-only)
import { canonicalId } from "./session.js";

const URL_ = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export class AccessError extends Error {
  constructor(message, status = 403) {
    super(message);
    this.status = status;
  }
}

async function redis(cmd) {
  if (!URL_() || !TOKEN()) throw new AccessError("Storage is not configured.", 503);
  const r = await fetch(URL_(), {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN()}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error || `Redis HTTP ${r.status}`);
  return j.result;
}

const SEG = /^[A-Za-z0-9_-]{1,100}$/;

function splitPath(path) {
  const segs = String(path || "").split("/").filter(Boolean);
  if (!segs.length || !segs.every((s) => SEG.test(s))) throw new AccessError("Invalid path.", 400);
  return segs;
}

// Returns { key, filterTo } after checking the viewer may perform `op` on the collection.
function authorize(segs, op, viewer) {
  const me = canonicalId(viewer.uid);
  const same = (x) => canonicalId(x) === me;
  if (segs.length === 3 && segs[0] === "data" && segs[1] === "users") {
    if (!same(segs[2])) throw new AccessError("Not your data.");
    return { key: `db:data/users/${me}` };
  }
  if (segs.length === 1 && segs[0] === "hitlists") {
    if (op === "read") return { key: "db:hitlists", filterTo: viewer.manager ? null : me };
    return { key: "db:hitlists", writeOnly: me };
  }
  if (segs.length === 3 && segs[0] === "hitlists" && segs[2] === "items") {
    const owner = canonicalId(segs[1]);
    if (op === "read" && (same(owner) || viewer.manager)) return { key: `db:hitlists/${owner}/items` };
    if (op === "write" && same(owner)) return { key: `db:hitlists/${owner}/items` };
    throw new AccessError("Not your Hitlist.");
  }
  throw new AccessError("Unknown collection.", 404);
}

export async function listCollection(path, viewer) {
  const { key, filterTo } = authorize(splitPath(path), "read", viewer);
  const flat = (await redis(["HGETALL", key])) || [];
  const docs = [];
  for (let i = 0; i < flat.length; i += 2) {
    const id = flat[i];
    if (filterTo && canonicalId(id) !== filterTo) continue;
    try {
      docs.push({ id, data: JSON.parse(flat[i + 1]) });
    } catch {
      /* skip corrupt entry */
    }
  }
  return docs;
}

function docTarget(path, viewer) {
  const segs = splitPath(path);
  if (segs.length < 2 || segs.length % 2 !== 0) throw new AccessError("Invalid document path.", 400);
  const id = segs.pop();
  const auth = authorize(segs, "write", viewer);
  let field = id;
  if (auth.writeOnly) {
    if (canonicalId(id) !== auth.writeOnly) throw new AccessError("Not your Hitlist.");
    field = auth.writeOnly;
  }
  return { key: auth.key, field };
}

const MAX_DOC_BYTES = 64 * 1024;

export async function setDoc(path, data, viewer) {
  const { key, field } = docTarget(path, viewer);
  const json = JSON.stringify(data ?? {});
  if (json.length > MAX_DOC_BYTES) throw new AccessError("Document too large.", 413);
  await redis(["HSET", key, field, json]);
}

export async function deleteDoc(path, viewer) {
  const { key, field } = docTarget(path, viewer);
  await redis(["HDEL", key, field]);
}
