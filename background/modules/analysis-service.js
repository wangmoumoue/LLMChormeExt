(function () {
  const runtime = globalThis.__LLAMB_BACKGROUND__;

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

  runtime.modules.analysisHelpers = {
    inferPageKind,
    buildChineseIntro
  };
})();
