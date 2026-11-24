/*
 * Renewals HQ theme layer: brand block, icon pill navigation with a sliding indicator,
 * and an account menu. Works on top of the unmodified page in app/index.html.
 * Patterns adapted from React Bits Pro app-shell-1 and navigation-1.
 */
(function () {
  "use strict";

  // Line icons (24x24, stroke) in the style of the React Bits app shells.
  const P = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  const ICONS = {
    navDash: '<svg viewBox="0 0 24 24" ' + P + '><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
    navHub: '<svg viewBox="0 0 24 24" ' + P + '><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    navClose: '<svg viewBox="0 0 24 24" ' + P + '><path d="M4 12.5 9 17.5 20 6.5"/></svg>',
    navHit: '<svg viewBox="0 0 24 24" ' + P + '><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
    chev: '<svg class="rph-chev" viewBox="0 0 24 24" ' + P + '><path d="m6 9 6 6 6-6"/></svg>',
    out: '<svg viewBox="0 0 24 24" ' + P + '><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5"/><path d="M5 12h11"/></svg>',
    ext: '<svg viewBox="0 0 24 24" ' + P + '><path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/></svg>',
    sf: '<svg viewBox="0 0 24 24" ' + P + '><path d="M7 18a4 4 0 0 1-.6-8 5 5 0 0 1 9.4-1.6A4 4 0 1 1 17 18z"/></svg>',
  };

  const esc = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const initials = (n) => String(n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    const header = document.querySelector("header");
    if (!header) return;
    document.documentElement.classList.add("rph-theme");

    // ---- brand ----
    const brand = document.createElement("a");
    brand.className = "rph-brand";
    brand.href = "#dashboard";
    brand.setAttribute("aria-label", "Big Think Capital Renewals HQ, go to Dashboard");
    brand.innerHTML =
      '<img class="rph-logo" alt="Big Think Capital" src="/brand/logo.svg">' +
      '<span class="rph-wordmark" aria-hidden="true">BIG THINK<b>CAPITAL</b></span>' +
      '<span class="rph-divider" aria-hidden="true"></span>' +
      '<span class="rph-product">Renewals HQ</span>';
    const img = brand.querySelector("img");
    img.addEventListener("error", function onErr() {
      // Try a PNG next, then fall back to the text wordmark.
      if (img.src.endsWith(".svg")) { img.src = "/brand/logo.png"; return; }
      img.removeEventListener("error", onErr);
      img.remove();
      brand.classList.add("no-logo");
    });
    brand.addEventListener("click", (e) => {
      const dash = document.getElementById("navDash");
      if (dash) { e.preventDefault(); dash.click(); }
    });
    header.prepend(brand);

    // ---- nav icons + sliding indicator ----
    const nav = header.querySelector(".topnav");
    if (nav) {
      Object.keys(ICONS).forEach((id) => {
        const b = document.getElementById(id);
        if (!b || b.querySelector(".rph-ico")) return;
        const i = document.createElement("span");
        i.className = "rph-ico";
        i.setAttribute("aria-hidden", "true");
        i.innerHTML = ICONS[id];
        b.prepend(i);
      });
      const ind = document.createElement("span");
      ind.className = "rph-ind";
      ind.setAttribute("aria-hidden", "true");
      nav.prepend(ind);
      const move = () => {
        const on = nav.querySelector("button.on");
        nav.querySelectorAll("button").forEach((b) => b.setAttribute("aria-current", b === on ? "page" : "false"));
        if (!on) { ind.style.opacity = "0"; return; }
        ind.style.opacity = "1";
        ind.style.width = on.offsetWidth + "px";
        ind.style.transform = "translateX(" + on.offsetLeft + "px)";
      };
      new MutationObserver(move).observe(nav, { subtree: true, attributes: true, attributeFilter: ["class"], characterData: true, childList: true });
      window.addEventListener("resize", move);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(move);
      requestAnimationFrame(move);
    }

    // ---- account menu ----
    const meP = window.__rphMe;
    if (!meP) return;
    meP.then(function (m) {
      document.documentElement.classList.toggle("rph-rep", !m.manager);
      const inFrame = window.top !== window.self;
      const wrap = document.createElement("div");
      wrap.className = "rph-user";
      wrap.innerHTML =
        '<button type="button" class="rph-user-btn" aria-haspopup="menu" aria-expanded="false">' +
        '<span class="rph-avatar" aria-hidden="true">' + esc(initials(m.name)) + "</span>" +
        '<span class="rph-user-meta"><span class="rph-user-name">' + esc(m.name) + "</span>" +
        '<span class="rph-user-role">' + (m.manager ? "Manager" : "Renewals") + "</span></span>" +
        ICONS.chev + "</button>" +
        '<div class="rph-menu" role="menu" hidden>' +
        '<div class="rph-menu-head"><b>' + esc(m.name) + "</b><span>" + esc(m.email) + "</span></div>" +
        '<a role="menuitem" href="https://bigthink.lightning.force.com/lightning/page/home" target="_blank" rel="noopener">' + ICONS.sf + "Open Salesforce</a>" +
        (inFrame ? '<a role="menuitem" href="/" target="_blank" rel="noopener">' + ICONS.ext + "Open in a new tab</a>" : "") +
        (m.canvas ? "" : '<a role="menuitem" href="/api/auth/logout">' + ICONS.out + "Sign out</a>") +
        "</div>";
      header.appendChild(wrap);

      const btn = wrap.querySelector(".rph-user-btn");
      const menu = wrap.querySelector(".rph-menu");
      const items = () => Array.from(menu.querySelectorAll('[role="menuitem"]'));
      const open = (focusFirst) => {
        menu.hidden = false;
        btn.setAttribute("aria-expanded", "true");
        if (focusFirst && items()[0]) items()[0].focus();
      };
      const close = (restore) => {
        menu.hidden = true;
        btn.setAttribute("aria-expanded", "false");
        if (restore) btn.focus();
      };
      // Managers: move the "Viewing as" picker into the account menu to keep the header clear.
      const viewas = header.querySelector(".viewas");
      if (viewas && m.manager) {
        const sec = document.createElement("div");
        sec.className = "rph-menu-sec";
        sec.appendChild(viewas);
        menu.insertBefore(sec, menu.children[1]);
        const sel = viewas.querySelector("#viewAs");
        if (sel) sel.addEventListener("change", () => close(false));
        const who = wrap.querySelector(".rph-user-role");
        const sync = () => { if (sel && sel.value && sel.value !== m.name) who.textContent = "Viewing as " + sel.value; else who.textContent = "Manager"; };
        if (sel) sel.addEventListener("change", sync);
        sync();
      }

      btn.addEventListener("click", () => (menu.hidden ? open(false) : close(false)));
      btn.addEventListener("keydown", (e) => { if (e.key === "ArrowDown") { e.preventDefault(); open(true); } });
      document.addEventListener("pointerdown", (e) => { if (!wrap.contains(e.target)) close(false); });
      menu.addEventListener("keydown", (e) => {
        const list = items();
        const i = list.indexOf(document.activeElement);
        if (e.key === "Escape") { e.preventDefault(); close(true); }
        else if (e.key === "ArrowDown") { e.preventDefault(); list[(i + 1) % list.length].focus(); }
        else if (e.key === "ArrowUp") { e.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
        else if (e.key === "Tab") close(false);
      });
    }, function () {});
  });
})();

