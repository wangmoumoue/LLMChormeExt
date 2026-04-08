(function () {
  'use strict';

  if (window.__llambPageAnalyzerLoaded) {
    return;
  }
  window.__llambPageAnalyzerLoaded = true;
  const runtime = globalThis.__LLAMB_CONTENT__;

  const ROOT_ID = 'llamb-analysis-root';
  const DEFAULT_LABEL = 'LLaMb page notes';
  const ANCHOR_ATTR = 'data-llamb-anchor-id';
  const SLOT_ID = 'llamb-analysis-slot';
  const PAGE_TYPES = runtime.constants.PAGE_TYPES;
  const PAGE_TYPE_KEYWORDS = runtime.constants.PAGE_TYPE_KEYWORDS;
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

  function ensureAnchorId(element) {
    if (!(element instanceof Element)) {
      return '';
    }

    const existing = element.getAttribute(ANCHOR_ATTR);
    if (existing) {
      return existing;
    }

    const anchorId = `anchor-${Math.random().toString(36).slice(2, 8)}`;
    element.setAttribute(ANCHOR_ATTR, anchorId);
    return anchorId;
  }

  function safeRatio(numerator, denominator) {
    return denominator > 0 ? numerator / denominator : 0;
  }

  function countMatches(text, patterns) {
    return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
  }

  function getLeadSentence(text, maxLength = 140) {
    const normalized = normalizeWhitespace(text);
    if (!normalized) {
      return '';
    }

    const firstSentence = normalized.split(/(?<=[。！？.!?])\s+/)[0] || normalized;
    return truncateText(firstSentence, maxLength);
  }

  function deriveGenericPageProfile(pageContext, domFeatures) {
    const mainContent = normalizeWhitespace(pageContext.mainContent || pageContext.markdownContent || '');
    const lowerUrl = String(pageContext.url || '').toLowerCase();
    const lowerTitle = String(pageContext.title || '').toLowerCase();
    const hasHeroHints = /home|about|landing|index|welcome/.test(`${lowerUrl} ${lowerTitle}`);
    const isSimplePage =
      domFeatures.feedLikelihood < 0.35 &&
      domFeatures.formCount === 0 &&
      domFeatures.videoCount === 0 &&
      domFeatures.tableCount === 0 &&
      domFeatures.cardLikeCount <= 3 &&
      domFeatures.headingCount <= 4 &&
      domFeatures.textLength > 120 &&
      domFeatures.textLength < 5000 &&
      domFeatures.interactiveDensity < 0.18;

    let variant = 'simple-page';
    const reasons = [];

    if (isSimplePage) {
      reasons.push('generic: page structure is simple and stable');
    }
    if (hasHeroHints) {
      variant = 'landing-page';
      reasons.push('generic: landing/home keywords detected');
    } else if (mainContent.length > 900 && domFeatures.headingCount >= 2) {
      variant = 'doc-page';
      reasons.push('generic: text-heavy generic page detected');
    } else if (domFeatures.imageCount >= 1 && domFeatures.headingCount <= 2) {
      variant = 'showcase-page';
      reasons.push('generic: lightweight showcase-style page detected');
    }

    return {
      isSimplePage,
      variant,
      reasons
    };
  }

  function isKnownInfiniteFeedHost(url) {
    const normalized = String(url || '').toLowerCase();
    return /bilibili|youtube|douyin|xiaohongshu|weibo|zhihu/.test(normalized);
  }

  function shouldUseStableFeedPlacement(pageContext, domFeatures) {
    return pageContext?.behaviorSignals?.pageType === 'dynamic-feed' ||
      domFeatures?.feedLikelihood >= 0.75 ||
      isKnownInfiniteFeedHost(pageContext?.url);
  }

  function findStableTopAnchor(pageProfile, primaryContainer) {
    const candidateSelectors = [
      'main > h1',
      'main > section',
      '[role="main"] > h1',
      '[role="main"] > section',
      'main > div',
      '[role="main"] > div'
    ];
    const primaryRect = primaryContainer?.getBoundingClientRect?.();
    const feedRect = pageProfile?.feedContainer?.getBoundingClientRect?.();

    const selectorMatch = candidateSelectors
      .map((selector) => document.querySelector(selector))
      .find((element) => {
        if (!(element instanceof Element)) {
          return false;
        }
        if (pageProfile?.feedContainer?.contains?.(element)) {
          return false;
        }
        const rect = element.getBoundingClientRect();
        return rect.width > 120 && rect.height > 24 && rect.top < window.innerHeight * 0.7;
      });

    if (selectorMatch) {
      return selectorMatch;
    }

    const siblings = Array.from(primaryContainer?.children || []).filter((child) => {
      if (!(child instanceof Element)) {
        return false;
      }
      if (child.id === ROOT_ID || child.id === SLOT_ID) {
        return false;
      }
      if (pageProfile?.feedContainer && child === pageProfile.feedContainer) {
        return false;
      }
      const rect = child.getBoundingClientRect();
      if (rect.width < 120 || rect.height < 24) {
        return false;
      }
      if (feedRect && rect.bottom > feedRect.top + 8) {
        return false;
      }
      if (primaryRect && rect.top > primaryRect.top + Math.max(420, primaryRect.height * 0.4)) {
        return false;
      }
      return true;
    });

    return siblings[0] || null;
  }

  function isElementInPreferredVisualZone(element, maxViewportRatio = 0.72) {
    if (!(element instanceof Element)) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width < 80 || rect.height < 18) {
      return false;
    }

    const safeTop = getTopOverlayMetrics().overlayBottom + 8;
    const maxPreferredBottom = Math.max(window.innerHeight * maxViewportRatio, safeTop + 220);

    return rect.top >= safeTop - 24 && rect.top <= maxPreferredBottom;
  }

  function findVisualSafeAnchor(primaryContainer, pageProfile, maxViewportRatio = 0.72) {
    const candidateSelectors = [
      'main > h1',
      'main > h2',
      '[role="main"] > h1',
      '[role="main"] > h2',
      'article > h1',
      'article > h2',
      'main > p',
      'article > p'
    ];

    const selectorCandidate = candidateSelectors
      .map((selector) => document.querySelector(selector))
      .find((element) => element instanceof Element && isElementInPreferredVisualZone(element, maxViewportRatio));

    if (selectorCandidate) {
      return selectorCandidate;
    }

    const containerChildren = Array.from(primaryContainer?.children || []).find((child) =>
      child instanceof Element &&
      child.id !== ROOT_ID &&
      child.id !== SLOT_ID &&
      child !== pageProfile?.feedContainer &&
      isElementInPreferredVisualZone(child, maxViewportRatio)
    );

    if (containerChildren) {
      return containerChildren;
    }

    return findStableTopAnchor(pageProfile, primaryContainer) || primaryContainer.firstElementChild || primaryContainer;
  }

  function findFormFieldAnchor() {
    const firstField = document.querySelector('form input, form select, form textarea, input, select, textarea');
    if (!(firstField instanceof Element)) {
      return null;
    }

    const fieldWrapper = firstField.closest(
      '[class*="field"], [class*="input"], [class*="form-group"], [class*="group"], [class*="control"], label, div'
    );

    if (fieldWrapper instanceof Element) {
      const rect = fieldWrapper.getBoundingClientRect();
      if (rect.width > 180 && rect.height > 28) {
        return fieldWrapper;
      }
    }

    return firstField;
  }

  function findFormPlacementContext() {
    const fieldAnchor = findFormFieldAnchor();
    if (!(fieldAnchor instanceof Element)) {
      return null;
    }

    const formElement = fieldAnchor.closest('form') || fieldAnchor.closest('[class*="form"], [class*="signup"], [class*="register"], [class*="login"]');
    const scopedRoot = formElement instanceof Element ? formElement.parentElement || formElement : null;
    const titleAnchor = scopedRoot instanceof Element
      ? scopedRoot.querySelector('h1, h2, h3, [class*="title"], [class*="heading"]')
      : null;

    return {
      fieldAnchor,
      formElement: formElement instanceof Element ? formElement : null,
      scopedRoot: scopedRoot instanceof Element ? scopedRoot : null,
      titleAnchor: titleAnchor instanceof Element ? titleAnchor : null
    };
  }

  function stripUnsafeAttributes(element) {
    if (!(element instanceof Element)) {
      return;
    }

    element.removeAttribute('id');
    element.removeAttribute('href');
    element.removeAttribute('src');
    element.removeAttribute('srcset');
    element.removeAttribute('style');
    element.removeAttribute('onclick');
    element.removeAttribute('onmouseenter');
    element.removeAttribute('onmouseleave');
    element.removeAttribute('onmouseover');
    element.removeAttribute('onmouseout');
    element.removeAttribute('onfocus');
    element.removeAttribute('onblur');
  }

  function isCardShellCandidate(element) {
    if (!(element instanceof Element)) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width < 180 || rect.height < 60) {
      return false;
    }

    const signature = `${element.tagName.toLowerCase()} ${element.className || ''}`.toLowerCase();
    return /card|item|module|video|feed|list|cell|panel|article/.test(signature) || isLikelyFeedItem(element);
  }

  function findHostMimicSource(anchorElement) {
    if (!(anchorElement instanceof Element)) {
      return null;
    }

    const ancestor = anchorElement.closest('article, li, [class*="card"], [class*="item"], [class*="module"], [class*="video"], [class*="feed"], [class*="panel"]');
    if (isCardShellCandidate(ancestor)) {
      return ancestor;
    }

    const siblingCandidates = [anchorElement.previousElementSibling, anchorElement.nextElementSibling]
      .filter((node) => isCardShellCandidate(node));

    if (siblingCandidates[0]) {
      return siblingCandidates[0];
    }

    return isCardShellCandidate(anchorElement) ? anchorElement : null;
  }

  function buildHostMimicNode(sourceElement, payload) {
    if (!(sourceElement instanceof Element)) {
      return null;
    }

    const shell = sourceElement.cloneNode(false);
    stripUnsafeAttributes(shell);
    shell.dataset.llambMimicHost = 'true';
    shell.dataset.llambInjection = 'true';

    shell.innerHTML = `
      <div class="llamb-analysis-mimic-body">
        <div class="llamb-analysis-card-header">
          <div class="llamb-analysis-title-wrap">
            ${payload?.icon === 'favicon' ? buildHostIconMarkup() : ''}
            <div class="llamb-analysis-title-block">
              <h3>${escapeHtml(payload?.title || '页面简介')}</h3>
              ${payload?.tone ? `<div class="llamb-analysis-subtitle">${escapeHtml(String(payload.tone))}</div>` : ''}
            </div>
          </div>
          ${payload?.badge ? `<span class="llamb-analysis-badge">${escapeHtml(payload.badge)}</span>` : ''}
        </div>
        <div class="llamb-analysis-card-content">${formatTextContent(payload?.body || '当前没有可显示的页面简介。')}</div>
      </div>
    `;

    return shell;
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

  function isTopOverlayCandidate(element) {
    if (!(element instanceof Element) || element.id === ROOT_ID || element.id === SLOT_ID) {
      return false;
    }

    const styles = window.getComputedStyle(element);
    if (!['fixed', 'sticky'].includes(styles.position)) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width < Math.min(window.innerWidth * 0.35, 320) || rect.height < 28) {
      return false;
    }

    if (rect.top > 24 || rect.bottom < 24) {
      return false;
    }

    if (styles.visibility === 'hidden' || styles.display === 'none' || Number(styles.opacity) === 0) {
      return false;
    }

    return true;
  }

  function getTopOverlayMetrics() {
    const elements = Array.from(document.body.querySelectorAll('*')).filter(isTopOverlayCandidate);
    const overlays = elements
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .sort((a, b) => a.rect.bottom - b.rect.bottom);

    const bottom = overlays.reduce((maxBottom, item) => Math.max(maxBottom, item.rect.bottom), 0);

    return {
      overlays: overlays.map((item) => item.element),
      overlayBottom: bottom
    };
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
    const panelElement = pickFirstVisible([
      container?.querySelector('section'),
      container?.querySelector('aside'),
      container?.querySelector('div'),
      document.querySelector('section'),
      document.querySelector('aside'),
      document.querySelector('div')
    ]);
    const panelStyles = window.getComputedStyle(panelElement || baseElement);

    return {
      fontFamily: paragraphStyles.fontFamily || baseStyles.fontFamily || rootStyles.fontFamily,
      textColor: paragraphStyles.color || baseStyles.color || '#222222',
      mutedColor: baseStyles.color || paragraphStyles.color || '#555555',
      headingColor: headingStyles.color || paragraphStyles.color || '#111111',
      accentColor: actionStyles.color || headingStyles.color || paragraphStyles.color || '#1a73e8',
      backgroundColor: baseStyles.backgroundColor || 'transparent',
      surfaceColor: panelStyles.backgroundColor && panelStyles.backgroundColor !== 'rgba(0, 0, 0, 0)'
        ? panelStyles.backgroundColor
        : rootStyles.backgroundColor && rootStyles.backgroundColor !== 'rgba(0, 0, 0, 0)'
          ? rootStyles.backgroundColor
          : '#ffffff',
      borderColor: panelStyles.borderColor && panelStyles.borderColor !== 'rgba(0, 0, 0, 0)'
        ? panelStyles.borderColor
        : actionStyles.borderColor && actionStyles.borderColor !== 'rgba(0, 0, 0, 0)'
          ? actionStyles.borderColor
          : 'rgba(0, 0, 0, 0.16)',
      softAccentColor: actionStyles.backgroundColor && actionStyles.backgroundColor !== 'rgba(0, 0, 0, 0)'
        ? actionStyles.backgroundColor
        : 'rgba(0, 0, 0, 0.16)',
      radius: panelStyles.borderRadius && panelStyles.borderRadius !== '0px'
        ? panelStyles.borderRadius
        : actionStyles.borderRadius && actionStyles.borderRadius !== '0px'
          ? actionStyles.borderRadius
          : '12px',
      shadow: panelStyles.boxShadow && panelStyles.boxShadow !== 'none'
        ? panelStyles.boxShadow
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
    root.style.setProperty('--llamb-soft-accent-color', profile.softAccentColor);
    root.style.setProperty('--llamb-radius', profile.radius);
    root.style.setProperty('--llamb-shadow', profile.shadow);
    root.style.setProperty('--llamb-heading-size', profile.headingSize);
    root.style.setProperty('--llamb-body-size', profile.bodySize);
    root.style.setProperty('--llamb-line-height', profile.lineHeight);
    root.style.setProperty('--llamb-action-weight', profile.actionWeight);
  }

  function getFaviconUrl() {
    const iconSelectors = [
      'link[rel="icon"]',
      'link[rel="shortcut icon"]',
      'link[rel="apple-touch-icon"]',
      'link[rel*="icon"]'
    ];

    for (const selector of iconSelectors) {
      const link = document.querySelector(selector);
      const href = link?.getAttribute('href');
      if (!href) {
        continue;
      }

      try {
        return new URL(href, window.location.href).href;
      } catch {
        continue;
      }
    }

    try {
      return new URL('/favicon.ico', window.location.origin).href;
    } catch {
      return '';
    }
  }

  function buildHostIconMarkup() {
    const faviconUrl = getFaviconUrl();
    if (!faviconUrl) {
      return '';
    }

    return `<span class="llamb-analysis-host-icon" aria-hidden="true"><img src="${escapeHtml(faviconUrl)}" alt=""></span>`;
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
    const overlayMetrics = getTopOverlayMetrics();
    return {
      hostStyle: styleProfile,
      behavior: {
        pageType: pageProfile.isDynamicFeed ? 'dynamic-feed' : 'static-document',
        avoidZones: pageProfile.isDynamicFeed ? ['feed-stream', 'visual-bottom'] : ['visual-bottom'],
        placementPolicy: pageProfile.isDynamicFeed ? 'middle-gap-or-stable-anchor' : 'flow-or-anchor',
        preferredPlacement: pageProfile.isDynamicFeed ? 'middle' : 'top',
        hasFloatingHeader: overlayMetrics.overlayBottom > 0,
        topOverlayHeight: Math.round(overlayMetrics.overlayBottom)
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
    const pageSignals = buildPageSignals(primaryContainer);
    const mainContent = extractPageContent();
    return {
      url: window.location.href,
      title: document.title || 'Untitled Page',
      selectedText: getSelectedText(),
      mainContent,
      markdownContent: mainContent,
      anchors: pageSignals.structure.anchors,
      styleSignals: pageSignals.hostStyle,
      behaviorSignals: pageSignals.behavior,
      pageSignals,
      timestamp: new Date().toISOString()
    };
  }

  function extractDomFeatures() {
    const pageProfile = cachedPageProfile || getPageProfile();
    const primaryContainer = pageProfile.stableContainer || findPrimaryContainer();
    const root = primaryContainer || document.body;
    const text = normalizeWhitespace(root.innerText || '');
    const textLength = text.length;
    const allElements = root.querySelectorAll('*').length || 1;
    const forms = Array.from(root.querySelectorAll('form'));
    const inputs = root.querySelectorAll('input, select, textarea');
    const buttons = root.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"]');
    const links = root.querySelectorAll('a[href]');
    const headings = root.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const images = root.querySelectorAll('img, picture svg, figure img');
    const videos = root.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="bilibili"], [class*="player"], [id*="player"]');
    const tables = root.querySelectorAll('table, [role="table"], [class*="table"]');
    const cards = Array.from(root.querySelectorAll('article, li, [class*="card"], [class*="item"], [class*="tile"], [data-testid*="card"]'))
      .filter((element) => isLikelyFeedItem(element) || normalizeWhitespace(element.textContent || '').length > 30);
    const lists = root.querySelectorAll('ul, ol, [role="list"], [class*="list"], [class*="feed"]');
    const sidebars = root.querySelectorAll('aside, nav, [role="complementary"], [class*="sidebar"], [class*="sider"]');
    const interactiveCount = inputs.length + buttons.length + links.length;
    const lowerText = `${window.location.href} ${document.title} ${text.slice(0, 3000)}`.toLowerCase();

    return {
      formCount: forms.length,
      inputCount: inputs.length,
      buttonCount: buttons.length,
      linkCount: links.length,
      headingCount: headings.length,
      imageCount: images.length,
      videoCount: videos.length,
      tableCount: tables.length,
      cardLikeCount: cards.length,
      listLikeCount: lists.length,
      sidebarExists: sidebars.length > 0,
      hasSearchBox: Boolean(root.querySelector('input[type="search"], [role="search"], form[action*="search"]')),
      hasLoginHints: countMatches(lowerText, [/login/i, /sign in/i, /register/i, /password/i, /验证码/i]) > 0,
      hasCheckoutHints: countMatches(lowerText, [/price/i, /buy now/i, /add to cart/i, /checkout/i, /￥/, /\$/]) > 0,
      hasPlayerHints: countMatches(lowerText, [/video/i, /watch/i, /play/i, /播放器/i]) > 0,
      hasArticleHints: countMatches(lowerText, [/article/i, /news/i, /blog/i, /作者/i, /阅读/i]) > 0,
      hasDashboardHints: countMatches(lowerText, [/dashboard/i, /admin/i, /console/i, /panel/i, /analytics/i]) > 0,
      textDensity: Number((textLength / allElements).toFixed(2)),
      interactiveDensity: Number((interactiveCount / allElements).toFixed(3)),
      feedLikelihood: pageProfile.isDynamicFeed
        ? 0.9
        : Number(Math.min(1, safeRatio(cards.length + lists.length * 0.6 + links.length * 0.05, 12)).toFixed(3)),
      textLength
    };
  }

  function scorePageType(pageContext, domFeatures) {
    const scores = Object.fromEntries(PAGE_TYPES.map((type) => [type, 0]));
    const reasons = [];
    const lowerUrl = String(pageContext.url || '').toLowerCase();
    const lowerTitle = String(pageContext.title || '').toLowerCase();
    const mainContent = normalizeWhitespace(pageContext.mainContent || pageContext.markdownContent || '');
    const combinedText = `${lowerUrl} ${lowerTitle}`;

    if (domFeatures.headingCount >= 3 && mainContent.length > 1200) {
      scores.article += 3;
      reasons.push('article: long main content with multiple headings');
    }
    if (domFeatures.hasArticleHints) {
      scores.article += 2;
      reasons.push('article: article-like keywords detected');
    }
    if (domFeatures.inputCount <= 3 && domFeatures.buttonCount <= 6) {
      scores.article += 1;
      reasons.push('article: low form density');
    }

    if (domFeatures.feedLikelihood >= 0.55) {
      scores.feed += 4;
      reasons.push('feed: repeated card/list structure detected');
    }
    if (pageContext.behaviorSignals?.pageType === 'dynamic-feed') {
      scores.feed += 3;
      reasons.push('feed: dynamic feed behavior already detected');
    }
    if (domFeatures.cardLikeCount >= 6 && mainContent.length < 9000) {
      scores.feed += 1;
      reasons.push('feed: many card-like siblings');
    }

    if (domFeatures.formCount >= 1) {
      scores.form += 2;
      reasons.push('form: form element exists');
    }
    if (domFeatures.inputCount >= 3) {
      scores.form += 3;
      reasons.push('form: multiple input controls detected');
    }
    if (domFeatures.hasLoginHints || domFeatures.hasSearchBox) {
      scores.form += 2;
      reasons.push('form: login/search hints detected');
    }

    if (domFeatures.imageCount >= 3 && domFeatures.hasCheckoutHints) {
      scores.product += 4;
      reasons.push('product: media plus buy/price hints detected');
    }
    if (countMatches(combinedText, PAGE_TYPE_KEYWORDS.product.map((keyword) => new RegExp(keyword, 'i'))) > 0) {
      scores.product += 1;
      reasons.push('product: product keywords in URL/title');
    }

    if (domFeatures.sidebarExists && domFeatures.tableCount >= 1) {
      scores.dashboard += 3;
      reasons.push('dashboard: sidebar with table-like content');
    }
    if (domFeatures.hasDashboardHints) {
      scores.dashboard += 3;
      reasons.push('dashboard: dashboard keywords detected');
    }
    if (domFeatures.interactiveDensity >= 0.18 && domFeatures.textDensity < 90) {
      scores.dashboard += 1;
      reasons.push('dashboard: component-dense layout detected');
    }

    if (domFeatures.videoCount >= 1) {
      scores.video += 4;
      reasons.push('video: video/player element detected');
    }
    if (domFeatures.hasPlayerHints) {
      scores.video += 2;
      reasons.push('video: player keywords detected');
    }
    if (countMatches(combinedText, PAGE_TYPE_KEYWORDS.video.map((keyword) => new RegExp(keyword, 'i'))) > 0) {
      scores.video += 1;
      reasons.push('video: video keywords in URL/title');
    }

    scores.generic += 1;
    reasons.push('generic: baseline fallback score');

    return { scores, reasons };
  }

  function classifyPage(pageContext, domFeatures) {
    const { scores, reasons } = scorePageType(pageContext, domFeatures);
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const [pageType, topScore] = sorted[0] || ['generic', 1];
    const secondScore = sorted[1]?.[1] || 0;
    const normalizedType = topScore > 0 ? pageType : 'generic';
    const confidence = Number(
      Math.max(0.2, Math.min(0.98, safeRatio(topScore - secondScore + 1, Math.max(topScore + 1, 2)))).toFixed(2)
    );

    return {
      pageType: normalizedType,
      scores,
      reasons: reasons.filter((reason) => reason.startsWith(normalizedType)).concat(
        normalizedType === 'generic' ? ['generic: no stronger classifier matched'] : []
      ),
      confidence
    };
  }

  function selectInjectionStrategy(pageType, pageContext, domFeatures) {
    const strategyModule = runtime.modules.getStrategyModule(pageType);
    return {
      pageType,
      ...(strategyModule?.getStrategy(pageContext, domFeatures) || {
      strategyId: 'generic-fallback-card',
      placementMode: 'fallback',
      renderMode: 'card',
      contentGoal: 'summary',
      riskLevel: 'low',
      explanation: ['fallback generic strategy']
      })
    };
  }

  function buildFallbackBody(pageType, pageContext) {
    const strategyModule = runtime.modules.getStrategyModule(pageType);
    return strategyModule?.buildFallbackBody(pageContext) || '';
  }

  function buildInjectionPayload(input) {
    const { pageType, strategy, pageContext, analysisResult } = input || {};
    const firstCard = Array.isArray(analysisResult?.cards) ? analysisResult.cards[0] : null;
    const genericProfile = deriveGenericPageProfile(pageContext || {}, {
      ...(input?.domFeatures || {}),
      ...(input?.classification?.domFeatures || {})
    });
    const body = normalizeWhitespace(
      firstCard?.content ||
      analysisResult?.body ||
      analysisResult?.summary ||
      buildFallbackBody(pageType, pageContext)
    );
    const fallbackTitle = pageType === 'generic' && genericProfile.isSimplePage ? '页面提示' : '页面简介';
    const title = firstCard?.title || analysisResult?.title || fallbackTitle;
    const badge = firstCard?.type || (pageType === 'generic' && genericProfile.isSimplePage ? 'PAGE' : String(pageType || 'generic').toUpperCase());
    const tone = analysisResult?.tone || strategy?.contentGoal || 'neutral';
    const icon = analysisResult?.icon || 'favicon';
    const compact = ['compact-tip', 'banner'].includes(strategy?.renderMode);
    const leadSentence = getLeadSentence(pageContext?.mainContent || pageContext?.markdownContent || '');
    const detail = pageType === 'generic' && genericProfile.isSimplePage && leadSentence && !body.includes(leadSentence)
      ? `${body}\n\n重点内容：${leadSentence}`
      : body;

    return {
      title,
      body: detail,
      badge,
      tone,
      icon,
      layoutHints: {
        compact,
        emphasis: compact ? 'low' : 'medium',
        renderMode: strategy?.renderMode || 'card',
        variant: pageType === 'generic' ? genericProfile.variant : pageType
      },
      metadata: {
        pageType: pageType || 'generic',
        strategyId: strategy?.strategyId || 'generic-fallback-card'
      }
    };
  }

  function findFirstMatching(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element instanceof Element) {
        return element;
      }
    }
    return null;
  }

  function resolvePlacement(strategy, pageContext, domFeatures) {
    const pageProfile = cachedPageProfile || getPageProfile();
    const primaryContainer = pageProfile.stableContainer || findPrimaryContainer();
    const preferredViewportRatio = strategy?.strategyId === 'feed-midstream-card' ? 0.58 : 0.72;
    const visualSafeAnchor = findVisualSafeAnchor(primaryContainer, pageProfile, preferredViewportRatio);
    const strategyModule = runtime.modules.getStrategyModule(strategy?.pageType || 'generic');
    const rawPlacement = strategyModule?.resolvePlacement({
      strategy,
      pageContext,
      domFeatures,
      pageProfile,
      primaryContainer
    }) || {
      anchorElement: primaryContainer.firstElementChild || primaryContainer,
      insertMode: 'prepend',
      confidence: 0.35,
      debugReason: 'no strategy placement matched, using primary container'
    };
    let { anchorElement, insertMode, confidence, debugReason } = rawPlacement;

    if (!(anchorElement instanceof Element)) {
      return {
        anchorElement: primaryContainer,
        insertMode: 'prepend',
        confidence: 0.35,
        debugReason: 'no specific anchor found, falling back to primary container',
        placementSpec: { mode: 'flow', position: domFeatures.feedLikelihood > 0.6 ? 'middle' : 'top' },
        fallbackUsed: true
      };
    }

    if (!rawPlacement.skipVisualAdjustment && !isElementInPreferredVisualZone(anchorElement, preferredViewportRatio)) {
      anchorElement = visualSafeAnchor;
      insertMode = anchorElement === primaryContainer ? 'prepend' : 'after';
      confidence = Math.min(confidence, 0.7);
      debugReason = `${debugReason}; adjusted to visual-safe anchor near top viewport`;
    }

    const anchorId = ensureAnchorId(anchorElement);
    const placementSpec = ['prepend', 'append'].includes(insertMode)
      ? {
          mode: 'flow',
          position: insertMode === 'append' ? 'middle' : 'top',
          label: debugReason,
          lockMode: rawPlacement.lockMode || ''
        }
      : {
          mode: 'anchor',
          position: insertMode === 'before' ? 'before' : 'after',
          anchorId,
          label: debugReason,
          lockMode: rawPlacement.lockMode || ''
        };

    return {
      anchorElement,
      insertMode,
      confidence: Number(confidence.toFixed(2)),
      debugReason,
      placementSpec,
      fallbackUsed: false
    };
  }

  function normalizePlacementSpec(placement) {
    const pageProfile = cachedPageProfile || getPageProfile();
    if (!placement) {
      return {
        mode: 'flow',
        position: 'top'
      };
    }

    if (typeof placement === 'string') {
      return {
        mode: 'flow',
        position: 'top'
      };
    }

    const normalizedPosition = String(placement.position || placement.preference || 'top').toLowerCase();
    const normalizedMode = String(placement.mode || 'flow').toLowerCase();
    return {
      mode: normalizedMode,
      position: normalizedPosition === 'bottom' || normalizedPosition === 'end' ? 'middle' : normalizedPosition,
      anchorId: placement.anchorId || placement.anchor || '',
      label: placement.label || '',
      strategy: placement.strategy || '',
      lockMode: placement.lockMode || ''
    };
  }

  function getVisibleDirectChildren(container) {
    return Array.from(container?.children || []).filter((child) => {
      if (!(child instanceof Element) || child.id === ROOT_ID || child.id === SLOT_ID) {
        return false;
      }
      const rect = child.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
  }

  function findNaturalMiddleInsertionPoint(container) {
    const children = getVisibleDirectChildren(container);
    if (children.length === 0) {
      return findTopInsertionPoint(container);
    }

    const overlayMetrics = getTopOverlayMetrics();
    const safeTop = overlayMetrics.overlayBottom + 24;
    const targetY = Math.max(safeTop + 120, window.innerHeight * 0.42);
    let bestGap = null;

    for (let index = 0; index < children.length - 1; index += 1) {
      const currentRect = children[index].getBoundingClientRect();
      const nextRect = children[index + 1].getBoundingClientRect();
      const gap = nextRect.top - currentRect.bottom;
      const gapCenter = currentRect.bottom + gap / 2;

      if (gap < 20 || gapCenter < safeTop) {
        continue;
      }

      const score = Math.abs(gapCenter - targetY) - Math.min(gap, 120) * 0.35;
      if (!bestGap || score < bestGap.score) {
        bestGap = {
          before: children[index + 1],
          score
        };
      }
    }

    if (bestGap) {
      return { parent: container, before: bestGap.before };
    }

    const largeLeadBlock = children.find((child) => {
      const rect = child.getBoundingClientRect();
      return rect.top >= safeTop - 24 && rect.height > 220 && rect.width > container.getBoundingClientRect().width * 0.38;
    });

    if (largeLeadBlock?.nextSibling) {
      return { parent: container, before: largeLeadBlock.nextSibling };
    }

    const fallbackIndex = Math.min(children.length - 1, Math.max(1, Math.floor(children.length * 0.33)));
    return { parent: container, before: children[fallbackIndex] };
  }

  function findTopInsertionPoint(container) {
    if (!container) {
      return { parent: document.body, before: document.body.firstChild };
    }

    const topOverlay = getTopOverlayMetrics();
    const safeTop = topOverlay.overlayBottom + 16;
    const directChildren = Array.from(container.children).filter((child) => child.id !== ROOT_ID && child.id !== SLOT_ID);

    let lastOverlappingChild = null;
    for (const child of directChildren) {
      const rect = child.getBoundingClientRect();
      if (rect.height <= 0 || rect.width <= 0) {
        continue;
      }

      if (rect.top >= safeTop) {
        return { parent: container, before: child };
      }

      if (rect.bottom > safeTop) {
        lastOverlappingChild = child;
      }
    }

    if (lastOverlappingChild) {
      return { parent: container, before: lastOverlappingChild.nextSibling };
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

  function moveSlotBeforeFeedContainer(slot, pageProfile) {
    const feedContainer = pageProfile?.feedContainer;
    if (!(slot instanceof Element) || !(feedContainer instanceof Element) || !feedContainer.parentNode) {
      return false;
    }

    if (slot.parentNode === feedContainer.parentNode && slot.nextSibling === feedContainer) {
      return true;
    }

    feedContainer.parentNode.insertBefore(slot, feedContainer);
    return true;
  }

  function moveSlotAfterStableAnchor(slot, placementSpec, primaryContainer) {
    const target = resolveAnchorTarget(primaryContainer, placementSpec);
    if (!(slot instanceof Element) || !(target instanceof Element) || !target.parentNode) {
      return false;
    }

    if (slot.parentNode === target.parentNode && target.nextSibling === slot) {
      return true;
    }

    target.insertAdjacentElement('afterend', slot);
    return true;
  }

  function ensureSlot(root, placementSpec) {
    let slot = getSlot();
    const pageProfile = cachedPageProfile || getPageProfile();
    const primaryContainer = pageProfile.stableContainer || findPrimaryContainer();
    if (slot) {
      if (placementSpec.lockMode === 'stable-anchor') {
        moveSlotAfterStableAnchor(slot, placementSpec, primaryContainer);
      }
      if (placementSpec.lockMode === 'stable-feed') {
        moveSlotBeforeFeedContainer(slot, pageProfile);
      }
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

    if (placementSpec.lockMode === 'stable-anchor' && moveSlotAfterStableAnchor(slot, placementSpec, primaryContainer)) {
      return slot;
    }

    if (placementSpec.lockMode === 'stable-feed' && moveSlotBeforeFeedContainer(slot, pageProfile)) {
      return slot;
    }

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
      if (placementSpec.mode === 'anchor') {
        const target = resolveAnchorTarget(primaryContainer, placementSpec);
        if (target?.parentNode) {
          target.insertAdjacentElement('afterend', slot);
          return slot;
        }
      }

      const middleInsertion = findNaturalMiddleInsertionPoint(primaryContainer);
      middleInsertion.parent.insertBefore(slot, middleInsertion.before || null);
      return slot;
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
      const placementSpec = normalizePlacementSpec({
        mode: root.dataset.placementMode || 'flow',
        position: root.dataset.placementPosition || 'top',
        anchorId: root.dataset.anchorId || '',
        lockMode: root.dataset.lockMode || ''
      });
      if (placementSpec.lockMode === 'stable-anchor') {
        ensureSlot(root, placementSpec);
      }
      if (placementSpec.lockMode === 'stable-feed') {
        ensureSlot(root, placementSpec);
      }
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
      root.dataset.placementMode = placementSpec.mode || 'flow';
      root.dataset.placementPosition = placementSpec.position || 'top';
      root.dataset.anchorId = placementSpec.anchorId || '';
      root.dataset.lockMode = placementSpec.lockMode || '';
      return root;
    }

    root = document.createElement('section');
    root.id = ROOT_ID;
    root.setAttribute('aria-label', DEFAULT_LABEL);
    root.dataset.layout = renderHints.layout || 'grid';
    root.dataset.chrome = renderHints.chrome || 'blend';
    root.dataset.emphasis = renderHints.emphasis || 'medium';
    root.dataset.placementMode = placementSpec.mode || 'flow';
    root.dataset.placementPosition = placementSpec.position || 'top';
    root.dataset.anchorId = placementSpec.anchorId || '';
    root.dataset.lockMode = placementSpec.lockMode || '';
    applyStyleProfile(root, styleProfile);
    root.innerHTML = `
      <div class="llamb-analysis-shell">
        <div class="llamb-analysis-body" id="llamb-analysis-body"></div>
      </div>
    `;

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
    root.dataset.placementMode = placementSpec.mode || 'flow';
    root.dataset.placementPosition = placementSpec.position || 'top';
    root.dataset.anchorId = placementSpec.anchorId || '';
    root.dataset.lockMode = placementSpec.lockMode || '';

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
    const body = root.querySelector('#llamb-analysis-body');
    const pageProfile = cachedPageProfile || getPageProfile();
    const primaryContainer = pageProfile.stableContainer || findPrimaryContainer();

    applyRenderHints(root, normalizedHints);
    mountRoot(root, placementSpec, { preserveExisting: true });

    body.innerHTML = '';

    if (!Array.isArray(cards) || cards.length === 0) {
      body.innerHTML = `
        <div class="llamb-analysis-content">
          <div class="llamb-analysis-card-header">
            <h3>页面简介</h3>
          </div>
          <div class="llamb-analysis-card-content">当前没有可显示的页面简介。</div>
        </div>
      `;
    } else {
      const card = cards[0];
      const badge = card.type
        ? `<span class="llamb-analysis-badge">${escapeHtml(card.type)}</span>`
        : '';
      const content = typeof card.content === 'string'
        ? formatTextContent(card.content)
        : `<pre>${escapeHtml(JSON.stringify(card.content ?? card, null, 2))}</pre>`;
      const hostIcon = buildHostIconMarkup();

      body.innerHTML = `
        <div class="llamb-analysis-content">
          <div class="llamb-analysis-card-header">
            <div class="llamb-analysis-title-wrap">
              ${hostIcon}
              <h3>${escapeHtml(card.title || '页面简介')}</h3>
            </div>
            ${badge}
          </div>
          <div class="llamb-analysis-card-content">${content}</div>
        </div>
      `;
    }

    const overlayMetrics = getTopOverlayMetrics();
    const rootRect = root.getBoundingClientRect();
    const targetTop = window.scrollY + rootRect.top - overlayMetrics.overlayBottom - 24;

    window.scrollTo({
      top: Math.max(0, targetTop),
      behavior: 'smooth'
    });
  }

  function resolveRenderHintsFromPayload(payload, strategy) {
    const renderMode = strategy?.renderMode || payload?.layoutHints?.renderMode || 'card';
    if (renderMode === 'compact-tip') {
      return { layout: 'minimal', chrome: 'callout', emphasis: 'low', tone: '填写提示' };
    }
    if (renderMode === 'banner') {
      return { layout: 'inline', chrome: 'bordered', emphasis: 'medium', tone: '页面提示' };
    }
    if (renderMode === 'inline-block') {
      return { layout: 'stack', chrome: 'blend', emphasis: 'medium', tone: '补充信息' };
    }
    return { layout: 'minimal', chrome: 'bordered', emphasis: 'medium', tone: '页面速览' };
  }

  function renderInjectionCard(payload, styleProfile, strategy, placement) {
    const renderHints = resolveRenderHintsFromPayload(payload, strategy);
    const placementSpec = placement?.placementSpec || placement || 'top';
    const root = ensureRoot(renderHints, placementSpec);
    const body = root.querySelector('#llamb-analysis-body');
    applyStyleProfile(root, styleProfile || getStyleProfile(findPrimaryContainer()));
    applyRenderHints(root, renderHints);
    mountRoot(root, placementSpec, { preserveExisting: true });

    root.dataset.llambInjection = 'true';
    root.dataset.pageType = payload?.metadata?.pageType || 'generic';
    root.dataset.strategyId = payload?.metadata?.strategyId || 'generic-fallback-card';
    root.dataset.renderMode = strategy?.renderMode || payload?.layoutHints?.renderMode || 'card';
    root.dataset.variant = payload?.layoutHints?.variant || payload?.metadata?.pageType || 'generic';

    const badgeMarkup = payload?.badge
      ? `<span class="llamb-analysis-badge">${escapeHtml(payload.badge)}</span>`
      : '';
    const hostIcon = payload?.icon === 'favicon' ? buildHostIconMarkup() : '';
    const subtitleMarkup = payload?.tone
      ? `<div class="llamb-analysis-subtitle">${escapeHtml(String(payload.tone))}</div>`
      : '';
    const mimicSource = findHostMimicSource(placement?.anchorElement);
    const useHostMimic = ['feed', 'video', 'product', 'generic'].includes(payload?.metadata?.pageType || '') && mimicSource;

    body.innerHTML = '';
    if (useHostMimic) {
      root.dataset.hostMimic = 'true';
      root.dataset.chrome = 'ghost';
      const mimicNode = buildHostMimicNode(mimicSource, payload);
      if (mimicNode) {
        body.appendChild(mimicNode);
      }
    } else {
      root.dataset.hostMimic = 'false';
      body.innerHTML = `
        <div class="llamb-analysis-content">
          <div class="llamb-analysis-card-header">
            <div class="llamb-analysis-title-wrap">
              ${hostIcon}
              <div class="llamb-analysis-title-block">
                <h3>${escapeHtml(payload?.title || '页面简介')}</h3>
                ${subtitleMarkup}
              </div>
            </div>
            ${badgeMarkup}
          </div>
          <div class="llamb-analysis-card-content">${formatTextContent(payload?.body || '当前没有可显示的页面简介。')}</div>
          <div class="llamb-analysis-meta">
            <span>${escapeHtml(payload?.metadata?.pageType || 'generic')}</span>
            <span>${escapeHtml(payload?.metadata?.strategyId || 'generic-fallback-card')}</span>
          </div>
        </div>
      `;
    }

    const overlayMetrics = getTopOverlayMetrics();
    const rootRect = root.getBoundingClientRect();
    const targetTop = window.scrollY + rootRect.top - overlayMetrics.overlayBottom - 24;

    window.scrollTo({
      top: Math.max(0, targetTop),
      behavior: 'smooth'
    });

    return root;
  }

  function reportInjectionResult(debugInfo) {
    const snapshot = {
      contextSummary: {
        url: debugInfo?.pageContext?.url || '',
        title: debugInfo?.pageContext?.title || '',
        anchorCount: debugInfo?.pageContext?.anchors?.length || 0
      },
      domFeatures: debugInfo?.domFeatures || {},
      classification: debugInfo?.classification || {},
      strategy: debugInfo?.strategy || {},
      placement: debugInfo?.placement || {},
      payload: debugInfo?.payload || {},
      simplePageProfile: deriveGenericPageProfile(debugInfo?.pageContext || {}, debugInfo?.domFeatures || {}),
      fallbackUsed: Boolean(debugInfo?.placement?.fallbackUsed || debugInfo?.fallbackUsed),
      renderMode: debugInfo?.strategy?.renderMode || debugInfo?.payload?.layoutHints?.renderMode || 'card',
      timestamp: new Date().toISOString()
    };

    window.__LLAMB_DEBUG__ = snapshot;
    console.log('[LLaMb][content] adaptive injection debug', snapshot);
    return snapshot;
  }

  function getHostnameLabel(url) {
    try {
      return new URL(url || '').hostname.replace(/^www\./, '');
    } catch {
      return '当前网站';
    }
  }

  async function collectAdaptiveContext() {
    const pageContext = await getPageContext();
    const domFeatures = extractDomFeatures();
    const classification = classifyPage(pageContext, domFeatures);
    const strategy = selectInjectionStrategy(classification.pageType, pageContext, domFeatures);
    const debug = {
      pageType: classification.pageType,
      classifierScores: classification.scores,
      classifierReasons: classification.reasons,
      selectedStrategy: strategy.strategyId,
      timestamp: new Date().toISOString()
    };

    window.__LLAMB_DEBUG__ = {
      ...(window.__LLAMB_DEBUG__ || {}),
      contextSummary: {
        url: pageContext.url,
        title: pageContext.title
      },
      domFeatures,
      classification,
      strategy,
      collection: debug
    };
    console.log('[LLaMb][content] adaptive context collected', {
      domFeatures,
      classification,
      strategy
    });

    return {
      pageContext,
      domFeatures,
      classification,
      strategy
    };
  }

  runtime.helpers = {
    ...runtime.helpers,
    normalizeWhitespace,
    truncateText,
    safeRatio,
    countMatches,
    getLeadSentence,
    deriveGenericPageProfile,
    shouldUseStableFeedPlacement,
    getVisibleDirectChildren,
    findStableTopAnchor,
    findVisualSafeAnchor,
    isElementInPreferredVisualZone,
    findFormPlacementContext,
    findFirstMatching,
    getHostnameLabel
  };

  function renderAdaptiveInjection(input = {}) {
    const pageContext = input.pageContext || {};
    const domFeatures = input.domFeatures || extractDomFeatures();
    const classification = input.classification || classifyPage(pageContext, domFeatures);
    const strategy = input.strategy || selectInjectionStrategy(classification.pageType, pageContext, domFeatures);
    const payload = input.payload || buildInjectionPayload({
      pageType: classification.pageType,
      strategy,
      pageContext,
      analysisResult: input.analysisResult || {},
      domFeatures,
      classification
    });
    const placement = input.placement || resolvePlacement(strategy, pageContext, domFeatures);

    renderInjectionCard(payload, pageContext.styleSignals, strategy, placement);
    return reportInjectionResult({
      pageContext,
      domFeatures,
      classification,
      strategy,
      placement,
      payload,
      fallbackUsed: input.fallbackUsed
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

    if (request.action === 'getAdaptiveContext') {
      collectAdaptiveContext()
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

    if (request.action === 'renderAdaptiveInjection') {
      const debug = renderAdaptiveInjection(request);
      sendResponse({
        success: true,
        debug
      });
      return false;
    }

    sendResponse({ success: false, error: 'Unknown action' });
    return false;
  });
})();
