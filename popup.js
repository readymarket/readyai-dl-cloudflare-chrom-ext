// 獲取當前頁面的小說id
async function getCurrentNovelId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const match = tab.url.match(/\/n\/(([\w-]+))/);
  return match ? match[1] : null;
}

// 更新UI狀態
function updateUIState(downloadBtn, saveBtn, status, progress, progressBar, progressText, chapterInfo, state) {
  if (state.downloading) {
    downloadBtn.disabled = true;
    progress.style.display = 'block';
    if (state.progressValue !== undefined) {
      progressBar.value = state.progressValue;
      progressText.textContent = `${state.progressValue}%`;
    }
    if (state.statusText) {
      status.textContent = state.statusText;
      status.className = state.statusClass || '';
    }
    if (state.chapterInfo) {
      chapterInfo.textContent = state.chapterInfo;
    }
  } else {
    downloadBtn.disabled = false;
    progress.style.display = 'none';
    if (state.statusText) {
      status.textContent = state.statusText;
      status.className = state.statusClass || '';
    } else {
      status.textContent = '';
      status.className = '';
    }
  }
  
  saveBtn.disabled = !state.enableSave;
}

document.addEventListener('DOMContentLoaded', async function() {
  const downloadBtn = document.getElementById('downloadBtn');
  const saveBtn = document.getElementById('saveBtn');
  const status = document.getElementById('status');
  const progress = document.querySelector('.progress');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  const chapterInfo = document.getElementById('chapterInfo');

  // 獲取當前小說的下載狀態
  const novelId = await getCurrentNovelId();
  if (novelId) {
    const result = await chrome.storage.local.get(`novel_${novelId}`);
    const savedProgress = result[`novel_${novelId}`];
    if (savedProgress) {
      updateUIState(downloadBtn, saveBtn, status, progress, progressBar, progressText, chapterInfo, {
        downloading: false,
        progressValue: 0,
        statusText: '已有下載進度，點擊開始繼續下載',
        enableSave: true
      });
    }
  }

  downloadBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url.startsWith('https://czbooks.net/n/')) {
        throw new Error('請在 czbooks.net 的小說頁面使用此擴充功能');
      }

      updateUIState(downloadBtn, saveBtn, status, progress, progressBar, progressText, chapterInfo, {
        downloading: true,
        statusText: '正在準備下載...',
        enableSave: false
      });

      // 發送消息給 content script 開始下載
      chrome.tabs.sendMessage(tab.id, { action: 'startDownload' });
    } catch (error) {
      updateUIState(downloadBtn, saveBtn, status, progress, progressBar, progressText, chapterInfo, {
        downloading: false,
        statusText: error.message,
        statusClass: 'error',
        enableSave: false
      });
    }
  });

  saveBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // 顯示正在保存的UI狀態
      updateUIState(downloadBtn, saveBtn, status, progress, progressBar, progressText, chapterInfo, {
        downloading: true,
        statusText: '正在儲存當前進度...',
        statusClass: '',
        enableSave: false
      });
      
      chrome.tabs.sendMessage(tab.id, { action: 'saveProgress' });
    } catch (error) {
      updateUIState(downloadBtn, saveBtn, status, progress, progressBar, progressText, chapterInfo, {
        downloading: false,
        statusText: error.message,
        statusClass: 'error',
        enableSave: false
      });
    }
  });

  // 監聽來自 background script 的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'progress' && message.novelId === novelId) {
      updateUIState(downloadBtn, saveBtn, status, progress, progressBar, progressText, chapterInfo, {
        downloading: true,
        progressValue: message.value,
        enableSave: true,
        chapterInfo: `${message.current}/${message.total}`
      });
    } else if (message.type === 'status' && message.novelId === novelId) {
      updateUIState(downloadBtn, saveBtn, status, progress, progressBar, progressText, chapterInfo, {
        downloading: true,
        statusText: message.text,
        statusClass: message.class,
        enableSave: true
      });
    } else if (message.type === 'complete' && message.novelId === novelId) {
      updateUIState(downloadBtn, saveBtn, status, progress, progressBar, progressText, chapterInfo, {
        downloading: false,
        statusText: '下載完成！',
        statusClass: 'success',
        enableSave: false
      });
    } else if (message.type === 'partial_complete' && message.novelId === novelId) {
      updateUIState(downloadBtn, saveBtn, status, progress, progressBar, progressText, chapterInfo, {
        downloading: false,
        statusText: '已儲存當前進度！',
        statusClass: 'success',
        enableSave: true
      });
    } else if (message.type === 'error') {
      updateUIState(downloadBtn, saveBtn, status, progress, progressBar, progressText, chapterInfo, {
        downloading: false,
        statusText: message.error,
        statusClass: 'error',
        enableSave: true
      });
    }
  });
});
