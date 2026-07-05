# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-07-05

### Changed
- **Weighted scoring:** Pass 1 coverage score now gives partial (0.5) credit to "Pass 1 present — builder scaffold" elements instead of zero, since they're distinct from — and better than — elements that require a full render pass. Previously, scaffolded and render-required elements were scored identically.
- **Generalized related-content detection:** replaced a hard-coded single-site class selector with a broader pattern match covering common related-posts/"also see" widget conventions (Jetpack, YARPP, generic naming), plus an optional user-configurable CSS selector via the popup for site-specific widgets.
- Renamed internal "Also-See bar" terminology to "related-content bar" throughout the UI and codebase to reflect the generalized detection.

### Added
- Custom selector input field in the popup, persisted via `chrome.storage.local`, for related-content widgets the built-in patterns don't catch.

## [1.0.0] - 2026-06-09

### Added
- Initial release.
- Three-tier crawl classification: Pass 1 trusted, Pass 1 present (builder scaffold), Pass 2 required.
- Builder auto-detection for Elementor, Divi, Beaver Builder, WPBakery, and Bricks.
- Head signal audit (title, canonical, meta description, robots, structured data).
- CORS / cross-domain stylesheet detection.
- Interactive on-page panel with expandable per-tier element lists and scroll-to-element navigation.
