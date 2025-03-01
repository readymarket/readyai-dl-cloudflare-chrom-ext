// 監聽來自 content script 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 轉發消息給所有標籤頁
  if (message.type === 'progress' || 
      message.type === 'status' || 
      message.type === 'complete' || 
      message.type === 'partial_complete' || 
      message.type === 'error') {
    chrome.runtime.sendMessage(message);
  }
});

// 監聽安裝事件
chrome.runtime.onInstalled.addListener(() => {
  // 清除所有已存儲的進度
  chrome.storage.local.clear();
  console.log('擴充功能已安裝，清除所有存儲的進度');
});
