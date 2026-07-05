/**
 * Crawl Heatmap — content script
 * Classifies DOM elements into crawl tiers and overlays a heatmap.
 *
 * TIERS:
 *   pass1-trusted   — clean HTML outside any builder, Google trusts immediately (green)
 *   pass1-present   — in raw HTML but inside page builder scaffolding (amber)
 *   pass2-required  — lazy-loaded / JS-dependent (red)
 *   no-value        — no crawl value (skipped)
 *
 * Related-content bars (related-posts / also-see widgets) are detected
 * separately and noted in the panel but count as pass1-trusted — because
 * from Google's perspective they ARE just clean HTML. No special tier.
 */

(function () {
  'use strict';

  if (window.__crawlHeatmapLoaded) return;
  window.__crawlHeatmapLoaded = true;

  // ── Helpers ────────────────────────────────────────────────────────────────
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── State ──────────────────────────────────────────────────────────────────
  let active = false;
  let overlays = [];
  let panel = null;
  let customBarSelector = '';

  // ── Known "related content" widget conventions ──────────────────────────────
  // Class-name fragments used by common related-posts / "also see" style widgets.
  // These are always plain server-rendered links regardless of theme/builder,
  // so we surface them separately rather than lumping them in with generic content.
  const RELATED_CONTENT_PATTERNS = [
    'related-post', 'relatedpost',      // generic / most themes
    'jp-relatedposts',                  // Jetpack
    'yarpp',                            // YARPP plugin
    'also-see', 'alsosee', 'also_see',  // "Also see" / "See also" widgets
    'you-might-also-like', 'ymal',
    'read-more-related',
    'widget_related',
  ];

  // ── Page builder fingerprints ──────────────────────────────────────────────
  const BUILDERS = {
    elementor: {
      name: 'Elementor',
      detect: () => !!document.querySelector('[data-elementor-type],[data-element_type]'),
      containerSelector: '[data-elementor-type],[data-element_type],[data-e-type]',
      lazySelector: '.e-con.e-parent:not(.e-lazyloaded)',
    },
    divi: {
      name: 'Divi',
      detect: () => !!document.querySelector('.et_pb_section,.et_pb_module'),
      containerSelector: '.et_pb_section,.et_pb_row,.et_pb_column,.et_pb_module',
      lazySelector: '[data-et-multi-view]',
    },
    beaver: {
      name: 'Beaver Builder',
      detect: () => !!document.querySelector('.fl-builder-content,.fl-module'),
      containerSelector: '.fl-builder-content,.fl-row,.fl-col,.fl-module',
      lazySelector: '.fl-module:not(.fl-visible)',
    },
    wpbakery: {
      name: 'WPBakery',
      detect: () => !!document.querySelector('.vc_row,.wpb_wrapper'),
      containerSelector: '.vc_row,.vc_row-fluid,.wpb_wrapper,.vc_column_inner',
      lazySelector: '[data-vc-full-width]',
    },
    bricks: {
      name: 'Bricks',
      detect: () => !!document.querySelector('[data-element-id],.brxe-section'),
      containerSelector: '.brxe-section,.brxe-container,.brxe-div,[data-element-id]',
      lazySelector: '.brx-lazy',
    },
  };

  function detectBuilder() {
    for (const [key, b] of Object.entries(BUILDERS)) {
      if (b.detect()) return { key, ...b };
    }
    return null;
  }

  // ── Check if element is inside a "related content" bar ─────────────────────
  // Matches common related-posts/also-see widget conventions by class-name
  // fragment (case-insensitive, partial match), plus an optional selector the
  // user can supply from the popup for site-specific widgets we don't know about.
  function isRelatedContentBar(el) {
    const matchesPattern = (node) => {
      if (!node.className || typeof node.className !== 'string') return false;
      const cls = node.className.toLowerCase();
      return RELATED_CONTENT_PATTERNS.some((p) => cls.includes(p));
    };

    let node = el;
    while (node && node !== document.body) {
      if (matchesPattern(node)) return true;
      if (customBarSelector && node.matches && (() => {
        try { return node.matches(customBarSelector); } catch (e) { return false; }
      })()) return true;
      node = node.parentElement;
    }
    return false;
  }

  // ── Check if element is inside a builder container ─────────────────────────
  function getBuilderDepth(el, builder) {
    if (!builder) return { insideContainer: false, insideLazy: false };
    let node = el.parentElement;
    let depth = 0;
    let insideContainer = false;
    let insideLazy = false;
    while (node && node !== document.body && depth < 25) {
      if (node.matches) {
        if (node.matches(builder.containerSelector)) insideContainer = true;
        if (builder.lazySelector && node.matches(builder.lazySelector)) insideLazy = true;
      }
      node = node.parentElement;
      depth++;
    }
    return { insideContainer, insideLazy };
  }

  // ── Classify a link element ────────────────────────────────────────────────
  function classifyLink(a, builder) {
    const href = a.getAttribute('href') || '';
    if (!href || href === '#' ||
        href.startsWith('javascript:') ||
        href.startsWith('#elementor-action') ||
        href.startsWith('tel:') ||
        href.startsWith('mailto:')) {
      return 'no-value';
    }

    // Related-content bar links count as pass1-trusted (clean HTML, same as any nav link)
    if (isRelatedContentBar(a)) return 'pass1-trusted';

    if (!builder) return 'pass1-trusted';

    const { insideContainer, insideLazy } = getBuilderDepth(a, builder);
    if (insideLazy) return 'pass2-required';
    if (insideContainer) return 'pass1-present';
    return 'pass1-trusted';
  }

  // ── Classify a text element ────────────────────────────────────────────────
  function classifyText(el, builder) {
    const text = (el.textContent || '').trim();
    if (text.length < 15) return 'no-value';

    // Plain content zones — always pass1
    if (el.closest('.entry-content,.post-content,.wp-block-post-content')) {
      return 'pass1-trusted';
    }

    if (!builder) return 'pass1-trusted';

    const { insideContainer, insideLazy } = getBuilderDepth(el, builder);
    if (insideLazy) return 'pass2-required';
    if (insideContainer) return 'pass1-present';
    return 'pass1-trusted';
  }

  // ── Head signals ───────────────────────────────────────────────────────────
  function getHeadSignals() {
    const out = [];
    const add = (type, val) => val && out.push({ type, value: String(val).trim().slice(0, 70) });

    add('Title', document.title);
    add('Canonical', document.querySelector('link[rel="canonical"]')?.href);
    add('Robots', document.querySelector('meta[name="robots"]')?.content);
    add('Description', document.querySelector('meta[name="description"]')?.content);
    add('OG Title', document.querySelector('meta[property="og:title"]')?.content);

    document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
      try {
        const p = JSON.parse(s.textContent);
        const t = p['@type'] || (p['@graph'] || []).map(g => g['@type']).filter(Boolean).join(', ') || '?';
        add('Structured Data', t);
      } catch(e) {}
    });

    return out;
  }

  // ── CORS issues ────────────────────────────────────────────────────────────
  function getCorsIssues() {
    const issues = [];
    const pageApex = window.location.hostname.split('.').slice(-2).join('.');

    document.querySelectorAll('link[rel="stylesheet"]').forEach(l => {
      if (!l.href) return;
      try {
        const url = new URL(l.href);
        const linkApex = url.hostname.split('.').slice(-2).join('.');
        if (linkApex === pageApex) return;

        // Try to read cssRules — throws SecurityError if CORS blocked
        try {
          const sheet = Array.from(document.styleSheets).find(s => s.href === l.href);
          if (sheet) { sheet.cssRules; return; } // loaded fine
        } catch(e) {
          issues.push({ type: 'Stylesheet (CORS blocked)', url: l.href });
          return;
        }

        // Flag cross-domain Elementor font caches even if not blocked yet
        if (l.href.includes('google-fonts') || l.href.includes('elementor')) {
          issues.push({ type: 'Cross-domain font cache', url: l.href });
        }
      } catch(e) {}
    });

    return issues;
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  function buildStats(classifications) {
    // classifications is a Map — iterate correctly
    const counts = { 'pass1-trusted': 0, 'pass1-present': 0, 'pass2-required': 0 };
    for (const [, tier] of classifications) {
      if (tier in counts) counts[tier]++;
    }
    const total = counts['pass1-trusted'] + counts['pass1-present'] + counts['pass2-required'];
    // Weighted score: trusted = full credit, present/scaffolded = half credit
    // (it IS in the raw HTML, just deferred trust), pass2-required = zero credit.
    const TRUSTED_WEIGHT = 1;
    const PRESENT_WEIGHT = 0.5;
    const weighted = (counts['pass1-trusted'] * TRUSTED_WEIGHT) + (counts['pass1-present'] * PRESENT_WEIGHT);
    const score = total > 0 ? Math.round((weighted / total) * 100) : 0;
    return { counts, total, score };
  }

  // ── Count related-content bar links specifically ────────────────────────────
  function countRelatedContentLinks() {
    return Array.from(document.querySelectorAll('a[href]')).filter(isRelatedContentBar).length;
  }

  // ── Main scan ──────────────────────────────────────────────────────────────
  function runScan() {
    const builder = detectBuilder();
    const classifications = new Map();

    // Links
    document.querySelectorAll('a[href]').forEach(a => {
      const tier = classifyLink(a, builder);
      if (tier !== 'no-value') classifications.set(a, tier);
    });

    // Text blocks
    document.querySelectorAll('h1,h2,h3,p').forEach(el => {
      if (classifications.has(el)) return;
      const tier = classifyText(el, builder);
      if (tier !== 'no-value') classifications.set(el, tier);
    });

    return {
      classifications,
      builder,
      headSignals: getHeadSignals(),
      corsIssues: getCorsIssues(),
      stats: buildStats(classifications),
      relatedContentCount: countRelatedContentLinks(),
      elementList: buildElementList(classifications),
    };
  }

  // ── Build element list for panel ───────────────────────────────────────────
  function buildElementList(classifications) {
    const list = { 'pass1-trusted': [], 'pass1-present': [], 'pass2-required': [] };
    for (const [el, tier] of classifications) {
      if (!(tier in list)) continue;
      const isLink = el.tagName === 'A';
      const text = (el.textContent || '').trim().slice(0, 60);
      const href = isLink ? (el.getAttribute('href') || '') : '';
      // Truncate href for display
      const displayHref = href.replace(/^https?:\/\/[^/]+/, '').slice(0, 45) || href.slice(0, 45);
      list[tier].push({
        tag: el.tagName.toLowerCase(),
        text: text || '(no text)',
        href: displayHref,
        isLink,
        isRelatedContent: isLink && isRelatedContentBar(el),
        el, // reference for scroll-to
      });
    }
    // Limit to 30 per tier to keep panel manageable
    for (const tier of Object.keys(list)) {
      list[tier] = list[tier].slice(0, 30);
    }
    return list;
  }

  // ── Overlays ───────────────────────────────────────────────────────────────
  function createOverlay(el, tier) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) return null;

    const div = document.createElement('div');
    div.className = `crawl-heatmap-overlay crawl-tier-${tier}`;
    div.style.cssText = [
      'position:fixed',
      `left:${rect.left}px`,
      `top:${rect.top}px`,
      `width:${rect.width}px`,
      `height:${rect.height}px`,
      'pointer-events:none',
      'z-index:2147483646',
      'box-sizing:border-box',
    ].join(';');

    const tip = document.createElement('div');
    tip.className = 'crawl-heatmap-tip';
    const label = {
      'pass1-trusted': '✓ Pass 1 trusted — Google reads on raw HTML pass',
      'pass1-present': '~ Pass 1 present — inside builder scaffold, deferred trust',
      'pass2-required': '✗ Pass 2 — render queue required before Google trusts',
    }[tier] || tier;

    const tag = el.tagName.toLowerCase();
    const text = (el.textContent || '').trim().slice(0, 60);
    const href = el.tagName === 'A' ? (el.getAttribute('href') || '') : '';
    const isBar = el.tagName === 'A' && isRelatedContentBar(el);

    tip.innerHTML = `
      <div style="font-weight:700;margin-bottom:3px;color:${
        tier === 'pass1-trusted' ? '#22c55e' :
        tier === 'pass1-present' ? '#f59e0b' : '#ef4444'
      }">${label}</div>
      <div style="color:#64748b;font-size:10px">&lt;${tag}&gt; ${text ? `· ${escHtml(text.slice(0,50))}` : ''}</div>
      ${href ? `<div style="color:#475569;font-size:10px;font-family:monospace;margin-top:2px">${escHtml(href.slice(0,60))}</div>` : ''}
      ${isBar ? `<div style="color:#7dd3fc;font-size:10px;margin-top:2px">⚡ Related-content bar link</div>` : ''}
    `;

    div.appendChild(tip);
    document.body.appendChild(div);
    return div;
  }

  function renderOverlays(classifications) {
    clearOverlays();
    for (const [el, tier] of classifications) {
      const ov = createOverlay(el, tier);
      if (ov) overlays.push(ov);
    }
  }

  function clearOverlays() {
    overlays.forEach(o => o.remove());
    overlays = [];
  }

  // ── Panel ──────────────────────────────────────────────────────────────────
  function renderPanel(data) {
    if (panel) panel.remove();

    const { stats, builder, headSignals, corsIssues, relatedContentCount, elementList } = data;
    const { counts, total, score } = stats;
    const scoreColour = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';

    const tierConfig = [
      { key: 'pass1-trusted', label: 'Pass 1 trusted',            dot: 'green', icon: '✓' },
      { key: 'pass1-present', label: 'Pass 1 — builder scaffold',  dot: 'amber', icon: '~' },
      { key: 'pass2-required', label: 'Pass 2 — render queue',     dot: 'red',   icon: '✗' },
    ];

    const renderList = (tier, items) => {
      if (!items.length) return '<div class="chp-list-empty">No elements in this tier</div>';
      return items.map((item, i) => `
        <div class="chp-list-item" data-tier="${tier}" data-idx="${i}">
          <span class="chp-list-tag">${item.tag}</span>
          <div class="chp-list-content">
            <div class="chp-list-text">${escHtml(item.text)}</div>
            ${item.href ? `<div class="chp-list-href">${escHtml(item.href)}</div>` : ''}
          </div>
          ${item.isRelatedContent ? '<span class="chp-list-bar">⚡</span>' : ''}
          <button class="chp-list-scroll" data-tier="${tier}" data-idx="${i}" title="Scroll to element">↗</button>
        </div>
      `).join('');
    };

    panel = document.createElement('div');
    panel.id = 'crawl-heatmap-panel';
    panel.innerHTML = `
      <div class="chp-header">
        <div class="chp-title"><span>🕷</span> Crawl Heatmap</div>
        <button class="chp-close" id="chp-close">✕</button>
      </div>

      <div class="chp-score-row">
        <div class="chp-score" style="color:${scoreColour}">${score}%</div>
        <div class="chp-score-label">
          Pass 1 coverage <span style="color:#475569">(scaffold = half credit)</span>
          <small>${total} elements · ${counts['pass1-trusted']} trusted · ${counts['pass1-present']} scaffold · ${counts['pass2-required']} render</small>
        </div>
      </div>

      <div class="chp-badges">
        ${builder
          ? `<span class="chp-badge chp-badge-builder">⚙ ${builder.name}</span>`
          : `<span class="chp-badge chp-badge-clean">✓ No page builder</span>`}
        ${relatedContentCount > 0
          ? `<span class="chp-badge chp-badge-bar">⚡ Related-content bar · ${relatedContentCount} links (pass 1)</span>`
          : ''}
        ${corsIssues.length > 0
          ? `<span class="chp-badge chp-badge-cors">⚠ ${corsIssues.length} CORS issue${corsIssues.length > 1 ? 's' : ''}</span>`
          : ''}
      </div>

      <div class="chp-legend">
        ${tierConfig.map(t => `
          <div class="chp-legend-item chp-legend-toggle" data-tier="${t.key}">
            <span class="chp-dot chp-dot-${t.dot}"></span>
            <span class="chp-legend-label">${t.label}</span>
            <span class="chp-legend-count">${counts[t.key]}</span>
            <span class="chp-legend-chevron" id="chev-${t.key}">▸</span>
          </div>
          <div class="chp-list" id="list-${t.key}" style="display:none">
            ${renderList(t.key, elementList[t.key])}
            ${counts[t.key] > 30 ? `<div class="chp-list-more">+${counts[t.key] - 30} more not shown</div>` : ''}
          </div>
        `).join('')}
      </div>

      ${headSignals.length > 0 ? `
        <div class="chp-section">
          <div class="chp-section-title">Head signals (pass 1)</div>
          ${headSignals.map(s => `
            <div class="chp-signal-row">
              <span class="chp-signal-type">${s.type}</span>
              <span class="chp-signal-val">${escHtml(s.value)}</span>
            </div>`).join('')}
        </div>` : ''}

      ${corsIssues.length > 0 ? `
        <div class="chp-section chp-section-cors">
          <div class="chp-section-title">CORS / cross-domain issues</div>
          ${corsIssues.map(c => `
            <div class="chp-signal-row">
              <span class="chp-signal-type">${c.type}</span>
              <span class="chp-signal-val chp-val-url">${escHtml(c.url.replace(/^https?:\/\//, '').slice(0, 55))}</span>
            </div>`).join('')}
        </div>` : ''}

      <div class="chp-footer">
        <button class="chp-btn chp-btn-toggle" id="chp-toggle">Hide overlay</button>
        <button class="chp-btn chp-btn-rescan" id="chp-rescan">Rescan</button>
      </div>
    `;

    document.body.appendChild(panel);

    // Close
    document.getElementById('chp-close').addEventListener('click', deactivate);

    // Rescan
    document.getElementById('chp-rescan').addEventListener('click', activate);

    // Toggle overlay
    let visible = true;
    document.getElementById('chp-toggle').addEventListener('click', function () {
      visible = !visible;
      overlays.forEach(o => o.style.display = visible ? '' : 'none');
      this.textContent = visible ? 'Hide overlay' : 'Show overlay';
    });

    // Expand/collapse tier lists
    panel.querySelectorAll('.chp-legend-toggle').forEach(row => {
      row.addEventListener('click', () => {
        const tier = row.dataset.tier;
        const list = document.getElementById(`list-${tier}`);
        const chev = document.getElementById(`chev-${tier}`);
        const open = list.style.display === 'none';
        list.style.display = open ? 'block' : 'none';
        chev.textContent = open ? '▾' : '▸';
      });
    });

    // Scroll-to buttons — store element refs on panel for lookup
    panel._elementList = elementList;
    panel.querySelectorAll('.chp-list-scroll').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tier = btn.dataset.tier;
        const idx = parseInt(btn.dataset.idx);
        const item = panel._elementList[tier]?.[idx];
        if (item?.el) {
          item.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Flash the element briefly
          item.el.style.outline = '3px solid #06b6d4';
          setTimeout(() => { item.el.style.outline = ''; }, 1500);
        }
      });
    });
  }

  // ── Activate / deactivate ──────────────────────────────────────────────────
  function activate() {
    active = true;
    clearOverlays();
    if (panel) panel.remove();

    // Wait for full DOM settle — Elementor and other builders mutate DOM
    // after DOMContentLoaded, so we give it a tick then scan
    const delay = document.readyState === 'complete' ? 300 : 800;
    setTimeout(() => {
      const data = runScan();
      renderOverlays(data.classifications);
      renderPanel(data);
    }, delay);
  }

  function deactivate() {
    active = false;
    clearOverlays();
    if (panel) { panel.remove(); panel = null; }
  }

  // ── Reposition on scroll/resize ────────────────────────────────────────────
  let rafPending = false;
  function reposition() {
    if (!active || rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      const data = runScan();
      renderOverlays(data.classifications);
      // Update panel counts without rebuilding (avoids flicker)
    });
  }
  window.addEventListener('scroll', reposition, { passive: true });
  window.addEventListener('resize', reposition, { passive: true });

  // ── Message listener ───────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'toggle') {
      active ? deactivate() : activate();
    }
    if (msg.action === 'setCustomBarSelector') {
      customBarSelector = msg.selector || '';
      if (active) activate(); // rescan with new selector
    }
  });

  // Load any saved custom selector on script load
  chrome.storage.local.get(['customBarSelector'], (result) => {
    customBarSelector = result.customBarSelector || '';
  });

})();
