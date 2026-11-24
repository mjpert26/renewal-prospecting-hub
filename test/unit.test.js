import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

process.env.SESSION_SECRET = "x".repeat(40);
process.env.KV_REST_API_URL = "https://redis.test";
process.env.KV_REST_API_TOKEN = "t";
process.env.MANAGER_EMAILS = "boss@example.com";

const { seal, unseal, isManager, canonicalId } = await import("../lib/session.js");
const { verifySignedRequest } = await import("../api/canvas.js");
const { buildPage } = await import("../api/app.js");

// In-memory Redis stand-in for the REST API.
const hashes = new Map();
globalThis.fetch = async (url, opts) => {
  const [cmd, key, ...rest] = JSON.parse(opts.body);
  const h = hashes.get(key) || new Map();
  hashes.set(key, h);
  let result = null;
  if (cmd === "HSET") { h.set(rest[0], rest[1]); result = 1; }
  if (cmd === "HDEL") { result = h.delete(rest[0]) ? 1 : 0; }
  if (cmd === "HGETALL") { result = [...h.entries()].flat(); }
  return new Response(JSON.stringify({ result }), { status: 200 });
};
const store = await import("../lib/store.js");

test("session round-trips and rejects tampering", () => {
  const v = seal({ a: 1 });
  assert.deepEqual(unseal(v), { a: 1 });
  const bad = v.slice(0, -2) + (v.endsWith("A") ? "B" : "A") + v.slice(-1);
  assert.equal(unseal(bad), null);
});

test("manager detection uses MANAGER_EMAILS", () => {
  assert.equal(isManager({ email: "Boss@Example.com" }), true);
  assert.equal(isManager({ email: "rep@example.com" }), false);
  assert.equal(canonicalId("005000000000001AAA"), "005000000000001");
});

test("canvas signed request verification", () => {
  const payload = Buffer.from(JSON.stringify({ context: { user: { userId: "1" } } })).toString("base64");
  const sig = crypto.createHmac("sha256", "secret").update(payload).digest("base64");
  assert.ok(verifySignedRequest(`${sig}.${payload}`, "secret"));
  assert.equal(verifySignedRequest(`${sig}.${payload}`, "wrong"), null);
  assert.equal(verifySignedRequest("garbage", "secret"), null);
});

test("store enforces per-user access", async () => {
  const rep = { uid: "005A", manager: false };
  const other = { uid: "005B", manager: false };
  const boss = { uid: "005M", manager: true };

  await store.setDoc("data/users/005A/l1", { kind: "list" }, rep);
  assert.equal((await store.listCollection("data/users/005A", rep)).length, 1);
  await assert.rejects(store.listCollection("data/users/005A", other), /Not your data/);
  await assert.rejects(store.setDoc("data/users/005A/x", {}, other), /Not your data/);

  await store.setDoc("hitlists/005A/items/hit_1", { n: 1 }, rep);
  await store.setDoc("hitlists/005A", { owner: "005A" }, rep);
  await store.setDoc("hitlists/005B", { owner: "005B" }, other);
  await assert.rejects(store.setDoc("hitlists/005A", {}, other), /Not your Hitlist/);
  await assert.rejects(store.setDoc("hitlists/005A/items/hit_2", {}, boss), /Not your Hitlist/);
  await assert.rejects(store.listCollection("hitlists/005A/items", other), /Not your Hitlist/);
  assert.equal((await store.listCollection("hitlists/005A/items", boss)).length, 1);

  assert.deepEqual((await store.listCollection("hitlists", rep)).map((d) => d.id), ["005A"]);
  assert.equal((await store.listCollection("hitlists", boss)).length, 2);

  await assert.rejects(store.listCollection("secrets", rep), /Unknown collection/);
  await assert.rejects(store.listCollection("data/users/../x", rep), /Invalid path/);
  await store.deleteDoc("hitlists/005A/items/hit_1", rep);
  assert.equal((await store.listCollection("hitlists/005A/items", rep)).length, 0);
});

test("page builder injects runtime and ready gate", async () => {
  const fs = await import("node:fs");
  const out = buildPage(fs.readFileSync(new URL("../app/index.html", import.meta.url), "utf8"));
  assert.ok(out.includes('<script src="/rph-runtime.js"></script>'));
  assert.ok(out.includes("window.__rphReady||Promise.resolve()"));
  assert.ok(out.includes('<script src="/rph-theme.js"></script>'));
  assert.ok(out.indexOf('href="/rph-theme.css"') > out.lastIndexOf("</style>"));
});

test("theme never overrides eligibility row shading", async () => {
  const fs = await import("node:fs");
  const page = fs.readFileSync(new URL("../app/index.html", import.meta.url), "utf8");
  for (const c of ["row-green", "row-yellow", "row-red"]) assert.ok(page.includes(`tr.${c} td{background`), `page still defines ${c}`);
  for (const f of ["rph-theme.css", "rph-fx.css"]) {
    const css = fs.readFileSync(new URL(`../public/${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    // Any rule that sets a td background on table rows must exclude the eligibility classes.
    for (const rule of css.match(/[^{}]*\btr\b[^{}]*\btd\b[^{}]*\{[^}]*background[^}]*\}/g) || []) {
      const sel = rule.slice(0, rule.indexOf("{"));
      if (/tr\.tot/.test(sel)) continue;
      assert.ok(/:not\(\[class\*="row-"\]\)/.test(sel), `${f}: "${sel.trim()}" could paint over eligibility colours`);
    }
  }
});
