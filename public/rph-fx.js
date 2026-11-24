/*
 * Renewals HQ effects layer. Plain JavaScript versions of React Bits patterns:
 *   Spotlight Card (cursor glow), Count Up (animated figures), command-menu (Cmd/Ctrl+K palette),
 *   and view transitions. Works on top of the unmodified page in app/index.html.
 */
(function () {
  "use strict";
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (id) => document.getElementById(id);
  const P = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  // ---------- Spotlight: one listener sets the cursor position on whichever card is hovered ----------
  function spotlight() {
    const SEL = ".kpi, .dcard, .rph-spot";
    document.addEventListener("pointermove", (e) => {
      const el = e.target.closest && e.target.closest(SEL);
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", e.clientX - r.left + "px");
      el.style.setProperty("--my", e.clientY - r.top + "px");
    }, { passive: true });
  }

  // ---------- Count Up for dashboard figures ----------
  const NUM = /^([^\d-]*)(-?[\d,]+(?:\.\d+)?)(.*)$/;
  function countUp(el) {
    if (reduce || el.dataset.rphCounted === el.textContent) return;
    const m = el.textContent.trim().match(NUM);
    if (!m) return;
    const [, pre, raw, post] = m;
    const target = parseFloat(raw.replace(/,/g, ""));
    if (!isFinite(target) || target === 0) { el.dataset.rphCounted = el.textContent; return; }
    const decimals = (raw.split(".")[1] || "").length;
    const fmt = (v) => pre + v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + post;
    const final = el.textContent;
    const t0 = performance.now(), dur = 900;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(2, -10 * k);
      el.textContent = k >= 1 ? final : fmt(target * eased);
      if (k < 1) requestAnimationFrame(step);
      else el.dataset.rphCounted = final;
    };
    el.dataset.rphCounted = final; // guard against the observer re-triggering mid-animation
    requestAnimationFrame(step);
  }
  function watchCounts() {
    const box = $("dKpis");
    if (!box) return;
    const run = () => box.querySelectorAll(".kpi .v").forEach(countUp);
    new MutationObserver(run).observe(box, { childList: true });
    run();
  }

  // ---------- View transitions ----------
  function viewTransitions() {
    ["dashView", "closeView", "hitView"].map($).concat([document.querySelector("main")]).forEach((v) => {
      if (!v) return;
      let shown = v.style.display !== "none";
      new MutationObserver(() => {
        const now = v.style.display !== "none";
        if (now && !shown && !reduce) {
          v.classList.remove("rph-enter");
          void v.offsetWidth;
          v.classList.add("rph-enter");
        }
        shown = now;
      }).observe(v, { attributes: true, attributeFilter: ["style"] });
    });
  }

  // ---------- Command palette ----------
  const ICON = {
    go: '<svg viewBox="0 0 24 24" ' + P + '><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" ' + P + '><path d="M13 3 5 14h6l-1 7 8-11h-6z"/></svg>',
    side: '<svg viewBox="0 0 24 24" ' + P + '><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></svg>',
    rows: '<svg viewBox="0 0 24 24" ' + P + '><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    ext: '<svg viewBox="0 0 24 24" ' + P + '><path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/></svg>',
    search: '<svg viewBox="0 0 24 24" ' + P + '><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  };
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  function commands() {
    const list = [];
    const views = [["navDash", "Dashboard"], ["navHub", "Renewal Prospecting Hub"], ["navClose", "Renewal Closing Hub"], ["navHit", "My Hitlist"]];
    views.forEach(([id, label]) => { if ($(id)) list.push({ group: "Go to", label, icon: ICON.go, run: () => $(id).click() }); });
    const presets = $("presets");
    if (presets) {
      Array.from(presets.options).filter((o) => o.value).forEach((o) => list.push({
        group: "Quick starts", label: o.textContent, icon: ICON.bolt,
        run: () => {
          if ($("navHub") && !$("navHub").classList.contains("on")) $("navHub").click();
          presets.value = o.value;
          presets.dispatchEvent(new Event("change", { bubbles: true }));
        },
      }));
    }
    const collapse = $("rphCollapse"), expand = $("rphExpand");
    if (collapse) list.push({ group: "View", label: "Toggle filters sidebar", icon: ICON.side, run: () => (document.documentElement.classList.contains("rph-side-collapsed") ? expand : collapse).click() });
    [["compact", "Compact"], ["default", "Default"], ["comfy", "Comfortable"]].forEach(([k, l]) => {
      list.push({ group: "View", label: "Row size: " + l, icon: ICON.rows, run: () => { const b = document.querySelector('.rph-density button[data-d="' + k + '"]'); if (b) b.click(); } });
    });
    list.push({ group: "Links", label: "Open Salesforce", icon: ICON.ext, run: () => window.open("https://bigthink.lightning.force.com/lightning/page/home", "_blank", "noopener") });
    return list;
  }

  function palette() {
    const ov = document.createElement("div");
    ov.className = "rph-cmd";
    ov.hidden = true;
    ov.innerHTML =
      '<div class="rph-cmd-panel" role="dialog" aria-modal="true" aria-label="Command menu">' +
      '<div class="rph-cmd-search">' + ICON.search +
      '<input type="text" placeholder="Jump to a page, quick start or setting…" aria-label="Search commands" autocomplete="off" spellcheck="false">' +
      '<kbd>Esc</kbd></div>' +
      '<div class="rph-cmd-list" role="listbox"></div>' +
      '<div class="rph-cmd-foot"><span><kbd>↑</kbd><kbd>↓</kbd> to move</span><span><kbd>Enter</kbd> to select</span></div>' +
      "</div>";
    document.body.appendChild(ov);
    const input = ov.querySelector("input"), listEl = ov.querySelector(".rph-cmd-list");
    let items = [], shown = [], idx = 0, lastFocus = null;

    const render = () => {
      const q = input.value.trim().toLowerCase();
      shown = items.filter((c) => !q || (c.group + " " + c.label).toLowerCase().includes(q));
      idx = Math.min(idx, Math.max(0, shown.length - 1));
      let html = "", g = "";
      shown.forEach((c, i) => {
        if (c.group !== g) { g = c.group; html += '<div class="rph-cmd-group">' + g + "</div>"; }
        html += '<div class="rph-cmd-item" role="option" data-i="' + i + '" aria-selected="' + (i === idx) + '">' + c.icon + "<span>" + c.label.replace(/[&<>]/g, (x) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[x])) + "</span></div>";
      });
      listEl.innerHTML = html || '<div class="rph-cmd-empty">No matches</div>';
      const sel = listEl.querySelector('[aria-selected="true"]');
      if (sel) sel.scrollIntoView({ block: "nearest" });
    };
    const open = () => {
      lastFocus = document.activeElement;
      items = commands(); idx = 0; input.value = "";
      ov.hidden = false; render(); input.focus();
    };
    const close = () => { ov.hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus(); };
    const choose = (i) => { const c = shown[i]; close(); if (c) setTimeout(c.run, 0); };

    input.addEventListener("input", () => { idx = 0; render(); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); idx = Math.min(shown.length - 1, idx + 1); render(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); idx = Math.max(0, idx - 1); render(); }
      else if (e.key === "Enter") { e.preventDefault(); choose(idx); }
      else if (e.key === "Escape") { e.preventDefault(); close(); }
    });
    listEl.addEventListener("pointermove", (e) => {
      const it = e.target.closest(".rph-cmd-item");
      if (it && +it.dataset.i !== idx) { idx = +it.dataset.i; listEl.querySelectorAll(".rph-cmd-item").forEach((n) => n.setAttribute("aria-selected", String(+n.dataset.i === idx))); }
    });
    listEl.addEventListener("click", (e) => { const it = e.target.closest(".rph-cmd-item"); if (it) choose(+it.dataset.i); });
    ov.addEventListener("pointerdown", (e) => { if (e.target === ov) close(); });
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); ov.hidden ? open() : close(); }
    });

    // Header trigger
    const header = document.querySelector("header");
    if (header) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rph-cmd-trigger";
      btn.innerHTML = ICON.search + "<span>Jump to…</span><kbd>" + (isMac ? "⌘" : "Ctrl") + " K</kbd>";
      btn.addEventListener("click", open);
      const user = header.querySelector(".rph-user");
      if (user) header.insertBefore(btn, user);
      else {
        // The account menu is added once the user is known; place the trigger before it then.
        header.appendChild(btn);
        new MutationObserver((_, obs) => { const u = header.querySelector(".rph-user"); if (u) { header.insertBefore(btn, u); obs.disconnect(); } })
          .observe(header, { childList: true });
      }
    }
    window.__rphPalette = { open, close };
  }

  ready(function () {
    if (!document.querySelector("header")) return;
    spotlight();
    watchCounts();
    viewTransitions();
    palette();
  });
})();
