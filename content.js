(function () {
  'use strict';

  if (window.__llambPageAnalyzerLoaded) {
    return;
  }
  window.__llambPageAnalyzerLoaded = true;

  const ROOT_ID = 'llamb-analysis-root';
  const DEFAULT_LABEL = 'LLaMb page notes';

  function normalizeWhitespace(text) {
    return text.replace(/\u00a0/g, ' ').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
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
    return text.length > 8000 ? `${text.slice(0, 8000)}...` : text;
  }

  async function getPageContext() {
    return {
      url: window.location.href,
      title: document.title || 'Untitled Page',
      selectedText: getSelectedText(),
      markdownContent: extractPageContent(),
      timestamp: new Date().toISOString()
    };
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
        : 'color-mix(in srgb, currentColor 16%, transparent)',
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

  function describePlacement(container) {
    if (!container || container === document.body) {
      return 'Inserted into the current page flow';
    }

    const tag = container.tagName.toLowerCase();
    if (tag === 'article' || tag === 'main') {
      return `Inserted near the page ${tag}`;
    }

    return 'Inserted near the main reading area';
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

  function ensureRoot(placement = 'top') {
    let root = document.getElementById(ROOT_ID);
    const primaryContainer = findPrimaryContainer();
    const styleProfile = getStyleProfile(primaryContainer);

    if (root) {
      applyStyleProfile(root, styleProfile);
      const subtitle = root.querySelector('.llamb-analysis-subtitle');
      if (subtitle) {
        subtitle.textContent = describePlacement(primaryContainer);
      }
      return root;
    }

    root = document.createElement('section');
    root.id = ROOT_ID;
    root.setAttribute('aria-label', DEFAULT_LABEL);
    applyStyleProfile(root, styleProfile);
    root.innerHTML = `
      <div class="llamb-analysis-shell">
        <div class="llamb-analysis-header">
          <div>
            <div class="llamb-analysis-eyebrow">LLaMb</div>
            <div class="llamb-analysis-title">${DEFAULT_LABEL}</div>
            <div class="llamb-analysis-subtitle">${escapeHtml(describePlacement(primaryContainer))}</div>
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

    mountRoot(root, placement);

    return root;
  }

  function mountRoot(root, placement = 'top') {
    const normalizedPlacement = String(placement || 'top').toLowerCase();
    const primaryContainer = findPrimaryContainer();
    applyStyleProfile(root, getStyleProfile(primaryContainer));

    if (normalizedPlacement === 'bottom') {
      primaryContainer.appendChild(root);
      return;
    }

    const insertion = findTopInsertionPoint(primaryContainer);
    insertion.parent.insertBefore(root, insertion.before || null);
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

  function renderAnalysisCards(cards, meta = {}, placement = 'top') {
    const root = ensureRoot(placement);
    const grid = root.querySelector('#llamb-analysis-grid');
    const metaNode = root.querySelector('#llamb-analysis-meta');

    mountRoot(root, placement);

    grid.innerHTML = '';
    metaNode.textContent = Object.keys(meta).length > 0
      ? Object.entries(meta).map(([key, value]) => `${key}: ${value}`).join(' · ')
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

    if (String(placement || 'top').toLowerCase() === 'bottom') {
      root.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } else {
      root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ping') {
      sendResponse({ success: true });
      return false;
    }

    if (request.action === 'getPageContext') {
      getPageContext()
        .then(context => sendResponse(context))
        .catch(error => sendResponse({ error: error.message }));
      return true;
    }

    if (request.action === 'renderAnalysisCards') {
      renderAnalysisCards(request.cards, request.meta || {}, request.placement || 'top');
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
