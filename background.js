const SETTINGS_KEY = 'llamb-settings';
const DEFAULT_SETTINGS = {
  globalSettings: {
    backendEndpoint: '',
    backendAuthToken: '',
    useMockAnalysis: true,
    debugLogging: false
  }
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'analyze-page',
      title: 'Analyze Current Page',
      contexts: ['all']
    });

    chrome.contextMenus.create({
      id: 'open-settings',
      title: 'Open Analyzer Settings',
      contexts: ['all']
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === 'analyze-page' && tab?.id) {
      await analyzeTab(tab.id);
    }

    if (info.menuItemId === 'open-settings') {
      await chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
    }
  } catch (error) {
    console.error('[LLaMb]', 'Context menu action failed:', error);
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'analyzeCurrentPage':
      handleAnalyzeCurrentPage(sendResponse);
      return true;

    case 'openSettings':
      handleOpenSettings(sendResponse);
      return true;

    default:
      sendResponse({ success: false, error: 'Unknown action' });
      return false;
  }
});

async function handleAnalyzeCurrentPage(sendResponse) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      throw new Error('No active tab found');
    }

    const result = await analyzeTab(tab.id);
    sendResponse({
      success: true,
      cardCount: result.cards.length,
      meta: result.meta || {}
    });
  } catch (error) {
    console.error('[LLaMb]', 'Analyze current page failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleOpenSettings(sendResponse) {
  try {
    await chrome.tabs.create({
      url: chrome.runtime.getURL('settings.html')
    });
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function analyzeTab(tabId) {
  await ensureContentScript(tabId);

  const pageContext = await chrome.tabs.sendMessage(tabId, {
    action: 'getPageContext'
  });

  const settings = await getSettings();
  const analysis = await getAnalysisCards(pageContext, settings.globalSettings || {});

    await chrome.tabs.sendMessage(tabId, {
      action: 'renderAnalysisCards',
      cards: analysis.cards,
      meta: analysis.meta || {},
      placement: analysis.placement || 'top'
    });

  return analysis;
}

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { action: 'ping' });
  } catch (error) {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['sidebar.css']
    });

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
  }
}

async function getSettings() {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const saved = result[SETTINGS_KEY] || {};
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    globalSettings: {
      ...DEFAULT_SETTINGS.globalSettings,
      ...(saved.globalSettings || {})
    }
  };
}

async function getAnalysisCards(pageContext, globalSettings) {
  console.log('[LLaMb]', 'Analysis settings:', {
    backendEndpoint: globalSettings.backendEndpoint || '',
    useMockAnalysis: globalSettings.useMockAnalysis === true,
    hasAuthToken: Boolean(globalSettings.backendAuthToken)
  });

  if (globalSettings.useMockAnalysis || !globalSettings.backendEndpoint) {
    return buildMockAnalysis(pageContext);
  }

  return requestBackendAnalysis(pageContext, globalSettings);
}

async function requestBackendAnalysis(pageContext, globalSettings) {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (globalSettings.backendAuthToken) {
    headers['Authorization'] = `Bearer ${globalSettings.backendAuthToken}`;
  }

  const response = await fetch(globalSettings.backendEndpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      source: 'llamb-extension',
      pageContext
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Backend request failed: ${response.status} ${errorText}`.trim());
  }

  const payload = await response.json();
  return normalizeAnalysisPayload(payload);
}

function normalizeAnalysisPayload(payload) {
  if (Array.isArray(payload)) {
    return { cards: payload, meta: {}, placement: 'top' };
  }

  if (payload?.cards && Array.isArray(payload.cards)) {
    return {
      cards: payload.cards,
      meta: payload.meta || {},
      placement: payload.placement || 'top'
    };
  }

  if (payload && typeof payload === 'object') {
    return {
      cards: [
        {
          type: payload.type || 'result',
          title: payload.title || 'Analysis Result',
          content: typeof payload.content === 'string'
            ? payload.content
            : JSON.stringify(payload, null, 2)
        }
      ],
      meta: payload.meta || {},
      placement: payload.placement || 'top'
    };
  }

  throw new Error('Backend returned an invalid JSON payload');
}

function buildMockAnalysis(pageContext) {
  const content = String(pageContext.markdownContent || '');
  const selectedText = String(pageContext.selectedText || '').trim();
  const words = content.split(/\s+/).filter(Boolean);
  const paragraphCount = content.split(/\n{2,}/).map(part => part.trim()).filter(Boolean).length;
  const readingEstimate = words.length > 0 ? Math.max(1, Math.round(words.length / 220)) : 0;

  const cards = [
    {
      type: 'summary',
      title: 'Mock Summary',
      content: selectedText
        ? `You selected part of "${pageContext.title}". This mock result shows how the final analysis cards will appear once your real backend is connected.`
        : `This is a mock analysis card for "${pageContext.title}". The extension has already captured the page context and rendered the result at the top of the page.`
    },
    {
      type: 'context',
      title: 'Captured Context',
      content: `Title: ${pageContext.title}\nURL: ${pageContext.url}\nSelected text: ${selectedText ? 'Yes' : 'No'}`
    },
    {
      type: 'metrics',
      title: 'Content Snapshot',
      content: 'These numbers are generated locally from the captured page content.',
      items: [
        `Approx word count: ${words.length}`,
        `Approx paragraph count: ${paragraphCount}`,
        `Estimated reading time: ${readingEstimate} min`
      ]
    }
  ];

  if (selectedText) {
    cards.push({
      type: 'selection',
      title: 'Selected Text Preview',
      content: selectedText.length > 260 ? `${selectedText.slice(0, 260)}...` : selectedText
    });
  }

  return {
    cards,
    placement: 'top',
    meta: {
      source: 'mock-data',
      mode: 'local-fallback',
      placement: 'top',
      note: 'Set Use Mock Analysis to off and configure a backend endpoint when you are ready.'
    }
  };
}
