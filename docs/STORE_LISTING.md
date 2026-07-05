# Chrome Web Store Listing — Draft Copy

Use this as a starting point when filling out the Developer Dashboard submission form.

## Short description (≤132 characters)

```
See which parts of your page Google trusts on the first crawl pass vs which need a JS render — spot Elementor/Divi crawl issues fast.
```
(131 characters)

## Detailed description

```
Crawl Heatmap shows you exactly which elements on a page Googlebot trusts immediately on its raw-HTML crawl pass, and which ones only become visible after a JavaScript render pass.

Page builders like Elementor, Divi, Beaver Builder, WPBakery, and Bricks often wrap real content in deeply nested containers and lazy-load classes. The content is real, but it's competing for a limited, delayed render-pass budget instead of being trusted on the first pass — and that can quietly hurt indexing and rankings.

This extension scans the live page and overlays a color-coded heatmap:

🟢 Pass 1 trusted — clean HTML, read immediately
🟡 Pass 1 present — inside builder scaffolding, present but with deferred trust
🔴 Pass 2 required — lazy-loaded or JS-dependent, needs a render pass

Plus:
• A weighted 0–100% coverage score for the page
• Automatic page-builder detection (Elementor, Divi, Beaver Builder, WPBakery, Bricks)
• Related-content / "also see" widget recognition, with a custom-selector option
• Head signal audit — title, canonical, meta description, robots, structured data
• CORS / cross-domain stylesheet detection
• An interactive panel with scroll-to-element navigation for every flagged item

No data is collected or sent anywhere — everything runs locally in your browser. See the privacy policy for details.

Built for developers, SEOs, and agencies auditing page-builder-heavy WordPress sites, but works on any page.
```

## Category

Developer Tools (or: SEO / Productivity, depending on what's available at submission time — check current category options in the dashboard)

## Permission justifications (paste into the relevant fields)

- **activeTab / scripting:** "Used to read the DOM of the tab the user is actively auditing and inject the visual overlay/panel. Only runs when the user clicks Activate Heatmap — not persistent or automatic."
- **storage:** "Used to remember locally whether the heatmap is toggled on and an optional custom CSS selector the user enters for related-content widget detection. No data leaves the browser."
- **Host permissions (`<all_urls>`):** "This is a diagnostic auditing tool intended to run on any page the user chooses to inspect (their own sites, client sites, competitor pages for SEO research). It reads the DOM only, makes no network requests, and sends no data anywhere."

## Privacy policy URL

Host `PRIVACY.md` somewhere public (GitHub renders it directly, or use GitHub Pages) and paste that URL into the dashboard's privacy policy field. A raw GitHub URL works, e.g.:

```
https://github.com/<your-username>/<repo-name>/blob/main/PRIVACY.md
```

## Support / homepage URL

```
https://github.com/<your-username>/<repo-name>
```

## Screenshots

Pull from `docs/screenshots/` once populated — see that folder's README for shot suggestions and size requirements.
