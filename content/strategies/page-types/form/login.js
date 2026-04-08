(function () {
  'use strict';

  const runtime = globalThis.__LLAMB_CONTENT__;
  runtime.modules.registerSubStrategy('form', 'login', {
    getStrategy(pageContext, domFeatures) {
      const explanation = ['form subtype is login'];
      if (domFeatures.hasLoginHints) {
        explanation.push('login hints detected');
      }
      return {
        strategyId: 'form-login-help',
        placementMode: 'near-form',
        renderMode: 'compact-tip',
        contentGoal: 'guide',
        riskLevel: 'low',
        explanation
      };
    },
    buildFallbackBody(pageContext) {
      const hostname = runtime.helpers.getHostnameLabel(pageContext.url);
      return `这是 ${hostname} 上的登录页面，建议先确认账号、密码或验证码要求，再进行输入。`;
    },
    resolvePlacement(context) {
      const fieldAnchor = runtime.helpers.findFormPlacementContext()?.fieldAnchor;
      return {
        anchorElement: fieldAnchor,
        insertMode: 'before',
        confidence: fieldAnchor ? 0.95 : 0.4,
        debugReason: fieldAnchor ? 'login form inserts above the first credential field' : 'login form anchor missing',
        skipVisualAdjustment: true
      };
    }
  });
})();
