importScripts(
  'modules/runtime.js',
  'modules/settings.js',
  'modules/analysis-service.js'
);

const BACKGROUND_RUNTIME = globalThis.__LLAMB_BACKGROUND__;
const SETTINGS_KEY = BACKGROUND_RUNTIME.constants.SETTINGS_KEY;
const DEFAULT_SETTINGS = BACKGROUND_RUNTIME.constants.DEFAULT_SETTINGS;

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
      cardCount: result.cards?.length || 1,
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

  const adaptiveContext = await getAdaptiveContext(tabId);
  const { pageContext, domFeatures, classification, strategy } = adaptiveContext;

  const settings = await getSettings();
  const analysis = await getAnalysisCards(
    {
      pageContext,
      domFeatures,
      classification,
      strategy
    },
    settings.globalSettings || {}
  );

  console.log('[LLaMb][background] adaptive analysis', {
    pageType: classification?.pageType,
    classifierScores: classification?.scores,
    classifierReasons: classification?.reasons,
    selectedStrategy: strategy?.strategyId,
    placementReason: analysis.placement?.debugReason || analysis.placementReason || '',
    fallbackUsed: Boolean(analysis.fallbackUsed),
    renderMode: strategy?.renderMode,
    timestamp: new Date().toISOString()
  });

  await chrome.tabs.sendMessage(tabId, {
    action: 'renderAdaptiveInjection',
    pageContext,
    domFeatures,
    classification,
    strategy,
    analysisResult: analysis.analysisResult || analysis,
    payload: analysis.payload,
    placement: analysis.placement,
    fallbackUsed: analysis.fallbackUsed
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
      files: [
        'content/shared/namespace.js',
        'content/shared/constants.js',
        'content/strategies/page-types/form/login.js',
        'content/strategies/page-types/form/register.js',
        'content/strategies/page-types/form/search.js',
        'content/strategies/page-types/form/survey.js',
        'content/strategies/page-types/form/default.js',
        'content/strategies/page-types/feed/bilibili-home.js',
        'content/strategies/page-types/feed/video-site-home.js',
        'content/strategies/page-types/feed/generic-feed.js',
        'content/strategies/page-types/article.js',
        'content/strategies/page-types/feed.js',
        'content/strategies/page-types/form.js',
        'content/strategies/page-types/product.js',
        'content/strategies/page-types/dashboard.js',
        'content/strategies/page-types/video.js',
        'content/strategies/page-types/generic.js',
        'content/bootstrap.js'
      ]
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

async function getAdaptiveContext(tabId) {
  try {
    const context = await chrome.tabs.sendMessage(tabId, {
      action: 'getAdaptiveContext'
    });

    if (!context?.pageContext) {
      throw new Error(context?.error || 'Adaptive context payload missing');
    }

    return context;
  } catch (error) {
    const pageContext = await chrome.tabs.sendMessage(tabId, {
      action: 'getPageContext'
    });
    const fallbackContext = buildFallbackAdaptiveContext(pageContext);
    console.warn('[LLaMb][background] adaptive context fallback used:', error.message);
    return fallbackContext;
  }
}

function buildFallbackAdaptiveContext(pageContext) {
  const inferredType = inferPageKind(pageContext);
  const pageType = inferredType === 'page' ? 'generic' : inferredType;
  return {
    pageContext,
    domFeatures: {},
    classification: {
      pageType,
      scores: { [pageType]: 1, generic: 1 },
      reasons: ['background fallback classification'],
      confidence: 0.3
    },
    strategy: {
      strategyId: `${pageType}-fallback-card`,
      placementMode: 'fallback',
      renderMode: 'card',
      contentGoal: 'summary',
      riskLevel: 'low',
      explanation: ['background fallback strategy']
    }
  };
}

async function getAnalysisCards(analysisInput, globalSettings) {
  const { pageContext, classification, strategy } = analysisInput;
  console.log('[LLaMb]', 'Analysis settings:', {
    backendEndpoint: globalSettings.backendEndpoint || '',
    useMockAnalysis: globalSettings.useMockAnalysis === true,
    hasAuthToken: Boolean(globalSettings.backendAuthToken),
    pageType: classification?.pageType || 'generic',
    strategyId: strategy?.strategyId || ''
  });

  if (globalSettings.useMockAnalysis || !globalSettings.backendEndpoint) {
    return buildMockAnalysis(analysisInput);
  }

  try {
    const backendAnalysis = await requestBackendAnalysis(analysisInput, globalSettings);
    return simplifyAnalysisForDisplay(analysisInput, backendAnalysis);
  } catch (error) {
    console.warn('[LLaMb][background] backend analysis failed, falling back to mock:', error.message);
    return {
      ...buildMockAnalysis(analysisInput),
      fallbackUsed: true,
      fallbackReason: error.message
    };
  }
}

async function requestBackendAnalysis(analysisInput, globalSettings) {
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
      ...analysisInput
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

function simplifyAnalysisForDisplay(analysisInput, analysis) {
  const { pageContext, classification, strategy } = analysisInput;
  const firstCard = Array.isArray(analysis.cards) && analysis.cards.length > 0 ? analysis.cards[0] : null;
  const pageType = classification?.pageType || 'generic';
  const strategyId = strategy?.strategyId || 'generic-fallback-card';
  const renderMode = strategy?.renderMode || 'card';
  const compact = ['compact-tip', 'banner'].includes(renderMode);
  return {
    cards: analysis.cards || [],
    analysisResult: {
      ...analysis,
      body: firstCard?.content || buildChineseIntro(pageContext, firstCard),
      title: firstCard?.title || '页面简介',
      badge: firstCard?.type || String(pageType).toUpperCase()
    },
    payload: {
      title: firstCard?.title || '页面简介',
      body: firstCard?.content || buildChineseIntro(pageContext, firstCard),
      badge: firstCard?.type || String(pageType).toUpperCase(),
      tone: strategy?.contentGoal || 'neutral',
      icon: 'favicon',
      layoutHints: {
        compact,
        emphasis: compact ? 'low' : 'medium',
        renderMode
      },
      metadata: {
        pageType,
        strategyId
      }
    },
    placement: analysis.placement || { mode: 'flow', position: pageType === 'feed' ? 'middle' : 'top' },
    fallbackUsed: Boolean(analysis.fallbackUsed),
    meta: {
      pageType,
      strategyId
    }
  };
}

function buildMockAnalysis(analysisInput) {
  const { pageContext, classification, strategy } = analysisInput;
  const isDynamicFeed = classification?.pageType === 'feed' || pageContext.pageSignals?.behavior?.pageType === 'dynamic-feed';
  const pageType = classification?.pageType || 'generic';
  const leadLine = String(pageContext.mainContent || pageContext.markdownContent || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/[。！？.!?]/)[0]
    .trim();
  const contentByType = {
    article: '这是一张面向正文阅读场景的摘要卡，适合放在文章开头段落之后，帮助快速建立阅读预期。',
    feed: '这是一张面向信息流场景的上下文提示卡，适合夹在稳定内容卡之间，不打断连续浏览节奏。',
    form: '这是一张面向表单场景的填写提示卡，适合靠近表单标题或提交区域，帮助理解当前页面任务。',
    product: '这是一张面向详情展示场景的信息补充卡，适合靠近标题或价格区域，帮助快速理解页面重点。',
    dashboard: '这是一张面向后台面板场景的辅助卡，适合放在主内容区顶部，用来概括当前模块与数据视图。',
    video: '这是一张面向视频页面的上下文说明卡，适合放在播放器或简介区附近，帮助快速了解内容主题。',
    generic: leadLine
      ? `这是一个结构较简单的普通页面，适合在标题或首段之后插入轻量提示。当前页面重点可以概括为：${leadLine}。`
      : buildChineseIntro(pageContext)
  };
  const raw = {
    cards: [
      {
        type: String(pageType).toUpperCase(),
        title: '页面简介',
        content: contentByType[pageType] || contentByType.generic,
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
    meta: {
      source: 'mock',
      pageType,
      strategyId: strategy?.strategyId || ''
    }
  };

  return simplifyAnalysisForDisplay(analysisInput, raw);
}
