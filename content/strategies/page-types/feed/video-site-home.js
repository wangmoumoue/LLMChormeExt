(function () {
  'use strict';

  const runtime = globalThis.__LLAMB_CONTENT__;
  runtime.modules.registerSubStrategy('feed', 'video-site-home', {
    getStrategy() {
      return {
        strategyId: 'feed-video-home-card',
        placementMode: 'between-cards',
        renderMode: 'card',
        contentGoal: 'context-note',
        riskLevel: 'medium',
        explanation: ['feed subtype is video-site-home']
      };
    },
    buildFallbackBody(pageContext) {
      const hostname = runtime.helpers.getHostnameLabel(pageContext.url);
      return `这是 ${hostname} 上的视频首页信息流，当前更适合使用页面前部稳定锚点进行注入。`;
    },
    resolvePlacement(context) {
      const { pageProfile, primaryContainer } = context;
      const anchorElement =
        runtime.helpers.findStableTopAnchor(pageProfile, primaryContainer) ||
        primaryContainer.querySelector('h1, h2, h3') ||
        primaryContainer.firstElementChild ||
        primaryContainer;
      return {
        anchorElement,
        insertMode: anchorElement === primaryContainer ? 'prepend' : 'after',
        confidence: anchorElement ? 0.92 : 0.4,
        debugReason: anchorElement ? 'video site home feed uses stable top anchor' : 'video site home anchor missing',
        lockMode: 'stable-anchor'
      };
    }
  });
})();
