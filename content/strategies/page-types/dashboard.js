(function () {
  'use strict';

  const runtime = globalThis.__LLAMB_CONTENT__;
  runtime.modules.registerStrategy('dashboard', {
    getStrategy(pageContext, domFeatures) {
      const explanation = ['pageType is dashboard'];
      if (domFeatures.sidebarExists) {
        explanation.push('sidebar layout suggests compact panel');
      }
      return {
        strategyId: 'dashboard-compact-panel',
        placementMode: 'side-panel',
        renderMode: 'banner',
        contentGoal: 'context-note',
        riskLevel: 'medium',
        explanation
      };
    },
    buildFallbackBody(pageContext) {
      const hostname = runtime.helpers.getHostnameLabel(pageContext.url);
      return `这是 ${hostname} 上的控制台或数据面板页面，页面主要由模块化信息区、统计区或表格区组成。`;
    },
    resolvePlacement(context) {
      const { primaryContainer } = context;
      const anchorElement = runtime.helpers.findFirstMatching(['main', '[role="main"]', '[class*="dashboard"]', '[class*="content"]']) || primaryContainer;
      return {
        anchorElement,
        insertMode: 'prepend',
        confidence: anchorElement ? 0.74 : 0.42,
        debugReason: anchorElement ? 'dashboard main container found' : 'dashboard anchor missing, using fallback'
      };
    }
  });
})();
