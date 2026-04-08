(function () {
  'use strict';

  const runtime = globalThis.__LLAMB_CONTENT__;
  runtime.modules.registerSubStrategy('form', 'search', {
    getStrategy() {
      return {
        strategyId: 'form-search-help',
        placementMode: 'near-form',
        renderMode: 'compact-tip',
        contentGoal: 'guide',
        riskLevel: 'low',
        explanation: ['form subtype is search']
      };
    },
    buildFallbackBody(pageContext) {
      const hostname = runtime.helpers.getHostnameLabel(pageContext.url);
      return `这是 ${hostname} 上的搜索页面，建议在输入关键词前先明确搜索范围或筛选方式。`;
    },
    resolvePlacement(context) {
      const fieldAnchor = runtime.helpers.findFormPlacementContext()?.fieldAnchor;
      return {
        anchorElement: fieldAnchor,
        insertMode: 'before',
        confidence: fieldAnchor ? 0.94 : 0.4,
        debugReason: fieldAnchor ? 'search form inserts above the main search input' : 'search form anchor missing',
        skipVisualAdjustment: true
      };
    }
  });
})();
