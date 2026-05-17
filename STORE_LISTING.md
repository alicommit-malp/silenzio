# Chrome Web Store listing copy

Reference for the dev-console form. Update this file alongside any user-visible feature change so the next listing edit can be paste-ready.

---

## Short description (max 132 chars)

> Blur or black out videos and images and mute audio across the web — with scope rules, pause timers, and working-hours mode.

(124 chars)

---

## Detailed description

```text
Silenzio blurs or blacks out videos and images and mutes audio on every website you visit — useful for focusing, sharing your screen, or browsing feeds without being pulled in by autoplay or surprise content.

FEATURES

Per-type modes — independent Off / Blur / Blackout for videos and images. Set them separately so you can, for example, blur videos while leaving images visible.

Audio muting — <video> and <audio> are muted whenever video filtering is on. Capture-phase listeners catch sites that try to unmute or swap sources.

Works on standard players (YouTube), short-form feeds (YouTube Shorts, LinkedIn feed, Instagram Reels, X video posts), and any <img> on the page (JPG, PNG, GIF, WebP, SVG).

Scope rules — apply on all sites, only on a list of sites you add, or everywhere except a list. Hostname suffix match means one entry like "youtube.com" covers www.youtube.com and m.youtube.com.

Pause timers — quick-pause buttons in the popup (5/10/30 minutes for the current site) and in settings (15/60 minutes global). Resumes automatically when the timer ends.

Working hours — optional schedule so Silenzio is active only during the hours and days you choose. Default Mon–Fri 09:00–17:00. The window means "active during" — outside the window, Silenzio stops applying.

Dark mode — popup and settings follow your browser and OS theme automatically.

Settings stored locally in your browser — never sent anywhere.

PRIVACY

Silenzio collects no data, transmits nothing, and contains no third-party scripts. The broad host permission is required because the extension's purpose is to filter media across every site you visit; nothing from those sites is sent off your device. See the privacy policy for permission-by-permission justifications.

LIMITATIONS

CSS background-image is not currently filtered — only <img>, <video>, and <audio> elements are. Inline <svg> icons are not filtered (but <img src="*.svg"> is). Web Audio API graphs that bypass HTMLMediaElement.muted are not muted; ordinary playback on YouTube, LinkedIn, etc. uses HTMLMediaElement and is muted correctly.
```

---

## Single-purpose statement

> Filter visual media (videos and images) and mute audio on web pages, with user-configured scope rules, pause timers, and a working-hours schedule.

---

## Permission justifications

These are the final plain-text wordings pasted into the dev-console privacy form. Each fits the 1000-character limit.

**`storage`**

> Used to persist the user's settings — video and image modes (Off / Blur / Blackout), scope mode and the list of sites used by allowlist/blocklist rules, pause-timer expiry timestamps, and the working-hours schedule — via chrome.storage.local so they survive browser restarts. The data is stored locally on the user's device and is never transmitted off it.

**`activeTab`**

> Used only by the popup, and only when the user opens it. The popup reads the hostname of the currently active tab so it can label the "Pause this site" controls and write any per-site pause entry under the correct hostname key. No page content, URL path, form data, cookies, or other tab information are accessed. The hostname is used locally and is never transmitted off the user's device.

**`host_permissions: <all_urls>`**

```text
The extension's single purpose is to blur or black out videos and images and mute audio across every website the user visits. The content script must run on each page to locate <video>, <audio>, and <img> elements and apply local CSS filter classes to them, and to set the muted property on media elements. The extension supports user-configured scope rules (an allowlist or blocklist of sites), but the default and core experience is "filter everywhere"; restricting to a fixed host list at install time would prevent the extension from serving its purpose on the user's general browsing surface. The content script reads page DOM only for the purpose of locating the elements named above; no page content, cookies, form data, credentials, or other information is read for any other purpose, and nothing is sent off the user's device.
```

**Remote code: No.** All JavaScript is bundled in the extension package (content.js, popup.js, options.js). No `<script src="https://...">` tags, no remote module imports, no `eval()` or `new Function()`, no CDN-loaded code.

---

## Category

Productivity. (Alternative: Accessibility — both are reasonable; Productivity matches the working-hours and focus framing.)

---

## Screenshots (you provide these, 1280×800 or 640×400)

Suggested captures:

1. **Popup open on YouTube** — main player visibly blurred behind the popup, popup showing Videos=Blur, Images=Blur, "Pause this site" row. This shows the core proposition in one image.
2. **Settings page** — Scope set to "Only apply on listed sites" with `youtube.com` and `linkedin.com` in the list, Working hours toggled on with Mon–Fri 09:00–17:00 visible.
3. **(Optional) LinkedIn feed** with autoplay videos blurred — demonstrates the feed/dynamic-mount use case.

A clean dark-mode capture is fine if your OS theme is dark — Chrome reviewers don't require light-mode shots.

---

## Privacy policy URL

Host [PRIVACY.md](PRIVACY.md) somewhere reachable and paste that URL into the listing. Options:

- GitHub blob: `https://github.com/<your-username>/silenzio/blob/main/PRIVACY.md` — works, reviewers accept it.
- GitHub Pages: enable Pages on the repo, then `https://<your-username>.github.io/silenzio/PRIVACY` — cleaner URL.

Live value: `https://alicommit-malp.github.io/silenzio/PRIVACY/`

---

## Firefox AMO listing metadata

These are the AMO-specific fields (distinct from the Chrome dev console). Reuse for any AMO re-submission and as a reference for the Edge listing.

### Screenshot captions

1. `YouTube search results with video thumbnails blurred; the Silenzio popup shows per-type Off / Blur / Blackout toggles and pause buttons.`
2. `Blackout mode hiding product images on a shopping page.`

### Tags

```text
productivity, focus, privacy, distraction-free, video, blur, mute
```

### Homepage

```text
https://alicommit-malp.github.io/silenzio/
```

### Contributions URL

Blank unless a GitHub Sponsors / donation link exists.

### Developer Comments (public on the listing)

```text
Silenzio is open source under the MIT license. On first install, open the Firefox extensions menu (puzzle-piece icon) → Silenzio → "Always allow on all websites" so the content script can run — Firefox MV3 requires this host-permission grant explicitly. Source, issues, and the privacy policy: https://github.com/alicommit-malp/silenzio
```

### UUID / add-on ID

`silenzio@silenzio.local` — set via `browser_specific_settings.gecko.id` in the manifest. Permanent on AMO after first submission; cannot be changed later.

### Whiteboard (private; visible to AMO reviewers, persists across versions)

```text
No account or login required to test. After install, grant "Always allow on all websites" via the extensions menu (standard Firefox MV3 host-permission grant) — without it the content script does not inject. Visit youtube.com or linkedin.com: videos and image thumbnails blur by default. The popup exposes independent video/image mode toggles and per-site pause; "Settings →" opens scope rules and a working-hours schedule. Source is unminified with no build step — the uploaded ZIP is the source. Repo: https://github.com/alicommit-malp/silenzio
```
