(function () {
  'use strict';

  const runtime = globalThis.__LLAMB_CONTENT__;
  runtime.constants.PAGE_TYPES = ['article', 'feed', 'form', 'product', 'dashboard', 'video', 'generic'];
  runtime.constants.PAGE_TYPE_KEYWORDS = {
    article: ['article', 'news', 'blog', 'post', 'story'],
    form: ['login', 'sign', 'register', 'search', 'submit', 'signup'],
    product: ['product', 'item', 'shop', 'sku', 'buy', 'detail'],
    dashboard: ['dashboard', 'admin', 'console', 'panel', 'workspace'],
    video: ['video', 'watch', 'play', 'player']
  };
})();
