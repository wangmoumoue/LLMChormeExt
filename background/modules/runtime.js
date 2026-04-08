const BACKGROUND_RUNTIME = globalThis.__LLAMB_BACKGROUND__ || {
  modules: {},
  constants: {}
};

globalThis.__LLAMB_BACKGROUND__ = BACKGROUND_RUNTIME;
