(function () {
  'use strict';

  const runtime = globalThis.__LLAMB_CONTENT__;
  runtime.modules.registerStrategy('product', {
    getStrategy() {
      return {
        strategyId: 'product-side-note',
        placementMode: 'after-heading',
        renderMode: 'inline-block',
        contentGoal: 'highlight',
        riskLevel: 'low',
        explanation: ['pageType is product']
      };
    },
    buildFallbackBody(pageContext) {
      const hostname = runtime.helpers.getHostnameLabel(pageContext.url);
      const title = String(pageContext.title || '').trim() || '当前页面';
      return `这是 ${hostname} 上与“${title}”相关的详情展示页面，当前页面重点通常在商品信息、价格和操作区。`;
    },
    resolvePlacement(context) {
      const { primaryContainer } = context;
      const headings = Array.from(primaryContainer.querySelectorAll('h1, h2, h3'));
      const anchorElement = runtime.helpers.findFirstMatching(['h1', '[itemprop="price"]', '[class*="price"]', '[class*="buy"]']) || headings[0];
      return {
        anchorElement,
        insertMode: 'after',
        confidence: anchorElement ? 0.76 : 0.4,
        debugReason: anchorElement ? 'product title/price area found' : 'product anchor missing, using fallback'
      };
    }
  });
})();
