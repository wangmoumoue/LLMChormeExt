(function () {
  'use strict';

  const runtime = globalThis.__LLAMB_CONTENT__ || {
    registry: {
      strategies: new Map(),
      subStrategies: new Map()
    },
    helpers: {},
    constants: {},
    modules: {}
  };

  runtime.modules.registerStrategy = function registerStrategy(pageType, strategyModule) {
    runtime.registry.strategies.set(pageType, strategyModule);
  };

  runtime.modules.getStrategyModule = function getStrategyModule(pageType) {
    return runtime.registry.strategies.get(pageType) || runtime.registry.strategies.get('generic') || null;
  };

  runtime.modules.registerSubStrategy = function registerSubStrategy(pageType, subType, strategyModule) {
    if (!runtime.registry.subStrategies.has(pageType)) {
      runtime.registry.subStrategies.set(pageType, new Map());
    }
    runtime.registry.subStrategies.get(pageType).set(subType, strategyModule);
  };

  runtime.modules.getSubStrategy = function getSubStrategy(pageType, subType) {
    const group = runtime.registry.subStrategies.get(pageType);
    if (!group) {
      return null;
    }
    return group.get(subType) || group.get('default') || null;
  };

  globalThis.__LLAMB_CONTENT__ = runtime;
})();
