(function () {
  'use strict';

  const runtime = globalThis.__LLAMB_CONTENT__;
  runtime.modules.registerSubStrategy('form', 'default', {
    getStrategy(pageContext, domFeatures) {
      const explanation = ['form subtype is default'];
      if (domFeatures.hasSearchBox) {
        explanation.push('search-like form needs contextual tip');
      }
      return {
        strategyId: 'form-context-help',
        placementMode: 'near-form',
        renderMode: 'compact-tip',
        contentGoal: 'guide',
        riskLevel: 'low',
        explanation
      };
    },
    buildFallbackBody(pageContext) {
      const hostname = runtime.helpers.getHostnameLabel(pageContext.url);
      const title = String(pageContext.title || '').trim() || '当前页面';
      return `这是 ${hostname} 上与“${title}”相关的表单页面，当前更适合结合页面字段说明和提交流程来理解内容。`;
    },
    resolvePlacement(context) {
      const fieldAnchor = runtime.helpers.findFormPlacementContext()?.fieldAnchor;
      return {
        anchorElement: fieldAnchor,
        insertMode: 'before',
        confidence: fieldAnchor ? 0.93 : 0.43,
        debugReason: fieldAnchor ? 'form help anchored directly above the first form field block' : 'form anchor missing, using fallback',
        skipVisualAdjustment: true
      };
    }
  });
})();
