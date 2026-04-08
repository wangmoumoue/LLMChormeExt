(function () {
  'use strict';

  const runtime = globalThis.__LLAMB_CONTENT__;

  function detectFeedSubType(pageContext) {
    const lower = `${pageContext.url || ''} ${pageContext.title || ''}`.toLowerCase();
    if (/bilibili/.test(lower) && (/index|home|推荐|popular/.test(lower) || pageContext.behaviorSignals?.pageType === 'dynamic-feed')) {
      return 'bilibili-home';
    }
    if (/youtube|douyin/.test(lower) && pageContext.behaviorSignals?.pageType === 'dynamic-feed') {
      return 'video-site-home';
    }
    return 'generic-feed';
  }

  runtime.modules.registerStrategy('feed', {
    getStrategy(pageContext, domFeatures) {
      const subType = detectFeedSubType(pageContext);
      const subStrategy = runtime.modules.getSubStrategy('feed', subType);
      return {
        feedSubType: subType,
        ...(subStrategy?.getStrategy(pageContext, domFeatures) || runtime.modules.getSubStrategy('feed', 'generic-feed').getStrategy(pageContext, domFeatures))
      };
    },
    buildFallbackBody(pageContext, domFeatures, strategy) {
      const subType = strategy?.feedSubType || detectFeedSubType(pageContext);
      const subStrategy = runtime.modules.getSubStrategy('feed', subType);
      return subStrategy?.buildFallbackBody(pageContext) || runtime.modules.getSubStrategy('feed', 'generic-feed').buildFallbackBody(pageContext);
    },
    resolvePlacement(context) {
      const subType = context.strategy?.feedSubType || detectFeedSubType(context.pageContext);
      const subStrategy = runtime.modules.getSubStrategy('feed', subType);
      return subStrategy?.resolvePlacement(context) || runtime.modules.getSubStrategy('feed', 'generic-feed').resolvePlacement(context);
    }
  });
})();
