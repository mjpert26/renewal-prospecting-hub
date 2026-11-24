/*
 * Runtime adapter for the Renewal Prospecting Hub.
 *
 * The page was built as a claude.ai artifact and calls window.claude.use("mcp" | "db" | "user").
 * This file provides the same interface backed by this deployment's own API:
 *   mcp.callTool(..., {soql, limit})  -> POST /api/soql   (Salesforce REST API, viewer's own token)
 *   db.collection / db.doc            -> /api/db           (Upstash Redis, per-user access rules)
 *   user.id / name / isOwner          -> /api/me           (Salesforce identity)
 */
(function () {
  "use strict";

  const inFrame = window.top !== window.self;
  const POLL_MS = 20000;

  function signIn() {
    if (inFrame) {
      document.body.innerHTML =
        '<p style="font-family:system-ui,sans-serif;padding:32px">Your session has ended. Reload this Salesforce tab, or <a href="/api/auth/login" target="_blank" rel="noopener">open the hub in a new tab</a>.</p>';
    } else {
      window.location.href = "/api/auth/login";
    }
  }

  async function api(method, url, body) {
    const r = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: body !== undefined ? { "Content-Type": "application/json" } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) {
      signIn();
      throw { code: "needs_reauth", message: "Sign in with Salesforce." };
    }
    if (!r.ok) throw { code: j.code || "tool_error", message: j.message || j.error || "HTTP " + r.status };
    return j;
  }

  // ---- user ----
  const meP = api("GET", "/api/me");
  const user = {
    id: () => meP.then((m) => m.id),
    name: () => meP.then((m) => m.name),
    isOwner: () => meP.then((m) => !!m.manager),
  };

  // ---- mcp (Salesforce) ----
  const mcp = {
    async callTool(_server, _tool, args) {
      const j = await api("POST", "/api/soql", { soql: args.soql, limit: args.limit });
      return { payload: { records: j.records } };
    },
  };

  // ---- db ----
  // Subscribers keyed by collection path, refreshed on a timer and after every local write.
  const subs = new Map();

  function snapshot(docs) {
    return { docs: docs.map((d) => ({ id: d.id, exists: true, data: () => d.data })) };
  }

  async function refresh(path) {
    const entry = subs.get(path);
    if (!entry || !entry.listeners.size) return;
    try {
      const j = await api("GET", "/api/db?path=" + encodeURIComponent(path));
      const snap = snapshot(j.docs);
      entry.listeners.forEach((l) => l.next(snap));
    } catch (e) {
      entry.listeners.forEach((l) => l.error && l.error(e));
    }
  }

  function collection(path) {
    return {
      path,
      doc: (id) => doc(path + "/" + id),
      onSnapshot(next, error) {
        let entry = subs.get(path);
        if (!entry) {
          entry = { listeners: new Set(), timer: null };
          subs.set(path, entry);
        }
        const l = { next, error };
        entry.listeners.add(l);
        if (!entry.timer) entry.timer = setInterval(() => refresh(path), POLL_MS);
        refresh(path);
        return function unsubscribe() {
          entry.listeners.delete(l);
          if (!entry.listeners.size) {
            clearInterval(entry.timer);
            entry.timer = null;
          }
        };
      },
    };
  }

  function parentOf(docPath) {
    return docPath.slice(0, docPath.lastIndexOf("/"));
  }

  function doc(path) {
    return {
      path,
      collection: (name) => collection(path + "/" + name),
      async set(data) {
        await api("PUT", "/api/db?path=" + encodeURIComponent(path), data);
        refresh(parentOf(path));
      },
      async delete() {
        await api("DELETE", "/api/db?path=" + encodeURIComponent(path));
        refresh(parentOf(path));
      },
    };
  }

  const db = { collection, doc };

  const caps = { mcp, db, user };
  window.claude = {
    use: (name) => meP.then(() => caps[name] || null, () => null),
  };

  // ---- production identity lock ----
  // The prototype's "Viewing as" selector lets anyone simulate any rep. Here it is set to the
  // signed-in Salesforce user, and only managers can change it.
  window.__rphReady = meP.then(
    (m) => {
      const sel = document.getElementById("viewAs");
      const book = document.getElementById("book");
      const proto = document.querySelector(".proto");
      if (proto) proto.remove();
      addSignOut(m);
      if (!sel) return;
      const onRoster = Array.from(sel.options).some((o) => o.value === m.name);
      if (m.manager) {
        if (onRoster) sel.value = m.name;
        return;
      }
      if (!onRoster) {
        document.querySelector("main") && (document.querySelector("main").innerHTML =
          '<div style="padding:40px;font-family:inherit">Your Salesforce user (' + escapeHtml(m.name) +
          ") is not on the Renewals team roster. Ask your manager to add you.</div>");
        return new Promise(() => {}); // never start the app for users off the roster
      }
      sel.value = m.name;
      sel.disabled = true;
      // Book follows the person. The roster option label reads "... (Book 1 + House)" or "... (all books)".
      if (book) {
        const label = sel.options[sel.selectedIndex].textContent;
        const mm = label.match(/\((Book \d+) \+ House\)/);
        book.value = mm ? mm[1] : "ALL";
      }
    },
    () => new Promise(() => {}) // not signed in: signIn() already redirected
  );

  function addSignOut(m) {
    const host = document.querySelector(".viewas");
    if (!host || m.canvas) return;
    const a = document.createElement("a");
    a.href = "/api/auth/logout";
    a.textContent = "Sign out";
    a.style.cssText = "margin-left:12px;font-size:12px;color:inherit;opacity:.75;white-space:nowrap";
    host.appendChild(a);
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
})();
