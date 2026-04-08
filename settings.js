document.addEventListener('DOMContentLoaded', async () => {
  const storageManager = new StorageManager();
  const endpointInput = document.getElementById('backend-endpoint');
  const tokenInput = document.getElementById('backend-auth-token');
  const mockCheckbox = document.getElementById('use-mock-analysis');
  const saveButton = document.getElementById('save-settings-btn');
  const resetButton = document.getElementById('reset-settings-btn');
  const statusNode = document.getElementById('status');

  async function load() {
    const settings = await storageManager.getSettings();
    const global = settings.globalSettings || {};
    endpointInput.value = global.backendEndpoint || '';
    tokenInput.value = global.backendAuthToken || '';
    mockCheckbox.checked = global.useMockAnalysis !== false;
  }

  async function save() {
    await storageManager.updateGlobalSettings({
      backendEndpoint: endpointInput.value.trim(),
      backendAuthToken: tokenInput.value.trim(),
      useMockAnalysis: mockCheckbox.checked
    });
    statusNode.textContent = 'Settings saved.';
  }

  async function reset() {
    endpointInput.value = 'http://localhost:3000/api/analyze-page';
    tokenInput.value = '';
    mockCheckbox.checked = false;
    await save();
  }

  saveButton.addEventListener('click', save);
  resetButton.addEventListener('click', reset);

  await load();
});
