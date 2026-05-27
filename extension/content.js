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
  };

  let config = clone(DEFAULTS);
  const host = location.hostname;
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

  function isPaused(now) {
    if ((config.pause.globalUntil || 0) > now) return true;
    const u = config.pause.siteUntil?.[host];
    return !!(u && u > now);
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

  function effectiveModes() {
    const now = Date.now();
    if (!inScope() || isPaused(now) || !inWorkingHours(now)) {
      return { video: OFF, image: OFF };
    }
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
    const m = modeFor(el, eff);
    el.classList.remove(...CLASSES);
    if (m === BLUR) el.classList.add("silenzio-blur");
    else if (m === BLACKOUT) el.classList.add("silenzio-blackout");
  }

  function applyAudio(el, eff) {
    if (!(el instanceof HTMLMediaElement)) return;
    if (eff.video === OFF) return;
    try {
      el.muted = true;
      el.volume = 0;
    } catch {}
  }

  function applyTo(el, eff) {
    applyVisual(el, eff);
    applyAudio(el, eff);
  }

  function clearAll() {
    document.querySelectorAll("." + CLASSES.join(", .")).forEach((el) => {
      el.classList.remove(...CLASSES);
    });
  }

  function scan(eff) {
    document.querySelectorAll(SELECTOR).forEach((el) => applyTo(el, eff));
  }

  function reapply() {
    clearAll();
    scan(effectiveModes());
    scheduleNextRecheck();
  }

  function scheduleNextRecheck() {
    clearTimeout(recheckTimer);
    const now = Date.now();
    const waits = [];
    if ((config.pause.globalUntil || 0) > now) waits.push(config.pause.globalUntil - now);
    const su = config.pause.siteUntil?.[host];
    if (su && su > now) waits.push(su - now);
    if (config.schedule.enabled) {
      // Re-evaluate at the next minute boundary — cheap and avoids fussy edge math.
      const d = new Date();
      waits.push(60_000 - (d.getSeconds() * 1000 + d.getMilliseconds()));
    }
    if (waits.length) recheckTimer = setTimeout(reapply, Math.min(...waits) + 50);
  }

  document.addEventListener(
    "volumechange",
    (e) => {
      const eff = effectiveModes();
      if (eff.video !== OFF && e.target instanceof HTMLMediaElement && !e.target.muted) {
        e.target.muted = true;
      }
    },
    true,
  );

  document.addEventListener(
    "play",
    (e) => {
      if (e.target instanceof HTMLMediaElement) applyTo(e.target, effectiveModes());
    },
    true,
  );

  const observer = new MutationObserver((mutations) => {
    const eff = effectiveModes();
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.matches && node.matches(SELECTOR)) applyTo(node, eff);
        if (node.querySelectorAll) {
          node.querySelectorAll(SELECTOR).forEach((el) => applyTo(el, eff));
        }
      }
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
