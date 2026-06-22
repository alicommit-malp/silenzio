(() => {
  const STORAGE_KEY = "silenzio";
  const LEGACY_KEY = "silenzio_modes";
  const OFF = "off";
  const BLUR = "blur";
  const BLACKOUT = "blackout";
  const CLASSES = ["silenzio-blur", "silenzio-blackout"];
  const SELECTOR = "video, audio, img";

  const DEFAULTS = {
    modes: { video: BLUR, image: BLUR },
    scope: { type: "all", sites: [] }, // "all" | "allowlist" | "blocklist"
    pause: { globalUntil: 0, siteUntil: {} },
    schedule: {
      enabled: false,
      days: [1, 2, 3, 4, 5], // Sun=0..Sat=6
      start: "09:00",
      end: "17:00",
    },
    peek: { enabled: true },
    rules: [], // [{ pattern: "host/path*", mode: "off"|"blur"|"blackout" }]
  };

  let config = clone(DEFAULTS);
  const host = location.hostname;
  // Per-site pause is keyed by the *top tab's* host (the popup only knows that).
  // A cross-origin iframe's own host won't match, so it must also evaluate the
  // pause against the top frame's host. Learned via postMessage in subframes.
  let topHost = window.top === window.self ? host : null;
  let recheckTimer = 0;

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function mergeConfig(next) {
    next = next || {};
    return {
      modes: { ...DEFAULTS.modes, ...(next.modes || {}) },
      scope: { ...DEFAULTS.scope, ...(next.scope || {}) },
      pause: {
        globalUntil: next.pause?.globalUntil ?? 0,
        siteUntil: { ...(next.pause?.siteUntil || {}) },
      },
      schedule: { ...DEFAULTS.schedule, ...(next.schedule || {}) },
      peek: { ...DEFAULTS.peek, ...(next.peek || {}) },
      rules: Array.isArray(next.rules) ? next.rules.slice() : [],
    };
  }

  function hostMatchesList(sites) {
    return sites.some((s) => host === s || host.endsWith("." + s));
  }

  function inScope() {
    if (config.scope.type === "allowlist") return hostMatchesList(config.scope.sites);
    if (config.scope.type === "blocklist") return !hostMatchesList(config.scope.sites);
    return true;
  }

  // Hosts whose per-site pause applies to media in this frame: the frame's own
  // host plus the top tab's host (so a pause set on the page reaches its
  // cross-origin iframes). Deduped when they're the same.
  function pauseHosts() {
    return topHost && topHost !== host ? [host, topHost] : [host];
  }

  function isPaused(now) {
    if ((config.pause.globalUntil || 0) > now) return true;
    const su = config.pause.siteUntil || {};
    return pauseHosts().some((h) => su[h] && su[h] > now);
  }

  function inWorkingHours(now) {
    const s = config.schedule;
    if (!s.enabled) return true;
    const d = new Date(now);
    if (s.days?.length && !s.days.includes(d.getDay())) return false;
    const cur = d.getHours() * 60 + d.getMinutes();
    const [sh, sm] = s.start.split(":").map(Number);
    const [eh, em] = s.end.split(":").map(Number);
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    if (start <= end) return cur >= start && cur < end;
    return cur >= start || cur < end; // crosses midnight
  }

  function normalizePattern(s) {
    return (s || "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  }

  function ruleMatches(pattern) {
    pattern = normalizePattern(pattern);
    if (!pattern) return false;
    const slash = pattern.indexOf("/");
    const pHost = slash === -1 ? pattern : pattern.slice(0, slash);
    const pPath = slash === -1 ? "" : pattern.slice(slash);
    if (host !== pHost && !host.endsWith("." + pHost)) return false;
    if (!pPath) return true;
    const path = location.pathname;
    if (pPath.endsWith("*")) return path.startsWith(pPath.slice(0, -1));
    return path === pPath;
  }

  function modesFromRule(mode) {
    if (mode === OFF) return { video: OFF, image: OFF };
    if (mode === BLUR) return { video: BLUR, image: BLUR };
    if (mode === BLACKOUT) return { video: BLACKOUT, image: BLACKOUT };
    return null;
  }

  function effectiveModes() {
    const now = Date.now();
    if (isPaused(now) || !inWorkingHours(now)) {
      return { video: OFF, image: OFF };
    }
    for (const r of config.rules) {
      if (ruleMatches(r.pattern)) {
        const m = modesFromRule(r.mode);
        if (m) return m;
      }
    }
    if (!inScope()) return { video: OFF, image: OFF };
    return config.modes;
  }

  function modeFor(el, eff) {
    if (el instanceof HTMLVideoElement) return eff.video;
    if (el instanceof HTMLImageElement) return eff.image;
    if (el instanceof HTMLMediaElement) return eff.video; // <audio> follows video
    return OFF;
  }

  function applyVisual(el, eff) {
    if (!(el instanceof HTMLVideoElement) && !(el instanceof HTMLImageElement)) return;
    if (el.hasAttribute("data-silenzio-peek")) return;
    const m = modeFor(el, eff);
    el.classList.remove(...CLASSES);
    if (m === BLUR) el.classList.add("silenzio-blur");
    else if (m === BLACKOUT) el.classList.add("silenzio-blackout");
  }

  function applyAudio(el, eff) {
    if (!(el instanceof HTMLMediaElement)) return;
    if (eff.video === OFF) return;
    if (el.hasAttribute("data-silenzio-mute-set")) return;
    try {
      el.muted = true;
      el.setAttribute("data-silenzio-mute-set", "1");
    } catch {}
  }

  function applyPlayback(el, eff) {
    if (!(el instanceof HTMLMediaElement)) return;
    if (el.hasAttribute("data-silenzio-peek")) return;
    if (modeFor(el, eff) !== BLACKOUT) return;
    try {
      el.pause();
    } catch {}
  }

  function applyTo(el, eff) {
    applyVisual(el, eff);
    applyAudio(el, eff);
    applyPlayback(el, eff);
  }

  function clearAll() {
    document.querySelectorAll("." + CLASSES.join(", .")).forEach((el) => {
      el.classList.remove(...CLASSES);
    });
  }

  function scan(eff) {
    document.querySelectorAll(SELECTOR).forEach((el) => applyTo(el, eff));
  }

  let prevEffectiveOff = true;
  function reapply() {
    endPeek();
    clearAll();
    const eff = effectiveModes();
    const nowOff = eff.video === OFF;
    // On OFF -> ON transition (e.g. pause expires) re-enforce: clear the
    // one-shot mute flag so applyAudio mutes again on the upcoming scan.
    if (prevEffectiveOff && !nowOff) {
      document.querySelectorAll("[data-silenzio-mute-set]").forEach((el) => {
        el.removeAttribute("data-silenzio-mute-set");
      });
    }
    prevEffectiveOff = nowOff;
    scan(eff);
    scheduleNextRecheck();
  }

  function scheduleNextRecheck() {
    clearTimeout(recheckTimer);
    const now = Date.now();
    const waits = [];
    if ((config.pause.globalUntil || 0) > now) waits.push(config.pause.globalUntil - now);
    const su = config.pause.siteUntil || {};
    for (const h of pauseHosts()) {
      if (su[h] && su[h] > now) waits.push(su[h] - now);
    }
    if (config.schedule.enabled) {
      // Re-evaluate at the next minute boundary — cheap and avoids fussy edge math.
      const d = new Date();
      waits.push(60_000 - (d.getSeconds() * 1000 + d.getMilliseconds()));
    }
    if (waits.length) recheckTimer = setTimeout(reapply, Math.min(...waits) + 50);
  }

  document.addEventListener(
    "play",
    (e) => {
      if (e.target instanceof HTMLMediaElement) applyTo(e.target, effectiveModes());
    },
    true,
  );

  // Long-press to peek: hold a silenzio'd element for PEEK_HOLD_MS to reveal it
  // until release. The click that follows release is swallowed so a peek on a
  // linked image doesn't also navigate.
  const PEEK_HOLD_MS = 400;
  let peekEl = null;
  let peekTimer = 0;

  function isSilenzioEl(el) {
    return (
      el instanceof Element &&
      (el.classList.contains("silenzio-blur") || el.classList.contains("silenzio-blackout"))
    );
  }

  // Many sites (Instagram, LinkedIn, ...) put a transparent overlay over images
  // for click handling, so pointerdown.target is the overlay, not the <img>.
  // Walk the hit-test stack; fall back to bounding-box scan in case the
  // silenzio'd element has pointer-events:none and is skipped by hit-testing.
  function silenzioElAtPoint(x, y) {
    const stack = document.elementsFromPoint(x, y);
    for (const el of stack) {
      if (isSilenzioEl(el)) return el;
    }
    const els = document.querySelectorAll(".silenzio-blur, .silenzio-blackout");
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return el;
    }
    return null;
  }

  // Try a few strategies anchored on the click target, with bounds-check so we
  // don't pick up a silenzio'd element in a totally unrelated part of the page.
  function silenzioNearTarget(target, x, y) {
    if (!(target instanceof Element)) return null;
    const inBounds = (el) => {
      const r = el.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    };
    let node = target;
    while (node && node !== document.documentElement) {
      if (isSilenzioEl(node) && inBounds(node)) return node;
      const inner = node.querySelector?.(".silenzio-blur, .silenzio-blackout");
      if (inner && inBounds(inner)) return inner;
      node = node.parentElement;
    }
    return null;
  }

  function startPeek(el) {
    peekEl = el;
    el.setAttribute("data-silenzio-peek", "1");
    el.classList.remove(...CLASSES);
  }

  function endPeek() {
    if (!peekEl) return;
    const el = peekEl;
    peekEl = null;
    el.removeAttribute("data-silenzio-peek");
    applyTo(el, effectiveModes());
  }

  function cancelPeekTimer() {
    if (peekTimer) {
      clearTimeout(peekTimer);
      peekTimer = 0;
    }
  }

  function suppressNextClick() {
    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    };
    window.addEventListener("click", handler, { capture: true, once: true });
    setTimeout(() => window.removeEventListener("click", handler, true), 200);
  }

  // Some sites preventDefault or otherwise interfere with pointerdown but not
  // mousedown (or vice versa) — listen to both and dedupe with a short guard.
  let lastPressTime = 0;

  function onPeekPress(e) {
    if (!config.peek.enabled) return;
    if (e.button !== 0) return;
    const now = performance.now();
    if (now - lastPressTime < 50) return;
    lastPressTime = now;
    const x = e.clientX;
    const y = e.clientY;
    if (!silenzioNearTarget(e.target, x, y) && !silenzioElAtPoint(x, y)) return;
    // Re-find at peek-fire time — sites swap <img> for an inline <video>
    // preview mid-hold; the captured reference would be detached.
    const target = e.target;
    cancelPeekTimer();
    peekTimer = setTimeout(() => {
      peekTimer = 0;
      const fresh = silenzioNearTarget(target, x, y) || silenzioElAtPoint(x, y);
      if (fresh && fresh.isConnected) startPeek(fresh);
    }, PEEK_HOLD_MS);
  }

  function onPeekRelease() {
    cancelPeekTimer();
    if (peekEl) {
      endPeek();
      suppressNextClick();
    }
  }

  function onPeekCancel() {
    cancelPeekTimer();
    endPeek();
  }

  window.addEventListener("pointerdown", onPeekPress, true);
  window.addEventListener("mousedown", onPeekPress, true);
  window.addEventListener("pointerup", onPeekRelease, true);
  window.addEventListener("mouseup", onPeekRelease, true);
  window.addEventListener("pointercancel", onPeekCancel, true);

  // Heavy SPAs (LinkedIn, Instagram, …) burst hundreds of mutations during
  // hydrate/render. Coalesce them: collect added roots in a Set and process
  // once per animation frame so we don't run an O(subtree) query per microtask.
  let pendingRoots = new Set();
  let flushScheduled = false;

  function flushPending() {
    flushScheduled = false;
    const roots = pendingRoots;
    pendingRoots = new Set();
    const eff = effectiveModes();
    for (const node of roots) {
      if (!node.isConnected) continue;
      if (node.matches && node.matches(SELECTOR)) applyTo(node, eff);
      if (node.querySelectorAll) {
        node.querySelectorAll(SELECTOR).forEach((el) => applyTo(el, eff));
      }
    }
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === 1) pendingRoots.add(node);
      }
    }
    if (!flushScheduled) {
      flushScheduled = true;
      requestAnimationFrame(flushPending);
    }
  });

  function start() {
    scan(effectiveModes());
    const target = document.documentElement || document;
    observer.observe(target, { childList: true, subtree: true });
    scheduleNextRecheck();
  }

  function loadConfig(next) {
    config = mergeConfig(next);
    reapply();
  }

  start();

  // Teach cross-origin subframes the top tab's host so per-site pause (keyed by
  // the top host in the popup) reaches them. The top frame answers requests sent
  // to window.top; subframes poll until they get a reply (content scripts in all
  // frames start at document_start, so the top may not be listening on the first
  // try). Same-origin nesting works too — every frame addresses window.top.
  const TOPHOST_TAG = "__silenzio_topHost";
  if (window.top === window.self) {
    window.addEventListener("message", (e) => {
      if (e.data && e.data.t === TOPHOST_TAG && e.data.q && e.source) {
        e.source.postMessage({ t: TOPHOST_TAG, host: location.hostname }, "*");
      }
    });
  } else {
    window.addEventListener("message", (e) => {
      if (e.source !== window.top || !e.data || e.data.t !== TOPHOST_TAG || e.data.q) return;
      if (typeof e.data.host === "string" && e.data.host !== topHost) {
        topHost = e.data.host;
        reapply();
      }
    });
    let tries = 0;
    const pollTopHost = () => {
      if (topHost) return;
      try {
        window.top.postMessage({ t: TOPHOST_TAG, q: 1 }, "*");
      } catch {}
      if (tries++ < 10) setTimeout(pollTopHost, 250);
    };
    pollTopHost();
  }

  // SPA navigation: many sites (LinkedIn, X, Reddit, ...) change URL without
  // a full page reload, so URL-pattern rules need to be re-evaluated on the fly.
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      reapply();
    }
  }, 1000);

  if (chrome?.storage?.local) {
    chrome.storage.local.get([STORAGE_KEY, LEGACY_KEY], (res) => {
      if (res[STORAGE_KEY]) loadConfig(res[STORAGE_KEY]);
      else if (res[LEGACY_KEY]) loadConfig({ modes: res[LEGACY_KEY] });
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes[STORAGE_KEY]) loadConfig(changes[STORAGE_KEY].newValue);
    });
  }
})();
