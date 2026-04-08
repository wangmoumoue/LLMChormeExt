(function () {
  'use strict';

  const runtime = globalThis.__LLAMB_CONTENT__;
  runtime.modules.registerStrategy('article', {
    getStrategy(pageContext, domFeatures) {
      const explanation = ['pageType is article'];
      if (domFeatures.textLength > 2800) {
        explanation.push('long text body detected');
      }
      return {
        strategyId: 'article-inline-summary',
        placementMode: 'after-paragraph',
        renderMode: 'card',
        contentGoal: 'summary',
        riskLevel: 'low',
        explanation
      };
    },
    buildFallbackBody(pageContext) {
      const hostname = runtime.helpers.getHostnameLabel(pageContext.url);
      const title = String(pageContext.title || '').trim() || '当前页面';
      return `这是 ${hostname} 上的一篇图文页面，当前主题是“${title}”，适合按正文结构继续向下阅读。`;
    },
    resolvePlacement(context) {
      const { primaryContainer } = context;
      const paragraphs = Array.from(primaryContainer.querySelectorAll('p')).filter((element) =>
        runtime.helpers.normalizeWhitespace(element.textContent || '').length > 80
      );
      const headings = Array.from(primaryContainer.querySelectorAll('h1, h2, h3'));
      const anchorElement = paragraphs[1] || paragraphs[0] || headings[0] || primaryContainer.firstElementChild;
      return {
        anchorElement,
        insertMode: 'after',
        confidence: anchorElement ? 0.86 : 0.42,
        debugReason: anchorElement ? 'article paragraph/heading anchor found' : 'article anchor missing, using fallback'
      };
    }
  });
})();
