document.addEventListener('DOMContentLoaded', () => {
  const analyzeButton = document.getElementById('analyze-page-btn');
  const settingsButton = document.getElementById('open-settings-btn');
  const statusNode = document.getElementById('status');

  analyzeButton.addEventListener('click', async () => {
    statusNode.textContent = 'Analyzing current page...';

    try {
      const response = await chrome.runtime.sendMessage({ action: 'analyzeCurrentPage' });

      if (!response?.success) {
        throw new Error(response?.error || 'Analysis failed');
      }

      statusNode.textContent = `Inserted ${response.cardCount || 0} cards.`;
      setTimeout(() => window.close(), 500);
    } catch (error) {
      statusNode.textContent = error.message;
    }
  });

  settingsButton.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ action: 'openSettings' });
    window.close();
  });
});
