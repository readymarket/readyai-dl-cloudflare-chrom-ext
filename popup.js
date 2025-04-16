// 解析網址清單
function parseUrlList(text) {
  // 以斷行分隔輸入文字
  return text
    .split('\n')
    .map(line => {
      // 移除前後空白
      let trimmed = line.trim();
      if (!trimmed) return null;
      
      // 嘗試提取網址
      let url = extractUrl(trimmed);
      if (!url) return null;
      
      // 移除錨點 (#後面的部分)
      return removeAnchor(url);
    })
    .filter(url => url !== null);
}

// 從文字中提取網址
function extractUrl(text) {
  // 正則表達式匹配網址模式
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = text.match(urlRegex);
  
  if (matches && matches.length > 0) {
    return matches[0]; // 返回第一個匹配的網址
  }
  
  // 如果沒有匹配到標準網址，但文字包含可能的網域
  if (text.includes('.') && !text.includes(' ')) {
    // 檢查是否缺少協議前綴
    if (!text.startsWith('http://') && !text.startsWith('https://')) {
      return 'https://' + text; // 添加https://前綴
    }
    return text;
  }
  
  return null;
}

// 移除網址中的錨點
function removeAnchor(url) {
  try {
    const urlObj = new URL(url);
    urlObj.hash = ''; // 移除錨點
    return urlObj.toString();
  } catch (e) {
    // 如果URL解析失敗，直接移除#後面的部分
    const hashIndex = url.indexOf('#');
    if (hashIndex !== -1) {
      return url.substring(0, hashIndex);
    }
    return url;
  }
}

// 更新UI狀態
function updateUIState(downloadBtn, clearBtn, status, progress, progressBar, progressText, urlInfo, state) {
  if (state.downloading) {
    downloadBtn.disabled = true;
    clearBtn.disabled = true;
    progress.style.display = 'block';
    if (state.progressValue !== undefined) {
      progressBar.value = state.progressValue;
      progressText.textContent = `${state.progressValue}%`;
    }
    if (state.statusText) {
      status.textContent = state.statusText;
      status.className = state.statusClass || '';
    }
    if (state.urlInfo) {
      urlInfo.textContent = state.urlInfo;
    }
  } else {
    downloadBtn.disabled = false;
    clearBtn.disabled = false;
    if (!state.downloading) {
      progress.style.display = 'none';
    }
    if (state.statusText) {
      status.textContent = state.statusText;
      status.className = state.statusClass || '';
    } else {
      status.textContent = '';
      status.className = '';
    }
  }
}

