(function () {
  'use strict';

  const runtime = globalThis.__LLAMB_CONTENT__;
  runtime.modules.registerStrategy('video', {
    getStrategy() {
      return {
        strategyId: 'video-context-card',
        placementMode: 'after-heading',
        renderMode: 'card',
        contentGoal: 'context-note',
        riskLevel: 'low',
        explanation: ['pageType is video']
      };
    },
    buildFallbackBody(pageContext) {
      const hostname = runtime.helpers.getHostnameLabel(pageContext.url);
      const title = String(pageContext.title || '').trim() || '当前页面';
      return `这是 ${hostname} 上与“${title}”相关的视频页面，当前页面通常围绕播放器、简介和推荐内容展开。`;
    },
    resolvePlacement(context) {
      const { primaryContainer } = context;
      const headings = Array.from(primaryContainer.querySelectorAll('h1, h2, h3'));
      const anchorElement = runtime.helpers.findFirstMatching(['video', '[class*="player"]', '[id*="player"]', 'h1']) || headings[0];
      return {
        anchorElement,
        insertMode: 'after',
        confidence: anchorElement ? 0.8 : 0.41,
        debugReason: anchorElement ? 'video player/heading area found' : 'video anchor missing, using fallback'
      };
    }
  });
})();