/*
 * Collapsible filter sidebar and adjustable row density.
 * Patterns adapted from React Bits Pro app-sidebar (collapse to rail) and data-table (density).
 * Preferences are kept per browser; the page works normally if storage is unavailable.
 */
(function () {
  "use strict";
  const store = {
    get(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
  };
  const P = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  const ICON = {
    collapse: '<svg viewBox="0 0 24 24" ' + P + '><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/><path d="m15 10-2 2 2 2"/></svg>',
    expand: '<svg viewBox="0 0 24 24" ' + P + '><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/><path d="m13 10 2 2-2 2"/></svg>',
    filter: '<svg viewBox="0 0 24 24" ' + P + '><path d="M4 5h16l-6 7.5V19l-4 1.5v-8z"/></svg>',
    run: '<svg viewBox="0 0 24 24" ' + P + '><path d="M7 5v14l11-7z"/></svg>',
  };
  const DENSITIES = [["compact", "Compact"], ["default", "Default"], ["comfy", "Comfortable"]];

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    const root = document.documentElement;

    // ---- collapsible sidebar ----
    const aside = document.querySelector("main > aside:not(.drawer)");
    if (aside) {
      aside.classList.add("rph-side");
      const head = document.createElement("div");
      head.className = "rph-side-head";
      head.innerHTML = '<span class="rph-side-title">' + ICON.filter + "Filters</span>" +
        '<button type="button" class="rph-iconbtn" id="rphCollapse" aria-label="Collapse filters" title="Collapse filters">' + ICON.collapse + "</button>";
      aside.prepend(head);

      const rail = document.createElement("div");
      rail.className = "rph-rail";
      rail.innerHTML =
        '<button type="button" class="rph-iconbtn" id="rphExpand" aria-label="Show filters" title="Show filters">' + ICON.expand + "</button>" +
        '<button type="button" class="rph-iconbtn rph-run" id="rphRailRun" aria-label="Run" title="Run with current filters">' + ICON.run + "</button>" +
        '<span class="rph-rail-label">Filters</span>';
      aside.appendChild(rail);

      const set = (collapsed) => {
        root.classList.toggle("rph-side-collapsed", collapsed);
        aside.setAttribute("aria-expanded", String(!collapsed));
        store.set("rph.sidebar", collapsed ? "collapsed" : "open");
      };
      head.querySelector("#rphCollapse").addEventListener("click", () => { set(true); rail.querySelector("#rphExpand").focus(); });
      rail.querySelector("#rphExpand").addEventListener("click", () => { set(false); head.querySelector("#rphCollapse").focus(); });
      rail.querySelector(".rph-rail-label").addEventListener("click", () => set(false));
      rail.querySelector("#rphRailRun").addEventListener("click", () => { const r = document.getElementById("run"); if (r) r.click(); });
      set(store.get("rph.sidebar", "open") === "collapsed");
    }

    // ---- row density ----
    const apply = (d) => {
      DENSITIES.forEach(([k]) => root.classList.toggle("rph-density-" + k, k === d));
      document.querySelectorAll(".rph-density button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.d === d)));
      store.set("rph.density", d);
    };
    document.querySelectorAll(".toolbar").forEach((tb) => {
      const g = document.createElement("div");
      g.className = "rph-density";
      g.setAttribute("role", "group");
      g.setAttribute("aria-label", "Row size");
      g.innerHTML = '<span class="rph-density-label">Rows</span>' + DENSITIES.map(([k, l]) =>
        '<button type="button" data-d="' + k + '" title="' + l + ' rows">' + densityIcon(k) + '<span class="sr">' + l + "</span></button>").join("");
      g.addEventListener("click", (e) => { const b = e.target.closest("button[data-d]"); if (b) apply(b.dataset.d); });
      // Sit just before the trailing status/actions where there is a spacer; otherwise at the end.
      const spacer = tb.querySelector(".spacer");
      if (spacer && spacer.nextSibling) spacer.after(g); else tb.appendChild(g);
    });
    apply(store.get("rph.density", "default"));
  });

  function densityIcon(k) {
    const lines = { compact: [6, 10, 14, 18], default: [7, 12, 17], comfy: [8, 16] }[k];
    return '<svg viewBox="0 0 24 24" ' + P + ">" + lines.map((y) => '<path d="M4 ' + y + 'h16"/>').join("") + "</svg>";
  }
})();
