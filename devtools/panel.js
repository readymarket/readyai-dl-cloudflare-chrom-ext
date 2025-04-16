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

// 添加日誌到控制台輸出區域
function addLog(message, type = 'info') {
  const consoleOutput = document.getElementById('consoleOutput');
  const logItem = document.createElement('div');
  logItem.className = `log-item ${type}`;
  logItem.textContent = message;
  consoleOutput.appendChild(logItem);
  consoleOutput.scrollTop = consoleOutput.scrollHeight; // 自動滾動到底部
}

// 攔截 console.error 輸出並添加到控制台輸出區域
function setupConsoleErrorInterception() {
  const originalConsoleError = console.error;
  console.error = function() {
    // 調用原始的 console.error 方法
    originalConsoleError.apply(console, arguments);
    
    // 將錯誤信息添加到控制台輸出區域
    const errorMessage = Array.from(arguments).map(arg => {
      if (arg instanceof Error) {
        return `${arg.name}: ${arg.message}\n${arg.stack}`;
      } else if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return String(arg);
        }
      } else {
        return String(arg);
      }
    }).join(' ');
    
    addLog(`錯誤: ${errorMessage}`, 'error');
  };
  
  // 攔截 console.log 輸出
  const originalConsoleLog = console.log;
  console.log = function() {
    // 調用原始的 console.log 方法
    originalConsoleLog.apply(console, arguments);
    
    // 將日誌信息添加到控制台輸出區域
    const logMessage = Array.from(arguments).map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return String(arg);
        }
      } else {
        return String(arg);
      }
    }).join(' ');
    
    addLog(`日誌: ${logMessage}`, 'info');
  };
}

