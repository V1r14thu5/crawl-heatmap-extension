const btn = document.getElementById('toggleBtn');
const selectorInput = document.getElementById('customSelector');
let isActive = false;

// Check current state from storage
chrome.storage.local.get(['heatmapActive', 'customBarSelector'], (result) => {
  isActive = result.heatmapActive || false;
  selectorInput.value = result.customBarSelector || '';
  updateBtn();
});

btn.addEventListener('click', async () => {
  isActive = !isActive;
  chrome.storage.local.set({ heatmapActive: isActive });
  updateBtn();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { action: 'toggle' });
});

// Save + apply custom selector (debounced on blur / Enter to avoid spamming rescans)
function saveCustomSelector() {
  const selector = selectorInput.value.trim();
  chrome.storage.local.set({ customBarSelector: selector });
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab) chrome.tabs.sendMessage(tab.id, { action: 'setCustomBarSelector', selector });
  });
}
selectorInput.addEventListener('blur', saveCustomSelector);
selectorInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); saveCustomSelector(); }
});

function updateBtn() {
  btn.textContent = isActive ? 'Deactivate Heatmap' : 'Activate Heatmap';
  btn.className = isActive ? 'toggle-btn active' : 'toggle-btn';
}
