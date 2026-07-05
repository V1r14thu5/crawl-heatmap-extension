# Crawl Heatmap — Pass 1 vs Pass 2

A Chrome extension that visualises which parts of a page Googlebot trusts on its **first, raw-HTML crawl pass**, versus which parts it can only see after a **second, JavaScript-rendered pass**.

Built to diagnose crawlability problems on page-builder-heavy WordPress sites (Elementor, Divi, Beaver Builder, WPBakery, Bricks) — the kind of sites where content that *looks* fine in a browser is quietly deferred, delayed, or missed entirely by search engine crawlers.

## Why this exists

Google crawls most pages in two passes:

1. **Pass 1 (HTML pass):** Googlebot fetches the raw HTML response and indexes what's there immediately — no JavaScript execution required.
2. **Pass 2 (render pass):** Pages that need JavaScript to produce their final content get queued for a headless Chrome render, which can happen minutes, hours, or (at scale) days later, and consumes render budget that isn't unlimited.

Modern page builders often generate deeply nested wrapper markup and defer real content behind lazy-load classes that only resolve once JS runs client-side. The content is real and eventually gets rendered — but it's sitting in Pass 2, competing for a limited, delayed resource, instead of being trusted immediately in Pass 1.

This extension scans the live DOM, classifies every meaningful element into a trust tier, and overlays a heatmap so you can see exactly where a page falls on that spectrum — no crawler simulation, no waiting on Search Console.

## Features

- **Three-tier classification**, visualised as an overlay directly on the page:
  - 🟢 **Pass 1 trusted** — clean HTML outside any builder scaffolding, Google reads it immediately
  - 🟡 **Pass 1 present — builder scaffold** — in the raw HTML, but wrapped in page-builder containers; present but with deferred trust
  - 🔴 **Pass 2 required** — lazy-loaded or otherwise JS-dependent; needs a render pass before Google trusts it
- **Weighted coverage score** — a single 0–100% score per page (see [Scoring](#scoring) below)
- **Builder auto-detection** — Elementor, Divi, Beaver Builder, WPBakery, Bricks, or plain HTML/WordPress
- **Related-content bar detection** — related-posts/"also see" style widgets (Jetpack, YARPP, generic patterns) are recognised and reported separately, since they're typically clean HTML regardless of what builder wraps them. Add a custom CSS selector from the popup if your site uses a widget the built-in patterns don't catch.
- **Head signal audit** — title, canonical, meta description, robots meta, and structured data (JSON-LD), all always Pass 1
- **CORS / cross-domain check** — flags stylesheets blocked by CORS or served from a different origin, a common side effect of aggressive CDN/font-cache setups
- **Interactive panel** — expandable per-tier element lists with scroll-to-element buttons, so you can jump straight to the offending markup

## Installation (unpacked, for development/testing)

1. Clone or download this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the repository folder.
5. Pin the extension, then click it and press **Activate Heatmap** on any page.

## Usage

1. Navigate to the page you want to audit.
2. Click the extension icon → **Activate Heatmap**.
3. The panel in the corner shows your coverage score, tier breakdown, detected builder, head signals, and any CORS issues.
4. Click a tier row to expand its element list; click the ↗ button on any item to scroll to and briefly highlight that element on the page.
5. Click **Rescan** after any lazy-loaded content finishes loading, to re-check its final classification.

## Scoring

The coverage score weights each tier by how much crawl trust it actually carries:

| Tier | Weight |
|---|---|
| Pass 1 trusted | 1.0 |
| Pass 1 present (scaffold) | 0.5 |
| Pass 2 required | 0.0 |

```
score = round( (trusted_count × 1.0 + present_count × 0.5) / total_count × 100 )
```

Scaffolded elements get half credit rather than zero, because they *are* present in the raw HTML — they're just nested inside builder containers that can delay trust — which is a meaningfully better position than content that doesn't exist in the HTML at all until JavaScript runs.

This score is a diagnostic heuristic, not a guarantee of Google's actual indexing behaviour. Treat it as a relative signal for comparing pages or tracking improvement over time, not an absolute crawlability grade. It's also most meaningful on pages with a reasonable number of classified elements — a score computed from a handful of elements can swing sharply and shouldn't be over-interpreted.

## Supported page builders

Elementor · Divi · Beaver Builder · WPBakery · Bricks · plain HTML/WordPress (no builder)

Builder detection is fingerprint-based (DOM selectors specific to each builder's markup conventions) and lives in `src/heatmap.js` — adding support for another builder is a matter of adding a new entry to the `BUILDERS` map with a `detect()`, `containerSelector`, and `lazySelector`.

## Permissions

- `activeTab` / `scripting` — to read the DOM of the page you're actively auditing and inject the overlay
- `storage` — to remember whether the heatmap is on/off and any custom related-content selector you've set

No data is collected, stored remotely, or transmitted anywhere. See [PRIVACY.md](PRIVACY.md).

## Contributing

Issues and pull requests welcome — particularly for additional page-builder fingerprints or related-content widget patterns.

## License

MIT — see [LICENSE](LICENSE).

## Author

**Nuno Lopes**
[LinkedIn](https://www.linkedin.com/in/your-profile-here)
