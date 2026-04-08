(function () {
  'use strict';

  const runtime = globalThis.__LLAMB_CONTENT__;
  runtime.modules.registerStrategy('generic', {
    getStrategy(pageContext, domFeatures) {
      const genericProfile = runtime.helpers.deriveGenericPageProfile(pageContext, domFeatures);
      const strategy = {
        strategyId: 'generic-fallback-card',
        placementMode: 'fallback',
        renderMode: 'card',
        contentGoal: 'summary',
        riskLevel: 'low',
        explanation: ['fallback generic strategy']
      };

      if (genericProfile.isSimplePage) {
        strategy.placementMode = 'after-heading';
        strategy.renderMode = genericProfile.variant === 'landing-page' ? 'banner' : 'inline-block';
        strategy.contentGoal = genericProfile.variant === 'doc-page' ? 'summary' : 'context-note';
        strategy.explanation = strategy.explanation.concat(genericProfile.reasons, ['generic: using simple-page adaptive strategy']);
      }

      return strategy;
    },
    buildFallbackBody(pageContext) {
      const hostname = runtime.helpers.getHostnameLabel(pageContext.url);
      const title = String(pageContext.title || '').trim() || '当前页面';
      const leadSentence = runtime.helpers.getLeadSentence(pageContext.mainContent || pageContext.markdownContent || '');
      if (leadSentence) {
        return `这是 ${hostname} 上的“${title}”页面，页面当前的核心内容可以概括为：${leadSentence}`;
      }
      return `这是 ${hostname} 上的“${title}”页面，当前展示的主要是与该主题相关的页面内容与结构信息。`;
    },
    resolvePlacement(context) {
      const { primaryContainer, pageContext, domFeatures } = context;
      const genericProfile = runtime.helpers.deriveGenericPageProfile(pageContext, domFeatures);
      const paragraphs = Array.from(primaryContainer.querySelectorAll('p')).filter((element) =>
        runtime.helpers.normalizeWhitespace(element.textContent || '').length > 80
      );
      const headings = Array.from(primaryContainer.querySelectorAll('h1, h2, h3'));
      const anchorElement = headings[0] || paragraphs[0] || primaryContainer.firstElementChild || primaryContainer;
      return {
        anchorElement,
        insertMode: genericProfile.isSimplePage ? 'after' : 'prepend',
        confidence: anchorElement ? 0.72 : 0.36,
        debugReason: genericProfile.isSimplePage
          ? 'generic simple page uses heading/lead paragraph anchor'
          : 'generic page falls back to primary content container'
      };
    }
  });
})();