// 在內容腳本中執行的獲取網頁內容函數
async function getPageContent() {
  console.log('開始執行 getPageContent 函數');
  try {
    if (document.querySelector('#challenge-form')) {
      throw new Error('遇到 Cloudflare 驗證，請稍後再試');
    }

    // 檢查 TurndownService 是否可用
    console.log('檢查 TurndownService 是否可用...');
    if (typeof TurndownService === 'undefined') {
      const errorMsg = 'TurndownService 未定義，turndown.js 可能未正確加載';
      console.error(errorMsg);
      throw new Error(errorMsg);
    } else {
      console.log('TurndownService 已找到');
    }

    // 使用 Turndown 將 HTML 轉換為 Markdown
    try {
      // 初始化 Turndown 服務
      console.log('初始化 TurndownService...');
      const turndownService = new TurndownService({
        headingStyle: 'atx',       // ## 標題樣式
        hr: '---',                 // 水平線
        bulletListMarker: '-',      // 無序列表使用 -
        codeBlockStyle: 'fenced',   // ```代碼塊樣式```
        emDelimiter: '*'            // *斜體*
      });
      addLog('【除錯】TurndownService 初始化成功', 'info');
      
      // 移除不需要的元素
      console.log('設置要移除的元素...');
      turndownService.remove(['script', 'style', 'iframe', 'noscript']);
      
      // 檢查 document.body 是否存在
      if (!document.body) {
        const errorMsg = '【重要錯誤】無法獲取頁面內容: document.body 不存在';
        console.error(errorMsg);
        addLog(errorMsg, 'error');
        throw new Error(errorMsg);
      }
      
      // 檢查 document.body.innerHTML 是否有內容
      console.log('檢查頁面內容...');
      const htmlContent = document.body.innerHTML;
      if (!htmlContent || htmlContent.trim() === '') {
        const errorMsg = '頁面內容為空';
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
      
      // 輸出 HTML 內容的部分信息用於除錯
      const contentPreview = htmlContent.substring(0, 100) + '...';
      console.log(`HTML 內容預覽 (前100字符): ${contentPreview}`);
      console.log(`HTML 內容長度: ${htmlContent.length} 字符`);
      
      // 將網頁內容轉換為 Markdown
      console.log('開始轉換 HTML 到 Markdown...');
      try {
        // 檢查 TurndownService 是否正確定義
        if (typeof TurndownService !== 'function') {
          console.error(`TurndownService 不是一個函數，而是: ${typeof TurndownService}`);
          throw new Error(`TurndownService 不是一個函數，而是: ${typeof TurndownService}`);
        }
        
        // 檢查 turndownService 是否正確定義
        if (!turndownService || typeof turndownService.turndown !== 'function') {
          console.error(`turndownService.turndown 不是一個函數: ${turndownService}`);
          throw new Error(`turndownService.turndown 不是一個函數`);
        }
        
        const markdown = turndownService.turndown(htmlContent);
        console.log('HTML 到 Markdown 轉換成功');
        console.log(`Markdown 內容長度: ${markdown.length} 字符`);
        return markdown;
      } catch (turndownError) {
        const errorMsg = `Turndown.turndown() 方法執行失敗: ${turndownError.message}`;
        console.error(errorMsg);
        console.error(`錯誤類型: ${turndownError.name}`);
        console.error(`錯誤堆疊: ${turndownError.stack}`);
        throw turndownError;
      }
    } catch (tdError) {
      console.error('Turndown 轉換失敗，詳細錯誤:', tdError);
      console.error('錯誤堆疊:', tdError.stack);
      addLog(`【重要錯誤】Markdown 轉換失敗: ${tdError.message}`, 'error');
      
      // 如果 Turndown 失敗，回退到原始的文字提取方法
      addLog('【除錯】嘗試使用備用文字提取方法...', 'info');
      const elementsToRemove = [
        'script', 'style', 'iframe', 'noscript', 'img', 'svg', 'video', 'audio'
      ];

      try {
        addLog('【除錯】克隆文檔...', 'info');
        const tempDoc = document.cloneNode(true);
        
        if (!tempDoc.body) {
          const errorMsg = '【重要錯誤】備用方法失敗: tempDoc.body 不存在';
          console.error(errorMsg);
          addLog(errorMsg, 'error');
          return '**錯誤: 無法獲取頁面內容，document.body 不存在**';
        }
        
        addLog('【除錯】開始移除不需要的元素...', 'info');
        elementsToRemove.forEach(tag => {
          try {
            const elements = tempDoc.getElementsByTagName(tag);
            const count = elements.length;
            addLog(`【除錯】移除 ${tag} 元素: ${count} 個`, 'info');
            while (elements.length > 0) {
              elements[0].parentNode.removeChild(elements[0]);
            }
          } catch (removeError) {
            addLog(`【錯誤】移除 ${tag} 元素失敗: ${removeError.message}`, 'error');
          }
        });

        // 獲取所有可見文字內容
        addLog('【除錯】開始提取文字內容...', 'info');
        let elementCount = 0;
        let visibleElementCount = 0;
        
        const content = Array.from(tempDoc.body.getElementsByTagName('*'))
          .map(element => {
            elementCount++;
            try {
              const style = window.getComputedStyle(element);
              if (style.display === 'none' || style.visibility === 'hidden') {
                return '';
              }
              visibleElementCount++;
              return element.textContent;
            } catch (styleError) {
              addLog(`【錯誤】獲取元素樣式失敗: ${styleError.message}`, 'error');
              return element.textContent || '';
            }
          })
          .filter(text => text.trim())
          .join('\n')
          .trim();

        addLog(`【除錯】處理了 ${elementCount} 個元素，其中 ${visibleElementCount} 個可見`, 'info');
        addLog(`【除錯】提取的文字內容長度: ${content.length} 字符`, 'info');
        addLog('【除錯】備用文字提取方法完成', 'info');
        
        const errorSummary = `**Note: Markdown conversion failed, falling back to plain text**\n\n` +
                           `**錯誤原因: ${tdError.message}**\n\n`;
        
        return errorSummary + content;
      } catch (backupError) {
        const errorMsg = `【重要錯誤】備用文字提取方法失敗: ${backupError.message}`;
        console.error(errorMsg);
        addLog(errorMsg, 'error');
        addLog(`【除錯】錯誤堆疊: ${backupError.stack}`, 'error');
        return '**錯誤: Markdown 轉換失敗，備用方法也失敗。詳細錯誤請查看控制台**';
      }
    }
  } catch (error) {
    const errorMsg = `【重要錯誤】獲取網頁內容總體失敗: ${error.message}`;
    console.error(errorMsg);
    addLog(errorMsg, 'error');
    addLog(`【除錯】錯誤堆疊: ${error.stack}`, 'error');
    throw new Error(`獲取網頁內容失敗: ${error.message}`);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  // 設置 console.error 攔截
  setupConsoleErrorInterception();
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
    
    // 清除控制台輸出區域
    const consoleOutput = document.getElementById('consoleOutput');
    consoleOutput.innerHTML = '<div class="log-item info">已清除。準備就緒，請輸入網址清單...</div>';
  });

  // 下載按鈕事件
  downloadBtn.addEventListener('click', async () => {
    try {
      const urls = parseUrlList(urlList.value);
      if (urls.length === 0) {
        throw new Error('請輸入至少一個有效的網址');
      }

      addLog(`開始處理 ${urls.length} 個網址`, 'info');
      
      updateUIState(downloadBtn, clearBtn, status, progress, progressBar, progressText, urlInfo, {
        downloading: true,
        statusText: '正在處理網頁...',
        progressValue: 0
      });

      let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n<documents>\n';
      let completedUrls = 0;
      
      // 創建一個固定的分頁來處理所有網址
      const tab = await chrome.tabs.create({ url: 'about:blank', active: false });
      addLog(`創建了一個工作分頁 (ID: ${tab.id})`, 'info');

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        try {
          addLog(`處理網址: ${url}`, 'info');
          
          // 在現有分頁中導航到新網址
          await chrome.tabs.update(tab.id, { url: url });
          
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
            addLog(`無法獲取HTTP狀態碼: ${error.message}`, 'error');
          }

          // 輸出HTTP狀態碼和網址
          const statusMessage = `HTTP狀態碼: ${httpStatus}, 網址: ${url}`;
          console.log(statusMessage);
          
          // 根據狀態碼設定不同的日誌類型
          let logType = 'info';
          if (httpStatus >= 200 && httpStatus < 300) {
            logType = 'success';
          } else if (httpStatus >= 400) {
            logType = 'error';
          }
          addLog(statusMessage, logType);
          
          // 如果是 404 或 429 等錯誤狀態碼，跳過處理
          if (httpStatus === 404 || httpStatus === 429) {
            addLog(`跳過處理，狀態碼 ${httpStatus} 不符合收錄條件`, 'error');
            throw new Error(`狀態碼 ${httpStatus} 不符合收錄條件`);
          }

          // 根據設定的時間間隔等待
          const minDelay = parseInt(delayMin.value, 10) * 1000;
          const maxDelay = parseInt(delayMax.value, 10) * 1000;
          const waitTime = Math.random() * (maxDelay - minDelay) + minDelay;
          
          updateUIState(downloadBtn, clearBtn, status, progress, progressBar, progressText, urlInfo, {
            downloading: true,
            statusText: `等待 ${(waitTime / 1000).toFixed(1)} 秒...`,
            urlInfo: url
          });
          
          addLog(`等待 ${(waitTime / 1000).toFixed(1)} 秒...`, 'info');
          await new Promise(resolve => setTimeout(resolve, waitTime));

          // 執行 content script 並獲取內容
          addLog(`【除錯】在分頁 ${tab.id} 中執行 getPageContent 函數...`, 'info');
          
          // 首先注入 turndown.js 腳本
          addLog('【除錯】注入 turndown.js 腳本...', 'info');
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['devtools/turndown.js']
            });
            addLog('【除錯】turndown.js 腳本注入成功', 'info');
          } catch (injectError) {
            addLog(`【重要錯誤】注入 turndown.js 失敗: ${injectError.message}`, 'error');
            throw injectError;
          }
          
          // 注入一個用於在內容腳本中記錄日誌的函數
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: () => {
              // 在內容腳本中設置全局變數來存儲日誌
              window.__debugLogs = [];
              window.__errorLogs = [];
              
              // 攔截內容腳本中的 console.log 和 console.error
              const originalConsoleLog = console.log;
              console.log = function() {
                originalConsoleLog.apply(console, arguments);
                window.__debugLogs.push(Array.from(arguments).join(' '));
              };
              
              const originalConsoleError = console.error;
              console.error = function() {
                originalConsoleError.apply(console, arguments);
                window.__errorLogs.push(Array.from(arguments).join(' '));
              };
            }
          });
          
          // 執行內容腳本中的函數
          let result;
          try {
            [result] = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: () => {
                try {
                  console.log('在內容腳本中執行頁面內容擷取');
                  
                  // 檢查 TurndownService 是否存在
                  if (typeof TurndownService === 'undefined') {
                    console.error('TurndownService 未定義，turndown.js 可能未正確加載');
                    throw new Error('TurndownService 未定義');
                  }
                  
                  // 檢查頁面是否有 Cloudflare 驗證
                  if (document.querySelector('#challenge-form')) {
                    throw new Error('遇到 Cloudflare 驗證，請稍後再試');
                  }
                  
                  // 初始化 Turndown 服務
                  console.log('初始化 TurndownService...');
                  const turndownService = new TurndownService({
                    headingStyle: 'atx',       // ## 標題樣式
                    hr: '---',                 // 水平線
                    bulletListMarker: '-',      // 無序列表使用 -
                    codeBlockStyle: 'fenced',   // ```代碼塊樣式```
                    emDelimiter: '*'            // *斜體*
                  });
                  
                  // 移除不需要的元素
                  console.log('設置要移除的元素...');
                  turndownService.remove(['script', 'style', 'iframe', 'noscript']);
                  
                  // 檢查 document.body 是否存在
                  if (!document.body) {
                    console.error('無法獲取頁面內容: document.body 不存在');
                    throw new Error('無法獲取頁面內容: document.body 不存在');
                  }
                  
                  // 檢查 document.body.innerHTML 是否有內容
                  console.log('檢查頁面內容...');
                  const htmlContent = document.body.innerHTML;
                  if (!htmlContent || htmlContent.trim() === '') {
                    console.error('頁面內容為空');
                    throw new Error('頁面內容為空');
                  }
                  
                  // 輸出 HTML 內容的部分信息用於除錯
                  const contentPreview = htmlContent.substring(0, 100) + '...';
                  console.log(`HTML 內容預覽 (前100字符): ${contentPreview}`);
                  console.log(`HTML 內容長度: ${htmlContent.length} 字符`);
                  
                  // 將網頁內容轉換為 Markdown
                  console.log('開始轉換 HTML 到 Markdown...');
                  try {
                    const markdown = turndownService.turndown(htmlContent);
                    console.log('HTML 到 Markdown 轉換成功');
                    console.log(`Markdown 內容長度: ${markdown.length} 字符`);
                    return markdown;
                  } catch (turndownError) {
                    console.error(`Turndown 轉換失敗: ${turndownError.message}`);
                    console.error(`錯誤堆疊: ${turndownError.stack}`);
                    
                    // 如果 Turndown 失敗，回退到原始的文字提取方法
                    console.log('嘗試使用備用文字提取方法...');
                    const elementsToRemove = [
                      'script', 'style', 'iframe', 'noscript', 'img', 'svg', 'video', 'audio'
                    ];

                    try {
                      const tempDoc = document.cloneNode(true);
                      
                      if (!tempDoc.body) {
                        console.error('備用方法失敗: tempDoc.body 不存在');
                        return '**錯誤: 無法獲取頁面內容，document.body 不存在**';
                      }
                      
                      elementsToRemove.forEach(tag => {
                        try {
                          const elements = tempDoc.getElementsByTagName(tag);
                          console.log(`移除 ${tag} 元素: ${elements.length} 個`);
                          while (elements.length > 0) {
                            elements[0].parentNode.removeChild(elements[0]);
                          }
                        } catch (removeError) {
                          console.error(`移除 ${tag} 元素失敗: ${removeError.message}`);
                        }
                      });

                      // 獲取所有可見文字內容
                      let elementCount = 0;
                      let visibleElementCount = 0;
                      
                      const content = Array.from(tempDoc.body.getElementsByTagName('*'))
                        .map(element => {
                          elementCount++;
                          try {
                            const style = window.getComputedStyle(element);
                            if (style.display === 'none' || style.visibility === 'hidden') {
                              return '';
                            }
                            visibleElementCount++;
                            return element.textContent;
                          } catch (styleError) {
                            console.error(`獲取元素樣式失敗: ${styleError.message}`);
                            return element.textContent || '';
                          }
                        })
                        .filter(text => text.trim())
                        .join('\n')
                        .trim();

                      console.log(`處理了 ${elementCount} 個元素，其中 ${visibleElementCount} 個可見`);
                      console.log(`提取的文字內容長度: ${content.length} 字符`);
                      console.log('備用文字提取方法完成');
                      
                      return '**Note: Markdown conversion failed, falling back to plain text**\n\n' +
                             `**錯誤原因: ${turndownError.message}**\n\n` + content;
                    } catch (backupError) {
                      console.error(`備用文字提取方法失敗: ${backupError.message}`);
                      return '**錯誤: Markdown 轉換失敗，備用方法也失敗**';
                    }
                  }
                } catch (error) {
                  console.error(`獲取網頁內容總體失敗: ${error.message}`);
                  return `**錯誤: ${error.message}**`;
                }
              }
            });
          } catch (scriptError) {
            addLog(`【重要錯誤】執行腳本失敗: ${scriptError.message}`, 'error');
            throw scriptError;
          }
          
          // 從內容腳本中擷取日誌
          try {
            const [debugLogsResult] = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              function: () => window.__debugLogs || []
            });
            
            const [errorLogsResult] = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              function: () => window.__errorLogs || []
            });
            
            // 顯示內容腳本中的日誌
            if (debugLogsResult.result && debugLogsResult.result.length > 0) {
              debugLogsResult.result.forEach(log => {
                addLog(`【內容腳本】${log}`, 'info');
              });
            }
            
            if (errorLogsResult.result && errorLogsResult.result.length > 0) {
              errorLogsResult.result.forEach(log => {
                addLog(`【內容腳本錯誤】${log}`, 'error');
              });
            }
          } catch (logsError) {
            addLog(`無法擷取內容腳本日誌: ${logsError.message}`, 'error');
          }

          // 不關閉分頁，因為我們會繼續使用它

          // 檢查結果是否有效
          if (!result || result.result === undefined) {
            addLog(`【重要錯誤】無法獲取頁面內容，結果為空`, 'error');
            throw new Error('無法獲取頁面內容，結果為空');
          }
          
          // 檢查內容是否為空
          const content = result.result || '';
          if (!content || content.trim() === '') {
            addLog(`【警告】獲取的內容為空`, 'error');
          } else {
            addLog(`【除錯】成功獲取內容，長度: ${content.length} 字符`, 'info');
          }
          
          // 更新 XML 內容
          xmlContent += `  <document index="${i + 1}">\n`;
          xmlContent += `    <source>${url.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</source>\n`;
          xmlContent += `    <format>markdown</format>\n`;
          xmlContent += `    <document_content>\n${content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}\n    </document_content>\n`;
          xmlContent += `  </document>\n`;

          completedUrls++;
          const progressPercentage = Math.round((completedUrls / urls.length) * 100);
          
          updateUIState(downloadBtn, clearBtn, status, progress, progressBar, progressText, urlInfo, {
            downloading: true,
            statusText: `正在處理: ${completedUrls}/${urls.length}`,
            progressValue: progressPercentage,
            urlInfo: url
          });
          
          addLog(`完成處理: ${url}`, 'success');
        } catch (error) {
          console.error(`Error processing ${url}:`, error);
          addLog(`處理錯誤 ${url}: ${error.message}`, 'error');
          
          // 如果是狀態碼不符合條件的錯誤，不收錄到 XML 中
          if (error.message.includes('狀態碼') && 
              (error.message.includes('404') || error.message.includes('429'))) {
            addLog(`不收錄到 XML 中: ${url}`, 'info');
            continue; // 跳過此網址，不收錄到 XML 中
          }
          
          // 其他錯誤仍然收錄到 XML 中
          xmlContent += `  <document index="${i + 1}">\n`;
          xmlContent += `    <source>${url.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</source>\n`;
          xmlContent += `    <format>text</format>\n`;
          xmlContent += `    <document_content>Error: ${error.message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</document_content>\n`;
          xmlContent += `  </document>\n`;
        }
      }

      xmlContent += '</documents>';

      // 關閉工作分頁
      await chrome.tabs.remove(tab.id);
      addLog(`關閉工作分頁`, 'info');

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
      
      addLog('所有網址處理完成，XML 檔案已下載', 'success');
    } catch (error) {
      console.error('Error:', error);
      addLog(`錯誤: ${error.message}`, 'error');
      updateUIState(downloadBtn, clearBtn, status, progress, progressBar, progressText, urlInfo, {
        downloading: false,
        statusText: `錯誤: ${error.message}`,
        statusClass: 'error'
      });
    }
  });
});
