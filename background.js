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
  const rawAnalysis = await getAnalysisCards(pageContext, settings.globalSettings || {});
  const analysis = simplifyAnalysisForDisplay(rawAnalysis, pageContext);

    await chrome.tabs.sendMessage(tabId, {
      action: 'renderAnalysisCards',
      cards: analysis.cards,
      meta: analysis.meta || {},
      placement: analysis.placement || 'top',
      renderHints: analysis.renderHints || {}
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
    return { cards: payload, meta: {}, placement: 'top', renderHints: {} };
  }

  if (payload?.cards && Array.isArray(payload.cards)) {
    return {
      cards: payload.cards,
      meta: payload.meta || {},
      placement: payload.placement || 'top',
      renderHints: payload.renderHints || {}
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
      placement: payload.placement || 'top',
      renderHints: payload.renderHints || {}
    };
  }

  throw new Error('Backend returned an invalid JSON payload');
}

function inferPageKind(pageContext) {
  const hostname = (() => {
    try {
      return new URL(pageContext.url || '').hostname;
    } catch {
      return '';
    }
  })();

  if (pageContext.pageSignals?.behavior?.pageType === 'dynamic-feed') {
    return 'feed';
  }
  if (/video|bilibili|youtube|douyin/i.test(hostname)) {
    return 'video';
  }
  if (/article|post|blog|news/i.test(pageContext.url || '')) {
    return 'article';
  }
  return 'page';
}

function buildChineseIntro(pageContext, sourceCard) {
  const title = String(pageContext.title || '').trim() || '当前页面';
  const hostname = (() => {
    try {
      return new URL(pageContext.url || '').hostname.replace(/^www\./, '');
    } catch {
      return '当前网站';
    }
  })();
  const pageKind = inferPageKind(pageContext);
  const sourceText = String(sourceCard?.content || '').replace(/\s+/g, ' ').trim();
  const shortSourceText = sourceText ? sourceText.split(/[。！？.!?]/)[0].trim() : '';

  if (pageKind === 'feed') {
    return `这是 ${hostname} 的推荐信息流页面，当前以可连续浏览的内容卡片为主，主题围绕“${title}”所在的推荐分区展开。`;
  }
  if (pageKind === 'video') {
    return `这是 ${hostname} 上与“${title}”相关的视频内容页面，页面重点是视频封面、标题和互动信息的快速浏览。`;
  }
  if (pageKind === 'article') {
    return `这是 ${hostname} 上的一篇图文内容页面，当前主题是“${title}”，适合继续向下阅读了解完整内容。`;
  }
  if (shortSourceText) {
    return `这是 ${hostname} 上的“${title}”页面，主要内容可以概括为：${shortSourceText}。`;
  }
  return `这是 ${hostname} 上的“${title}”页面，当前页面主要围绕该主题展示相关内容与信息。`;
}

function simplifyAnalysisForDisplay(analysis, pageContext) {
  const firstCard = Array.isArray(analysis.cards) && analysis.cards.length > 0
    ? analysis.cards[0]
    : null;

  return {
    cards: [
      {
        type: '简介',
        title: '页面简介',
        content: buildChineseIntro(pageContext, firstCard),
        items: []
      }
    ],
    placement: analysis.placement || 'top',
    renderHints: {
      layout: 'minimal',
      chrome: 'bordered',
      emphasis: 'medium',
      tone: '页面速览',
      ...(analysis.renderHints || {})
    },
    meta: {}
  };
}

function buildMockAnalysis(pageContext) {
  const isDynamicFeed = pageContext.pageSignals?.behavior?.pageType === 'dynamic-feed';
  return {
    cards: [
      {
        type: '简介',
        title: '页面简介',
        content: buildChineseIntro(pageContext),
        items: []
      }
    ],
    placement: isDynamicFeed
      ? {
          mode: 'anchor',
          position: 'after',
          anchorId: 'anchor-1',
          label: 'after a stable page header'
        }
      : {
          mode: 'anchor',
          position: 'after',
          anchorId: 'anchor-2',
          label: 'near the opening content'
        },
    renderHints: {
      layout: 'minimal',
      chrome: 'bordered',
      emphasis: 'medium',
      tone: '页面速览'
    },
    meta: {}
  };
}
