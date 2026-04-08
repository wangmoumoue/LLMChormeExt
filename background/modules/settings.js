(function () {
  const runtime = globalThis.__LLAMB_BACKGROUND__;
  runtime.constants.SETTINGS_KEY = 'llamb-settings';
  runtime.constants.DEFAULT_SETTINGS = {
    globalSettings: {
      backendEndpoint: '',
      backendAuthToken: '',
      useMockAnalysis: true,
      debugLogging: false
    }
  };

  runtime.modules.getSettings = async function getSettings() {
    const result = await chrome.storage.local.get(runtime.constants.SETTINGS_KEY);
    const saved = result[runtime.constants.SETTINGS_KEY] || {};
    return {
      ...runtime.constants.DEFAULT_SETTINGS,
      ...saved,
      globalSettings: {
        ...runtime.constants.DEFAULT_SETTINGS.globalSettings,
        ...(saved.globalSettings || {})
      }
    };
  };
})();
