# Silenzio Privacy Policy

_Last updated: 2026-05-11_

Silenzio does not collect, transmit, store on remote servers, or share any personal information, browsing history, or page contents.

## What the extension does

- Reads the DOM of pages you visit in order to find `<video>`, `<audio>`, and `<img>` elements, then applies local CSS filter classes and sets the `muted` property on media elements. All processing happens in your browser.
- Stores its own settings — selected modes, scope rules, pause timers, working-hours schedule — locally via the browser's `chrome.storage.local` API. This data never leaves your device.

## What the extension does NOT do

- Does not transmit any data over the network.
- Does not contain analytics, tracking pixels, telemetry, or third-party scripts.
- Does not read or store the textual content of pages, form inputs, cookies, credentials, authentication tokens, or anything else from the websites you visit.
- Does not maintain a backend server.
- Does not execute remote code.

## Permissions used and why

- **`storage`** — to save your settings locally in the browser.
- **`activeTab`** — used only by the popup, only when you open it. The popup reads the hostname of the current tab so it can offer site-specific pause controls (e.g. "Pause this site for 10 minutes"). No page content is read.
- **`host_permissions: <all_urls>`** — required because the extension's stated purpose is to filter visual media across all websites you visit. The content script runs on each page and reads the DOM to locate media elements and apply local CSS filters. No content from those pages is sent anywhere.

## Changes

If this policy changes, the updated version will replace this file in the repository and the "Last updated" date will be revised.

## Contact

For questions or to report a problem, please open an issue at the project's GitHub repository.
