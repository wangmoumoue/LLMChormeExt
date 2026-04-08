class StorageManager {
  constructor() {
    this.storageKey = 'llamb-settings';
    this.defaultSettings = {
      globalSettings: {
        backendEndpoint: 'http://localhost:3000/api/analyze-page',
        backendAuthToken: '',
        useMockAnalysis: false,
        debugLogging: false
      }
    };
  }

  async getSettings() {
    try {
      const result = await chrome.storage.local.get(this.storageKey);
      const savedSettings = result[this.storageKey] || {};
      return {
        ...this.defaultSettings,
        ...savedSettings,
        globalSettings: {
          ...this.defaultSettings.globalSettings,
          ...(savedSettings.globalSettings || {})
        }
      };
    } catch (error) {
      console.error('StorageManager: Error getting settings:', error);
      return this.defaultSettings;
    }
  }

  async saveSettings(settings) {
    try {
      await chrome.storage.local.set({
        [this.storageKey]: settings
      });
      return true;
    } catch (error) {
      console.error('StorageManager: Error saving settings:', error);
      return false;
    }
  }

  async updateGlobalSettings(updates) {
    const settings = await this.getSettings();
    settings.globalSettings = {
      ...settings.globalSettings,
      ...updates
    };
    await this.saveSettings(settings);
    return settings.globalSettings;
  }
}

if (typeof window !== 'undefined') {
  window.StorageManager = StorageManager;
} else if (typeof globalThis !== 'undefined') {
  globalThis.StorageManager = StorageManager;
}
