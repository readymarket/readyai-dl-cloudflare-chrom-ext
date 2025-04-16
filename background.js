// 監聽來自 content script 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 處理下載完成的消息
  if (message.type === 'downloadComplete') {
    chrome.runtime.sendMessage(message);
  }
});

// 監聽安裝事件
chrome.runtime.onInstalled.addListener(() => {
  console.log('網頁內容下載器已安裝');
});
