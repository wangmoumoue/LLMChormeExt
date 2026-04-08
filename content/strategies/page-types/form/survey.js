(function () {
  'use strict';

  const runtime = globalThis.__LLAMB_CONTENT__;
  runtime.modules.registerSubStrategy('form', 'survey', {
    getStrategy() {
      return {
        strategyId: 'form-survey-help',
        placementMode: 'near-form',
        renderMode: 'compact-tip',
        contentGoal: 'guide',
        riskLevel: 'low',
        explanation: ['form subtype is survey']
      };
    },
    buildFallbackBody(pageContext) {
      const hostname = runtime.helpers.getHostnameLabel(pageContext.url);
      return `这是 ${hostname} 上的问卷或填写页面，建议在开始填写前先快速了解页面要求和字段结构。`;
    },
    resolvePlacement(context) {
      const fieldAnchor = runtime.helpers.findFormPlacementContext()?.fieldAnchor;
      return {
        anchorElement: fieldAnchor,
        insertMode: 'before',
        confidence: fieldAnchor ? 0.94 : 0.4,
        debugReason: fieldAnchor ? 'survey form inserts above the first question field' : 'survey form anchor missing',
        skipVisualAdjustment: true
      };
    }
  });
})();
