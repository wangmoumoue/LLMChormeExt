(function () {
  'use strict';

  if (window.__llambPageAnalyzerLoaded) {
    return;
  }
  window.__llambPageAnalyzerLoaded = true;

  const ROOT_ID = 'llamb-analysis-root';
  const DEFAULT_LABEL = 'LLaMb page notes';
  const ANCHOR_ATTR = 'data-llamb-anchor-id';
  const SLOT_ID = 'llamb-analysis-slot';
  let rootObserver = null;
  let cachedPageProfile = null;

  function normalizeWhitespace(text) {
    return String(text || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function truncateText(text, maxLength) {
    const normalized = normalizeWhitespace(text);
    return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
  }

  function getSelectedText() {
    return window.getSelection?.().toString().trim() || '';
  }

  function extractPageContent() {
    const preferredRoot =
      document.querySelector('main') ||
      document.querySelector('article') ||
      document.querySelector('[role="main"]') ||
      document.body;

    if (!preferredRoot) {
      return '';
    }

    const text = normalizeWhitespace(preferredRoot.innerText || '');
    return text.length > 12000 ? `${text.slice(0, 12000)}...` : text;
  }

  function findPrimaryContainer() {
    const candidates = [
      document.querySelector('article'),
      document.querySelector('main'),
      document.querySelector('[role="main"]'),
      document.querySelector('.post-content'),
      document.querySelector('.article-content'),
      document.querySelector('.entry-content'),
      document.querySelector('.content'),
      document.body
    ];

    return candidates.find(Boolean) || document.body;
  }

  function getNodeDepth(node) {
    let depth = 0;
    let current = node;
    while (current?.parentElement) {
      depth += 1;
      current = current.parentElement;
    }
    return depth;
  }

  function isLikelyFeedItem(element) {
    if (!(element instanceof Element)) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width < 120 || rect.height < 80) {
      return false;
    }

    const text = normalizeWhitespace(element.textContent || '');
    const mediaCount = element.querySelectorAll('img, video, canvas, picture').length;
    const linkCount = element.querySelectorAll('a').length;
    const headingCount = element.querySelectorAll('h1, h2, h3, h4').length;

    return text.length > 16 && mediaCount > 0 && linkCount > 0 && headingCount <= 2;
  }

  function detectDynamicFeed(primaryContainer) {
    const repeatedParents = new Map();
    const candidates = Array.from(
      primaryContainer.querySelectorAll('section, div, ul, ol')
    );

    candidates.forEach((candidate) => {
      const childElements = Array.from(candidate.children);
      if (childElements.length < 6) {
        return;
      }

      const feedLikeChildren = childElements.filter(isLikelyFeedItem);
      if (feedLikeChildren.length < 5) {
        return;
      }

      const score = feedLikeChildren.length * 10 - getNodeDepth(candidate);
      repeatedParents.set(candidate, score);
    });

    const sorted = Array.from(repeatedParents.entries()).sort((a, b) => b[1] - a[1]);
    const feedContainer = sorted[0]?.[0] || null;
    if (!feedContainer) {
      return {
        isDynamicFeed: false,
        feedContainer: null,
        stableContainer: primaryContainer
      };
    }

    const stableContainer =
      feedContainer.previousElementSibling?.parentElement ||
      feedContainer.parentElement ||
      primaryContainer;

    return {
      isDynamicFeed: true,
      feedContainer,
      stableContainer
    };
  }

  function getPageProfile() {
    const primaryContainer = findPrimaryContainer();
    const dynamicFeed = detectDynamicFeed(primaryContainer);
    const stableContainer = dynamicFeed.isDynamicFeed
      ? dynamicFeed.stableContainer || primaryContainer
      : primaryContainer;

    cachedPageProfile = {
      primaryContainer,
      stableContainer,
      feedContainer: dynamicFeed.feedContainer,
      isDynamicFeed: dynamicFeed.isDynamicFeed
    };

    return cachedPageProfile;
  }

  function pickFirstVisible(elements) {
    return elements.find((element) => {
      if (!(element instanceof Element)) {
        return false;
      }
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }) || null;
  }

  function getStyleProfile(container) {
    const baseElement = container || document.body || document.documentElement;
    const headingElement = pickFirstVisible([
      container?.querySelector('h1'),
      container?.querySelector('h2'),
      document.querySelector('h1'),
      document.querySelector('h2')
    ]);
    const paragraphElement = pickFirstVisible([
      container?.querySelector('p'),
      container?.querySelector('li'),
      document.querySelector('main p'),
      document.querySelector('article p'),
      document.querySelector('p')
    ]);
    const actionElement = pickFirstVisible([
      container?.querySelector('button'),
      container?.querySelector('[role="button"]'),
      container?.querySelector('a'),
      document.querySelector('button'),
      document.querySelector('a')
    ]);

    const baseStyles = window.getComputedStyle(baseElement);
    const headingStyles = window.getComputedStyle(headingElement || baseElement);
    const paragraphStyles = window.getComputedStyle(paragraphElement || baseElement);
    const actionStyles = window.getComputedStyle(actionElement || baseElement);
    const rootStyles = window.getComputedStyle(document.documentElement);

    return {
      fontFamily: paragraphStyles.fontFamily || baseStyles.fontFamily || rootStyles.fontFamily,
      textColor: paragraphStyles.color || baseStyles.color || '#222222',
      mutedColor: baseStyles.color || paragraphStyles.color || '#555555',
      headingColor: headingStyles.color || paragraphStyles.color || '#111111',
      accentColor: actionStyles.color || headingStyles.color || paragraphStyles.color || '#1a73e8',
      backgroundColor: baseStyles.backgroundColor || 'transparent',
      surfaceColor: rootStyles.backgroundColor && rootStyles.backgroundColor !== 'rgba(0, 0, 0, 0)'
        ? rootStyles.backgroundColor
        : '#ffffff',
      borderColor: actionStyles.borderColor && actionStyles.borderColor !== 'rgba(0, 0, 0, 0)'
        ? actionStyles.borderColor
        : 'rgba(0, 0, 0, 0.16)',
      radius: actionStyles.borderRadius && actionStyles.borderRadius !== '0px'
        ? actionStyles.borderRadius
        : '12px',
      headingSize: headingStyles.fontSize || '1.5rem',
      bodySize: paragraphStyles.fontSize || baseStyles.fontSize || '1rem',
      lineHeight: paragraphStyles.lineHeight || baseStyles.lineHeight || '1.6',
      actionWeight: actionStyles.fontWeight || paragraphStyles.fontWeight || '600'
    };
  }

  function applyStyleProfile(root, profile) {
    root.style.setProperty('--llamb-font-family', profile.fontFamily);
    root.style.setProperty('--llamb-text-color', profile.textColor);
    root.style.setProperty('--llamb-muted-color', profile.mutedColor);
    root.style.setProperty('--llamb-heading-color', profile.headingColor);
    root.style.setProperty('--llamb-accent-color', profile.accentColor);
    root.style.setProperty('--llamb-background-color', profile.backgroundColor);
    root.style.setProperty('--llamb-surface-color', profile.surfaceColor);
    root.style.setProperty('--llamb-border-color', profile.borderColor);
    root.style.setProperty('--llamb-radius', profile.radius);
    root.style.setProperty('--llamb-heading-size', profile.headingSize);
    root.style.setProperty('--llamb-body-size', profile.bodySize);
    root.style.setProperty('--llamb-line-height', profile.lineHeight);
    root.style.setProperty('--llamb-action-weight', profile.actionWeight);
  }

  function describePlacement(anchorSpec) {
    if (!anchorSpec) {
      return 'Placed into the current page flow';
    }

    if (typeof anchorSpec === 'string') {
      return `Placed ${anchorSpec}`;
    }

    if (anchorSpec.label) {
      return `Placed ${anchorSpec.label}`;
    }

    if (anchorSpec.anchorId) {
      return `Placed near ${anchorSpec.anchorId}`;
    }

    return 'Placed into the page flow';
  }

  function isGoodAnchorCandidate(element, primaryContainer) {
    if (!(element instanceof Element) || element.id === ROOT_ID || element.closest(`#${ROOT_ID}`)) {
      return false;
    }

    if (!primaryContainer.contains(element)) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    const text = normalizeWhitespace(element.textContent || '');
    if (rect.width < 120 || rect.height < 18) {
      return false;
    }

    return text.length >= 20;
  }

  function detectAnchorRole(element) {
    const tag = element.tagName.toLowerCase();
    if (tag === 'h1') return 'title';
    if (tag === 'h2' || tag === 'h3') return 'section-heading';
    if (tag === 'p') return 'paragraph';
    if (tag === 'ul' || tag === 'ol') return 'list';
    if (tag === 'aside') return 'aside';
    if (tag === 'figure' || tag === 'img') return 'media';
    if (tag === 'section') return 'section';
    return 'block';
  }

  function collectAnchors(primaryContainer) {
    const selector = ':scope > h1, :scope > h2, :scope > h3, :scope > p, :scope > section, :scope > div, :scope > ul, :scope > ol, :scope > aside, :scope > figure';
    const children = Array.from(primaryContainer.querySelectorAll(selector)).filter((element) =>
      isGoodAnchorCandidate(element, primaryContainer)
    );
    const anchors = [];

    children.slice(0, 18).forEach((element, index) => {
      const anchorId = `anchor-${index + 1}`;
      element.setAttribute(ANCHOR_ATTR, anchorId);
      anchors.push({
        anchorId,
        role: detectAnchorRole(element),
        tagName: element.tagName.toLowerCase(),
        label: truncateText(element.textContent || '', 100)
      });
    });

    return anchors;
  }

  function buildPageSignals(primaryContainer) {
    const styleProfile = getStyleProfile(primaryContainer);
    const anchors = collectAnchors(primaryContainer);
    const pageProfile = cachedPageProfile || getPageProfile();
    return {
      hostStyle: styleProfile,
      behavior: {
        pageType: pageProfile.isDynamicFeed ? 'dynamic-feed' : 'static-document',
        avoidZones: pageProfile.isDynamicFeed ? ['feed-stream', 'visual-bottom'] : ['visual-bottom'],
        placementPolicy: pageProfile.isDynamicFeed ? 'stable-anchor-only' : 'flow-or-anchor'
      },
      structure: {
        primaryTag: primaryContainer?.tagName?.toLowerCase() || 'body',
        anchorCount: anchors.length,
        anchors
      }
    };
  }

  async function getPageContext() {
    const pageProfile = getPageProfile();
    const primaryContainer = pageProfile.stableContainer;
    return {
      url: window.location.href,
      title: document.title || 'Untitled Page',
      selectedText: getSelectedText(),
      markdownContent: extractPageContent(),
      pageSignals: buildPageSignals(primaryContainer),
      timestamp: new Date().toISOString()
    };
  }

  function normalizePlacementSpec(placement) {
    const pageProfile = cachedPageProfile || getPageProfile();
    if (!placement) {
      return {
        mode: pageProfile.isDynamicFeed ? 'anchor' : 'flow',
        position: 'top'
      };
    }

    if (typeof placement === 'string') {
      return {
        mode: pageProfile.isDynamicFeed ? 'anchor' : 'flow',
        position: 'top'
      };
    }

    const normalizedPosition = String(placement.position || placement.preference || 'top').toLowerCase();
    const normalizedMode = String(placement.mode || 'flow').toLowerCase();
    return {
      mode: pageProfile.isDynamicFeed && normalizedMode === 'flow' ? 'anchor' : normalizedMode,
      position: normalizedPosition === 'bottom' || normalizedPosition === 'end' ? 'middle' : normalizedPosition,
      anchorId: placement.anchorId || placement.anchor || '',
      label: placement.label || '',
      strategy: placement.strategy || ''
    };
  }

  function findTopInsertionPoint(container) {
    if (!container) {
      return { parent: document.body, before: document.body.firstChild };
    }

    const preferredChild = container.querySelector(':scope > h1, :scope > header, :scope > .header, :scope > p, :scope > section, :scope > div');
    if (preferredChild) {
      return { parent: container, before: preferredChild };
    }

    return { parent: container, before: container.firstChild };
  }

  function resolveAnchorTarget(primaryContainer, placementSpec) {
    const anchorId = String(placementSpec.anchorId || '').trim();
    if (anchorId) {
      const anchorNode = primaryContainer.querySelector(`[${ANCHOR_ATTR}="${anchorId}"]`);
      if (anchorNode) {
        return anchorNode;
      }
    }

    const blocks = Array.from(primaryContainer.querySelectorAll(`[${ANCHOR_ATTR}]`));
    if (blocks.length === 0) {
      return null;
    }

    if (placementSpec.position === 'middle' || placementSpec.position === 'center') {
      return blocks[Math.floor(blocks.length / 2)];
    }

    if (placementSpec.position === 'bottom' || placementSpec.position === 'end') {
      return blocks[blocks.length - 1];
    }

    return blocks[0];
  }

  function getSlot() {
    return document.getElementById(SLOT_ID);
  }

  function ensureSlot(root, placementSpec) {
    let slot = getSlot();
    if (slot) {
      return slot;
    }

    slot = document.createElement('div');
    slot.id = SLOT_ID;
    slot.setAttribute('aria-hidden', 'true');
    slot.style.display = 'block';
    slot.style.width = '100%';
    slot.style.height = '0';
    slot.style.margin = '0';
    slot.style.padding = '0';
    slot.style.border = '0';

    const pageProfile = cachedPageProfile || getPageProfile();
    const primaryContainer = pageProfile.stableContainer || findPrimaryContainer();
    if (placementSpec.mode === 'anchor') {
      const target = resolveAnchorTarget(primaryContainer, placementSpec);
      if (target?.parentNode) {
        if (placementSpec.position === 'before') {
          target.parentNode.insertBefore(slot, target);
        } else {
          target.insertAdjacentElement('afterend', slot);
        }
        return slot;
      }
    }

    if (placementSpec.position === 'bottom' || placementSpec.position === 'end') {
      primaryContainer.appendChild(slot);
      return slot;
    }

    if (placementSpec.position === 'middle' || placementSpec.position === 'center') {
      const target = resolveAnchorTarget(primaryContainer, placementSpec);
      if (target?.parentNode) {
        target.insertAdjacentElement('afterend', slot);
        return slot;
      }
    }

    const insertion = findTopInsertionPoint(primaryContainer);
    insertion.parent.insertBefore(slot, insertion.before || null);
    return slot;
  }

  function keepRootAtSlot(root) {
    const slot = getSlot();
    if (!slot?.parentNode) {
      return;
    }

    if (slot.nextSibling !== root) {
      slot.insertAdjacentElement('afterend', root);
    }
  }

  function cleanupMountedState() {
    const slot = getSlot();
    if (slot) {
      slot.remove();
    }
    if (rootObserver) {
      rootObserver.disconnect();
      rootObserver = null;
    }
  }

  function observeRootPosition(root) {
    if (rootObserver) {
      return;
    }

    rootObserver = new MutationObserver(() => {
      keepRootAtSlot(root);
    });

    rootObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function ensureRoot(renderHints = {}, placementSpec = { mode: 'flow', position: 'top' }) {
    let root = document.getElementById(ROOT_ID);
    const pageProfile = cachedPageProfile || getPageProfile();
    const primaryContainer = pageProfile.stableContainer || findPrimaryContainer();
    const styleProfile = getStyleProfile(primaryContainer);

    if (root) {
      applyStyleProfile(root, styleProfile);
      root.dataset.layout = renderHints.layout || 'grid';
      root.dataset.chrome = renderHints.chrome || 'blend';
      root.dataset.emphasis = renderHints.emphasis || 'medium';
      const subtitle = root.querySelector('.llamb-analysis-subtitle');
      if (subtitle) {
        subtitle.textContent = describePlacement(placementSpec);
      }
      return root;
    }

    root = document.createElement('section');
    root.id = ROOT_ID;
    root.setAttribute('aria-label', DEFAULT_LABEL);
    root.dataset.layout = renderHints.layout || 'grid';
    root.dataset.chrome = renderHints.chrome || 'blend';
    root.dataset.emphasis = renderHints.emphasis || 'medium';
    applyStyleProfile(root, styleProfile);
    root.innerHTML = `
      <div class="llamb-analysis-shell">
        <div class="llamb-analysis-header">
          <div>
            <div class="llamb-analysis-eyebrow">LLaMb</div>
            <div class="llamb-analysis-title">${DEFAULT_LABEL}</div>
            <div class="llamb-analysis-subtitle">${escapeHtml(describePlacement(placementSpec))}</div>
          </div>
          <div class="llamb-analysis-actions">
            <button class="llamb-analysis-btn" type="button" data-action="clear" aria-label="Clear current notes">Clear</button>
            <button class="llamb-analysis-btn" type="button" data-action="close" aria-label="Hide current notes">Hide</button>
          </div>
        </div>
        <div class="llamb-analysis-meta" id="llamb-analysis-meta"></div>
        <div class="llamb-analysis-grid" id="llamb-analysis-grid"></div>
      </div>
    `;

    root.addEventListener('click', (event) => {
      const action = event.target?.dataset?.action;
      if (action === 'close') {
        cleanupMountedState();
        root.remove();
      }
      if (action === 'clear') {
        const grid = root.querySelector('#llamb-analysis-grid');
        const meta = root.querySelector('#llamb-analysis-meta');
        if (grid) {
          grid.innerHTML = '';
        }
        if (meta) {
          meta.textContent = '';
        }
      }
    });

    mountRoot(root, placementSpec, { preserveExisting: false });
    observeRootPosition(root);
    return root;
  }

  function mountRoot(root, placementSpecInput, options = {}) {
    const { preserveExisting = true } = options;
    const placementSpec = normalizePlacementSpec(placementSpecInput);
    const pageProfile = cachedPageProfile || getPageProfile();
    const primaryContainer = pageProfile.stableContainer || findPrimaryContainer();
    applyStyleProfile(root, getStyleProfile(primaryContainer));

    if (preserveExisting && root.isConnected) {
      return;
    }

    ensureSlot(root, placementSpec);
    keepRootAtSlot(root);
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatTextContent(text) {
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  function normalizeRenderHints(renderHints) {
    const hints = renderHints && typeof renderHints === 'object' ? renderHints : {};
    return {
      layout: ['grid', 'inline', 'stack', 'minimal'].includes(hints.layout) ? hints.layout : 'grid',
      chrome: ['blend', 'bordered', 'ghost', 'callout'].includes(hints.chrome) ? hints.chrome : 'blend',
      emphasis: ['low', 'medium', 'high'].includes(hints.emphasis) ? hints.emphasis : 'medium',
      tone: truncateText(hints.tone || '', 80)
    };
  }

  function applyRenderHints(root, renderHints) {
    root.dataset.layout = renderHints.layout;
    root.dataset.chrome = renderHints.chrome;
    root.dataset.emphasis = renderHints.emphasis;

    const titleNode = root.querySelector('.llamb-analysis-title');
    if (titleNode && renderHints.tone) {
      titleNode.textContent = renderHints.tone;
    } else if (titleNode) {
      titleNode.textContent = DEFAULT_LABEL;
    }
  }

  function renderAnalysisCards(cards, meta = {}, placement = 'top', renderHints = {}) {
    const placementSpec = normalizePlacementSpec(placement);
    const normalizedHints = normalizeRenderHints(renderHints);
    const root = ensureRoot(normalizedHints, placementSpec);
    const grid = root.querySelector('#llamb-analysis-grid');
    const metaNode = root.querySelector('#llamb-analysis-meta');

    applyRenderHints(root, normalizedHints);
    mountRoot(root, placementSpec, { preserveExisting: true });

    grid.innerHTML = '';
    metaNode.textContent = Object.keys(meta).length > 0
      ? Object.entries(meta).map(([key, value]) => `${key}: ${value}`).join(' | ')
      : '';

    if (!Array.isArray(cards) || cards.length === 0) {
      grid.innerHTML = `
        <article class="llamb-analysis-card">
          <h3>No Cards Returned</h3>
          <div class="llamb-analysis-card-content">The analyzer finished, but no cards were returned.</div>
        </article>
      `;
    } else {
      cards.forEach((card, index) => {
        const element = document.createElement('article');
        element.className = 'llamb-analysis-card';

        const badge = card.type
          ? `<span class="llamb-analysis-badge">${escapeHtml(card.type)}</span>`
          : '';

        const content = typeof card.content === 'string'
          ? formatTextContent(card.content)
          : `<pre>${escapeHtml(JSON.stringify(card.content ?? card, null, 2))}</pre>`;

        const items = Array.isArray(card.items) && card.items.length > 0
          ? `<ul class="llamb-analysis-list">${card.items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
          : '';

        element.innerHTML = `
          <div class="llamb-analysis-card-header">
            <h3>${escapeHtml(card.title || `Card ${index + 1}`)}</h3>
            ${badge}
          </div>
          <div class="llamb-analysis-card-content">${content}</div>
          ${items}
        `;

        grid.appendChild(element);
      });
    }

    root.scrollIntoView({
      behavior: 'smooth',
      block: placementSpec.position === 'bottom' ? 'end' : 'center'
    });
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ping') {
      sendResponse({ success: true });
      return false;
    }

    if (request.action === 'getPageContext') {
      getPageContext()
        .then((context) => sendResponse(context))
        .catch((error) => sendResponse({ error: error.message }));
      return true;
    }

    if (request.action === 'renderAnalysisCards') {
      renderAnalysisCards(
        request.cards,
        request.meta || {},
        request.placement || 'top',
        request.renderHints || {}
      );
      sendResponse({
        success: true,
        cardCount: Array.isArray(request.cards) ? request.cards.length : 0
      });
      return false;
    }

    sendResponse({ success: false, error: 'Unknown action' });
    return false;
  });
})();
