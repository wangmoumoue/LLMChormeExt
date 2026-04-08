(function () {
  'use strict';

  const runtime = globalThis.__LLAMB_CONTENT__;

  function detectFormSubType(pageContext, domFeatures) {
    const lower = `${pageContext.url || ''} ${pageContext.title || ''}`.toLowerCase();
    if (/login|sign in|signin|密码/.test(lower) || domFeatures.hasLoginHints) {
      return 'login';
    }
    if (/register|signup|sign up|create account|注册/.test(lower)) {
      return 'register';
    }
    if (domFeatures.hasSearchBox || /search|搜索/.test(lower)) {
      return 'search';
    }
    if (/survey|questionnaire|问卷|填写/.test(lower)) {
      return 'survey';
    }
    return 'default';
  }

  runtime.modules.registerStrategy('form', {
    getStrategy(pageContext, domFeatures) {
      const subType = detectFormSubType(pageContext, domFeatures);
      const subStrategy = runtime.modules.getSubStrategy('form', subType);
      return {
        formSubType: subType,
        ...(subStrategy?.getStrategy(pageContext, domFeatures) || runtime.modules.getSubStrategy('form', 'default').getStrategy(pageContext, domFeatures))
      };
    },
    buildFallbackBody(pageContext, domFeatures, strategy) {
      const subType = strategy?.formSubType || detectFormSubType(pageContext, domFeatures || {});
      const subStrategy = runtime.modules.getSubStrategy('form', subType);
      return subStrategy?.buildFallbackBody(pageContext) || runtime.modules.getSubStrategy('form', 'default').buildFallbackBody(pageContext);
    },
    resolvePlacement(context) {
      const subType = context.strategy?.formSubType || detectFormSubType(context.pageContext, context.domFeatures);
      const subStrategy = runtime.modules.getSubStrategy('form', subType);
      return subStrategy?.resolvePlacement(context) || runtime.modules.getSubStrategy('form', 'default').resolvePlacement(context);
    }
  });
})();
