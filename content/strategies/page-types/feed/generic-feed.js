(function () {
  'use strict';

  const runtime = globalThis.__LLAMB_CONTENT__;
  runtime.modules.registerSubStrategy('feed', 'generic-feed', {
    getStrategy(pageContext) {
      const explanation = ['feed subtype is generic-feed'];
      if (pageContext.behaviorSignals?.pageType === 'dynamic-feed') {
        explanation.push('dynamic feed requires stable top anchor');
      }
      return {
        strategyId: 'feed-midstream-card',
        placementMode: 'between-cards',
        renderMode: 'card',
        contentGoal: 'context-note',
        riskLevel: 'medium',
        explanation
      };
    },
    buildFallbackBody(pageContext) {
      const hostname = runtime.helpers.getHostnameLabel(pageContext.url);
      return `这是 ${hostname} 上的内容流页面，当前以连续卡片和推荐内容为主，适合快速了解本页主题与浏览路径。`;
    },
    resolvePlacement(context) {
      const { pageProfile, primaryContainer, pageContext, domFeatures } = context;
      const headings = Array.from(primaryContainer.querySelectorAll('h1, h2, h3'));
      const useStableFeedPlacement = runtime.helpers.shouldUseStableFeedPlacement(pageContext, domFeatures);
      let anchorElement;
      let insertMode = 'after';
      let confidence = 0.79;
      let debugReason = 'feed card anchor found near stable mid-stream position';

      if (useStableFeedPlacement) {
        anchorElement =
          runtime.helpers.findStableTopAnchor(pageProfile, primaryContainer) ||
          headings[0] ||
          pageProfile.feedContainer?.previousElementSibling ||
          primaryContainer.firstElementChild ||
          primaryContainer;
        insertMode = anchorElement === primaryContainer ? 'prepend' : 'after';
        confidence = anchorElement ? 0.91 : 0.4;
        debugReason = anchorElement
          ? 'dynamic/infinite feed uses stable top anchor outside growing stream'
          : 'dynamic feed stable anchor missing, using fallback';
      } else {
        anchorElement =
          (pageProfile.feedContainer && runtime.helpers.getVisibleDirectChildren(pageProfile.feedContainer)[2]) ||
          runtime.helpers.getVisibleDirectChildren(primaryContainer)[2] ||
          headings[0];
        confidence = anchorElement ? 0.79 : 0.4;
        debugReason = anchorElement ? 'feed card anchor found near stable mid-stream position' : 'feed anchor missing, using fallback';
      }

      return {
        anchorElement,
        insertMode,
        confidence,
        debugReason,
        lockMode: useStableFeedPlacement ? 'stable-anchor' : ''
      };
    }
  });
})();
