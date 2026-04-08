(function () {
  'use strict';

  const runtime = globalThis.__LLAMB_CONTENT__;
  runtime.modules.registerSubStrategy('feed', 'bilibili-home', {
    getStrategy() {
      return {
        strategyId: 'feed-bilibili-home-card',
        placementMode: 'between-cards',
        renderMode: 'card',
        contentGoal: 'context-note',
        riskLevel: 'medium',
        explanation: ['feed subtype is bilibili-home']
      };
    },
    buildFallbackBody(pageContext) {
      const hostname = runtime.helpers.getHostnameLabel(pageContext.url);
      return `这是 ${hostname} 上的首页推荐流页面，适合在页面前部稳定区域插入上下文提示，而不是插入持续增长的视频流内部。`;
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
        confidence: anchorElement ? 0.94 : 0.4,
        debugReason: anchorElement ? 'bilibili home feed uses stable top anchor before the video stream' : 'bilibili home stable anchor missing',
        lockMode: 'stable-anchor'
      };
    }
  });
})();
