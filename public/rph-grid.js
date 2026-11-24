/*
 * Spreadsheet-style resizing for the app's tables.
 *   - Drag the right edge of a column header to change that column's width.
 *   - Drag the bottom edge of any row to change the height of every row in that table.
 *   - Double-click an edge to reset it.
 * Sizes are kept per browser (local storage), keyed by table and column label.
 * Cell contents are wrapped in <div class="rph-cell"> so they can be clipped below their natural size;
 * eligibility row classes and all page behaviour are left untouched.
 */
(function () {
  "use strict";
  const TABLES = ["tbl", "chTbl", "hlTbl", "dTeam", "dDeals"];
  const KEY = "rph.grid";
  const MIN_W = 48, MIN_H = 22, MAX_H = 240, EDGE = 5;

  let state = {};
  try { state = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { state = {}; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } };
  const tState = (id) => (state[id] = state[id] || { cols: {}, rowH: null });

  const label = (th) => (th.dataset.rphLabel || th.textContent || "").replace(/[▲▼↑↓]/g, "").trim();

  // ---------- generated stylesheet ----------
  const sheet = document.createElement("style");
  sheet.id = "rph-grid-sizes";
  let pending = false;
  function render() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      let css = "";
      TABLES.forEach((id) => {
        const t = document.getElementById(id), s = state[id];
        if (!t || !s) return;
        const ths = t.tHead ? Array.from(t.tHead.rows[0] ? t.tHead.rows[0].cells : []) : [];
        ths.forEach((th, i) => {
          const w = s.cols[label(th)];
          if (!w) return;
          const n = i + 1, inner = Math.max(MIN_W - 20, w - 20);
          css += "#" + id + " tr>:nth-child(" + n + ")>.rph-cell{width:" + inner + "px;max-width:" + inner + "px;overflow:hidden;text-overflow:ellipsis}";
          css += "#" + id + " tr>:nth-child(" + n + "){min-width:0}";
        });
        if (s.rowH) {
          const h = s.rowH, pad = h < 28 ? 2 : h < 40 ? 5 : 8;
          css += "#" + id + ">tbody>tr>td{height:" + h + "px;padding-top:" + pad + "px;padding-bottom:" + pad + "px}";
          css += "#" + id + ">tbody>tr>td>.rph-cell{max-height:" + (h - pad * 2) + "px;overflow:hidden}";
        }
      });
      sheet.textContent = css;
    });
  }

  // ---------- wrap cell contents ----------
  function wrapCell(c) {
    const only = c.childNodes.length === 1 && c.firstChild.nodeType === 1 && c.firstChild.classList.contains("rph-cell");
    if (only) return;
    if (c.tagName === "TH" && !c.dataset.rphLabel) c.dataset.rphLabel = label(c);
    const w = document.createElement("div");
    w.className = "rph-cell";
    const grip = c.querySelector(":scope > .rph-col-grip");
    Array.from(c.childNodes).forEach((n) => { if (n !== grip) w.appendChild(n); });
    c.insertBefore(w, c.firstChild);
    if (c.tagName === "TH") addGrip(c);
  }
  function wrapTable(t) {
    t.querySelectorAll(":scope > thead > tr > th, :scope > tbody > tr > td").forEach(wrapCell);
  }

  // ---------- column resize ----------
  function addGrip(th) {
    if (th.querySelector(":scope > .rph-col-grip")) return;
    const g = document.createElement("span");
    g.className = "rph-col-grip";
    g.title = "Drag to resize · double-click to reset";
    th.appendChild(g);
  }
  document.addEventListener("pointerdown", (e) => {
    const g = e.target.closest && e.target.closest(".rph-col-grip");
    if (!g) return;
    e.preventDefault();
    e.stopPropagation();
    const th = g.parentElement, t = th.closest("table");
    if (!t || !TABLES.includes(t.id)) return;
    const s = tState(t.id), lab = label(th);
    const startX = e.clientX, startW = th.getBoundingClientRect().width;
    document.documentElement.classList.add("rph-resizing-col");
    const move = (ev) => { s.cols[lab] = Math.max(MIN_W, Math.round(startW + ev.clientX - startX)); render(); };
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.documentElement.classList.remove("rph-resizing-col");
      suppressClick();
      save();
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  }, true);
  document.addEventListener("dblclick", (e) => {
    const g = e.target.closest && e.target.closest(".rph-col-grip");
    if (g) {
      const t = g.closest("table");
      if (t && state[t.id]) { delete state[t.id].cols[label(g.parentElement)]; save(); render(); }
      e.stopPropagation();
      return;
    }
    const td = rowEdgeCell(e);
    if (td) {
      const t = td.closest("table");
      if (state[t.id]) { state[t.id].rowH = null; save(); render(); }
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);

  // ---------- row resize (drag the bottom edge of any row) ----------
  function rowEdgeCell(e) {
    const td = e.target.closest && e.target.closest("td");
    if (!td) return null;
    const t = td.closest("table");
    if (!t || !TABLES.includes(t.id) || !td.closest("tbody")) return null;
    const r = td.parentElement.getBoundingClientRect();
    return r.bottom - e.clientY <= EDGE ? td : null;
  }
  document.addEventListener("pointermove", (e) => {
    if (document.documentElement.classList.contains("rph-resizing-row")) return;
    document.documentElement.classList.toggle("rph-row-edge", !!rowEdgeCell(e));
  }, { passive: true });
  document.addEventListener("pointerdown", (e) => {
    const td = rowEdgeCell(e);
    if (!td || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const t = td.closest("table"), s = tState(t.id);
    const startY = e.clientY, startH = td.parentElement.getBoundingClientRect().height;
    document.documentElement.classList.add("rph-resizing-row");
    const move = (ev) => { s.rowH = Math.min(MAX_H, Math.max(MIN_H, Math.round(startH + ev.clientY - startY))); render(); };
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.documentElement.classList.remove("rph-resizing-row", "rph-row-edge");
      suppressClick();
      save();
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  }, true);

  // A drag ends with a click on whatever is underneath; swallow it so it does not sort or open a record.
  function suppressClick() {
    const stop = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
    document.addEventListener("click", stop, { capture: true, once: true });
    setTimeout(() => document.removeEventListener("click", stop, { capture: true }), 300);
  }

  // Row-size preset buttons override any dragged row height.
  document.addEventListener("click", (e) => {
    if (!e.target.closest || !e.target.closest(".rph-density button")) return;
    Object.values(state).forEach((s) => { s.rowH = null; });
    save();
    render();
  });

  window.__rphGrid = {
    reset() { state = {}; save(); render(); },
  };

  function init() {
    document.head.appendChild(sheet);
    TABLES.forEach((id) => {
      const t = document.getElementById(id);
      if (!t) return;
      wrapTable(t);
      let queued = false;
      new MutationObserver(() => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; wrapTable(t); render(); });
      }).observe(t, { childList: true, subtree: true });
    });
    render();
  }
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