// 獲取網頁內容的函數定義（與 content.js 中的相同）
async function getPageContent() {
  try {
    if (document.querySelector('#challenge-form')) {
      throw new Error('遇到 Cloudflare 驗證，請稍後再試');
    }

    // 移除不需要的元素
    const elementsToRemove = [
      'script',
      'style',
      'iframe',
      'noscript',
      'img',
      'svg',
      'video',
      'audio'
    ];

    const tempDoc = document.cloneNode(true);
    elementsToRemove.forEach(tag => {
      const elements = tempDoc.getElementsByTagName(tag);
      while (elements.length > 0) {
        elements[0].parentNode.removeChild(elements[0]);
      }
    });

    // 獲取所有可見文字內容
    const content = Array.from(tempDoc.body.getElementsByTagName('*'))
      .map(element => {
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return '';
        }
        return element.textContent;
      })
      .filter(text => text.trim())
      .join('\n')
      .trim();

    return content;
  } catch (error) {
    throw new Error(`獲取網頁內容失敗: ${error.message}`);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  const urlList = document.getElementById('urlList');
  const downloadBtn = document.getElementById('downloadBtn');
  const clearBtn = document.getElementById('clearBtn');
  const status = document.getElementById('status');
  const progress = document.querySelector('.progress');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  const urlInfo = document.getElementById('urlInfo');
  const delayMin = document.getElementById('delayMin');
  const delayMax = document.getElementById('delayMax');

  // 清除按鈕事件
  clearBtn.addEventListener('click', () => {
    urlList.value = '';
    status.textContent = '';
    status.className = '';
    progress.style.display = 'none';
  });

  // 下載按鈕事件
  downloadBtn.addEventListener('click', async () => {
    try {
      const urls = parseUrlList(urlList.value);
      if (urls.length === 0) {
        throw new Error('請輸入至少一個有效的網址');
      }

      updateUIState(downloadBtn, clearBtn, status, progress, progressBar, progressText, urlInfo, {
        downloading: true,
        statusText: '正在處理網頁...',
        progressValue: 0
      });

      let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n<documents>\n';
      let completedUrls = 0;

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        try {
          // 創建新的分頁並注入content script
          const tab = await chrome.tabs.create({ url, active: false });
          
          // 等待頁面載入完成
          await new Promise(resolve => {
            chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
              if (tabId === tab.id && info.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
              }
            });
          });

          // 獲取HTTP狀態碼
          let httpStatus = 0;
          try {
            const [statusResult] = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              function: () => {
                return window.performance
                  .getEntries()
                  .filter(entry => entry.entryType === 'navigation')
                  .map(entry => ({ type: entry.type, status: entry.responseStatus }))[0]?.status || 0;
              }
            });
            httpStatus = statusResult.result || 0;
          } catch (error) {
            console.error('無法獲取HTTP狀態碼:', error);
          }

          // 輸出HTTP狀態碼和網址
          console.log(`HTTP狀態碼: ${httpStatus}, 網址: ${url}`);

          // 根據設定的時間間隔等待
          const minDelay = parseInt(delayMin.value, 10) * 1000;
          const maxDelay = parseInt(delayMax.value, 10) * 1000;
          const waitTime = Math.random() * (maxDelay - minDelay) + minDelay;
          
          updateUIState(downloadBtn, clearBtn, status, progress, progressBar, progressText, urlInfo, {
            downloading: true,
            statusText: `等待 ${(waitTime / 1000).toFixed(1)} 秒...`,
            urlInfo: url
          });
          
          await new Promise(resolve => setTimeout(resolve, waitTime));

          // 執行 content script 並獲取內容
          const [result] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: getPageContent
          });

          // 關閉分頁
          await chrome.tabs.remove(tab.id);

          // 更新 XML 內容
          const content = result.result || '';
          xmlContent += `  <document index="${i + 1}">\n`;
          xmlContent += `    <source>${url.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</source>\n`;
          xmlContent += `    <document_content>\n${content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}\n    </document_content>\n`;
          xmlContent += `  </document>\n`;

          completedUrls++;
          const progress = Math.round((completedUrls / urls.length) * 100);
          
          updateUIState(downloadBtn, clearBtn, status, progress, progressBar, progressText, urlInfo, {
            downloading: true,
            statusText: `正在處理: ${completedUrls}/${urls.length}`,
            progressValue: progress,
            urlInfo: url
          });
        } catch (error) {
          console.error(`Error processing ${url}:`, error);
          xmlContent += `  <document index="${i + 1}">\n`;
          xmlContent += `    <source>${url.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</source>\n`;
          xmlContent += `    <document_content>Error: ${error.message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</document_content>\n`;
          xmlContent += `  </document>\n`;
        }
      }

      xmlContent += '</documents>';

      // 創建並下載 XML 文件
      const blob = new Blob([xmlContent], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      await chrome.downloads.download({
        url: url,
        filename: `webpage_contents_${timestamp}.xml`,
        saveAs: true
      });

      updateUIState(downloadBtn, clearBtn, status, progress, progressBar, progressText, urlInfo, {
        downloading: false,
        statusText: '下載完成！',
        statusClass: 'success'
      });
    } catch (error) {
      console.error('Error:', error);
      updateUIState(downloadBtn, clearBtn, status, progress, progressBar, progressText, urlInfo, {
        downloading: false,
        statusText: `錯誤: ${error.message}`,
        statusClass: 'error'
      });
    }
  });
});
