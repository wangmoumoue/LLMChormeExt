(function () {
  'use strict';

  const runtime = globalThis.__LLAMB_CONTENT__;
  runtime.modules.registerSubStrategy('form', 'register', {
    getStrategy() {
      return {
        strategyId: 'form-register-help',
        placementMode: 'near-form',
        renderMode: 'compact-tip',
        contentGoal: 'guide',
        riskLevel: 'low',
        explanation: ['form subtype is register']
      };
    },
    buildFallbackBody(pageContext) {
      const hostname = runtime.helpers.getHostnameLabel(pageContext.url);
      return `这是 ${hostname} 上的注册页面，建议在填写第一组字段前先了解用户名、密码和邮箱等填写要求。`;
    },
    resolvePlacement(context) {
      const fieldAnchor = runtime.helpers.findFormPlacementContext()?.fieldAnchor;
      return {
        anchorElement: fieldAnchor,
        insertMode: 'before',
        confidence: fieldAnchor ? 0.96 : 0.4,
        debugReason: fieldAnchor ? 'register form inserts between title area and the first field block' : 'register form anchor missing',
        skipVisualAdjustment: true
      };
    }
  });
})();
