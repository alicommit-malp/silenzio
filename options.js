const STORAGE_KEY = "silenzio";
const DEFAULTS = {
  modes: { video: "blur", image: "blur" },
  scope: { type: "all", sites: [] },
  pause: { globalUntil: 0, siteUntil: {} },
  schedule: { enabled: false, days: [1, 2, 3, 4, 5], start: "09:00", end: "17:00" },
};
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function merge(saved) {
  saved = saved || {};
  return {
    modes: { ...DEFAULTS.modes, ...(saved.modes || {}) },
    scope: { ...DEFAULTS.scope, ...(saved.scope || {}) },
    pause: {
      globalUntil: saved.pause?.globalUntil ?? 0,
      siteUntil: { ...(saved.pause?.siteUntil || {}) },
    },
    schedule: { ...DEFAULTS.schedule, ...(saved.schedule || {}) },
  };
}

function load(cb) {
  chrome.storage.local.get([STORAGE_KEY], (res) => cb(merge(res[STORAGE_KEY])));
}

function save(cfg) {
  chrome.storage.local.set({ [STORAGE_KEY]: cfg });
}

function normalizeHost(input) {
  let s = (input || "").trim().toLowerCase();
  if (!s) return "";
  s = s.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return s;
}

function fmtTime(ms) {
  return new Date(ms).toLocaleString();
}

function renderSites(cfg) {
  const list = document.getElementById("site-list");
  list.innerHTML = "";
  if (!cfg.scope.sites.length) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "No sites listed yet.";
    list.appendChild(p);
    return;
  }
  cfg.scope.sites.forEach((s) => {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = s;
    const btn = document.createElement("button");
    btn.textContent = "Remove";
    btn.addEventListener("click", () => {
      load((c) => {
        c.scope.sites = c.scope.sites.filter((x) => x !== s);
        save(c);
        renderAll(c);
      });
    });
    li.append(span, btn);
    list.appendChild(li);
  });
}

function renderDays(cfg) {
  const container = document.getElementById("days");
  container.innerHTML = "";
  DAY_NAMES.forEach((name, idx) => {
    const b = document.createElement("button");
    b.textContent = name;
    b.classList.toggle("active", cfg.schedule.days.includes(idx));
    b.addEventListener("click", () => {
      load((c) => {
        const set = new Set(c.schedule.days);
        if (set.has(idx)) set.delete(idx);
        else set.add(idx);
        c.schedule.days = [...set].sort((a, b) => a - b);
        save(c);
        renderAll(c);
      });
    });
    container.appendChild(b);
  });
}

function renderGlobalPause(cfg) {
  const status = document.getElementById("global-status");
  if (cfg.pause.globalUntil > Date.now()) {
    status.textContent = `Paused everywhere until ${fmtTime(cfg.pause.globalUntil)}.`;
  } else {
    status.textContent = "";
  }
}

function renderAll(cfg) {
  document.querySelectorAll('input[name="scope"]').forEach((r) => {
    r.checked = r.value === cfg.scope.type;
  });
  document.getElementById("schedule-enabled").checked = cfg.schedule.enabled;
  document.getElementById("schedule-start").value = cfg.schedule.start;
  document.getElementById("schedule-end").value = cfg.schedule.end;
  renderSites(cfg);
  renderDays(cfg);
  renderGlobalPause(cfg);
}

function init() {
  load(renderAll);

  document.querySelectorAll('input[name="scope"]').forEach((r) => {
    r.addEventListener("change", () => {
      load((c) => {
        c.scope.type = r.value;
        save(c);
        renderAll(c);
      });
    });
  });

  document.getElementById("site-add").addEventListener("click", () => {
    const input = document.getElementById("site-input");
    const host = normalizeHost(input.value);
    if (!host) return;
    load((c) => {
      if (!c.scope.sites.includes(host)) c.scope.sites.push(host);
      save(c);
      renderAll(c);
      input.value = "";
    });
  });

  document.getElementById("site-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("site-add").click();
  });

  document.getElementById("schedule-enabled").addEventListener("change", (e) => {
    load((c) => {
      c.schedule.enabled = e.target.checked;
      save(c);
      renderAll(c);
    });
  });

  ["schedule-start", "schedule-end"].forEach((id) => {
    document.getElementById(id).addEventListener("change", (e) => {
      load((c) => {
        if (id === "schedule-start") c.schedule.start = e.target.value;
        else c.schedule.end = e.target.value;
        save(c);
        renderAll(c);
      });
    });
  });

  document.querySelectorAll(".global-pause button[data-pause]").forEach((b) => {
    b.addEventListener("click", () => {
      load((c) => {
        c.pause.globalUntil = Date.now() + Number(b.dataset.pause) * 60_000;
        save(c);
        renderAll(c);
      });
    });
  });

  document.getElementById("global-resume").addEventListener("click", () => {
    load((c) => {
      c.pause.globalUntil = 0;
      c.pause.siteUntil = {};
      save(c);
      renderAll(c);
    });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[STORAGE_KEY]) renderAll(merge(changes[STORAGE_KEY].newValue));
  });
}

init();
