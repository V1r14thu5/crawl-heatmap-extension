# Privacy Policy

**Last updated:** July 2026

Crawl Heatmap — Pass 1 vs Pass 2 ("the extension") does not collect, store, transmit, or sell any personal data or browsing data.

## What the extension does

- Reads the DOM of the currently active tab, only when you click **Activate Heatmap**.
- Classifies elements already visible in that page's HTML into crawl-trust tiers.
- Renders a visual overlay and summary panel directly in the page, entirely within your browser.

## What the extension does not do

- It does not send any data to a remote server. There is no backend — everything runs locally, client-side, in the tab you're viewing.
- It does not track your browsing activity across sites or over time.
- It does not use analytics, telemetry, or third-party tracking scripts.
- It does not read or store page content beyond the current session.

## Local storage

The extension uses Chrome's `storage.local` API to remember two small preferences on your own device:

- Whether the heatmap overlay is currently toggled on or off
- An optional custom CSS selector you've entered for related-content widget detection

This data never leaves your browser and is not accessible to the extension developer or any third party.

## Permissions

| Permission | Reason |
|---|---|
| `activeTab` | Lets the extension read and overlay the tab you're currently viewing, only when activated |
| `scripting` | Injects the overlay/panel content script into the active page |
| `storage` | Saves the two local preferences described above |

## Changes to this policy

If this policy changes, the updated version will be posted in this repository with a revised "Last updated" date.

## Contact

Questions about this policy can be directed to the author — see [README.md](README.md#author).
