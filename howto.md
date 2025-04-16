# Chrome DevTools 網頁下載外掛開發指南

本文檔總結了開發 Chrome DevTools 網頁下載外掛的關鍵技術和解決方案，特別適合新手工程師學習參考。

## 目錄

1. [專案概述](#專案概述)
2. [關鍵技術](#關鍵技術)
3. [開發流程與最佳實踐](#開發流程與最佳實踐)
4. [排程訪問實作](#排程訪問實作)
5. [常見問題與解決方案](#常見問題與解決方案)
6. [除錯技巧](#除錯技巧)
7. [效能優化](#效能優化)

## 專案概述

這是一個 Chrome DevTools 網頁下載外掛，主要功能包括：

- 從輸入框中讀取網址清單，每行一個網址
- 支持處理非標準網址格式，自動添加 https:// 前綴
- 自動移除網址中的錨點（# 後面的部分）
- 可調整網頁抓取的時間間隔（最小延遲和最大延遲）
- 在控制台輸出區域顯示網址抓取的 HTTP 狀態碼與網址
- 將抓取的 HTML 內容轉換為 Markdown 格式
- 將所有內容整合為 XML 格式並下載

## 關鍵技術

### 1. Chrome 擴充功能架構

- **manifest.json**: 擴充功能的核心配置文件，定義了權限、資源和行為
- **DevTools 面板**: 通過 `devtools_page` 配置，創建自定義 DevTools 面板
- **內容腳本**: 在網頁上下文中執行的 JavaScript，用於獲取頁面內容

```javascript
// manifest.json 中的 DevTools 配置
{
  "devtools_page": "devtools/devtools.html"
}
```

### 2. Chrome API 使用

- **chrome.tabs**: 管理瀏覽器分頁
- **chrome.scripting**: 在網頁上下文中執行腳本
- **chrome.downloads**: 下載文件

```javascript
// 注入腳本到分頁
await chrome.scripting.executeScript({
  target: { tabId: tab.id },
  files: ['devtools/turndown.js']
});

// 在分頁中執行函數
const [result] = await chrome.scripting.executeScript({
  target: { tabId: tab.id },
  func: myFunction
});

// 下載文件
await chrome.downloads.download({
  url: blobUrl,
  filename: `webpage_contents_${timestamp}.xml`,
  saveAs: true
});
```

### 3. HTML 轉 Markdown

使用 Turndown 庫將 HTML 內容轉換為 Markdown 格式：

```javascript
// 初始化 Turndown 服務
const turndownService = new TurndownService({
  headingStyle: 'atx',       // ## 標題樣式
  hr: '---',                 // 水平線
  bulletListMarker: '-',     // 無序列表使用 -
  codeBlockStyle: 'fenced',  // ```代碼塊樣式```
  emDelimiter: '*'           // *斜體*
});

// 移除不需要的元素
turndownService.remove(['script', 'style', 'iframe', 'noscript']);

// 轉換 HTML 到 Markdown
const markdown = turndownService.turndown(htmlContent);
```

### 4. 網址處理

```javascript
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
```

## 開發流程與最佳實踐

### 1. 從彈出式視窗到 DevTools 面板的轉換

將原本的彈出式視窗擴充功能改為 DevTools 面板擴充功能：

1. 修改 manifest.json，移除 action 區塊，添加 devtools_page
2. 創建 DevTools 相關文件結構：
   - devtools/devtools.html - 初始化 DevTools 面板的入口頁面
   - devtools/devtools.js - 創建和註冊 DevTools 面板
   - devtools/panel.html - DevTools 面板的 UI 界面
   - devtools/panel.js - DevTools 面板的主要邏輯

### 2. 單一分頁處理多個網址

優化工作流程，使用單一分頁訪問所有網址：

```javascript
// 創建一個固定的分頁來處理所有網址
const tab = await chrome.tabs.create({ url: 'about:blank', active: false });

for (let i = 0; i < urls.length; i++) {
  // 在現有分頁中導航到新網址
  await chrome.tabs.update(tab.id, { url: urls[i] });
  
  // 等待頁面載入完成
  await new Promise(resolve => {
    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
      if (tabId === tab.id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    });
  });
  
  // 處理當前頁面...
}

// 處理完所有網址後關閉分頁
await chrome.tabs.remove(tab.id);
```

### 3. HTTP 狀態碼過濾

根據 HTTP 狀態碼決定是否收錄頁面：

```javascript
// 獲取HTTP狀態碼
const [statusResult] = await chrome.scripting.executeScript({
  target: { tabId: tab.id },
  function: () => {
    return window.performance
      .getEntries()
      .filter(entry => entry.entryType === 'navigation')
      .map(entry => ({ type: entry.type, status: entry.responseStatus }))[0]?.status || 0;
  }
});
const httpStatus = statusResult.result || 0;

// 如果是 404 或 429 等錯誤狀態碼，跳過處理
if (httpStatus === 404 || httpStatus === 429) {
  addLog(`跳過處理，狀態碼 ${httpStatus} 不符合收錄條件`, 'error');
  throw new Error(`狀態碼 ${httpStatus} 不符合收錄條件`);
}
```

## 排程訪問實作

在這個專案中，我們實現了一個智能的排程訪問系統，避免被目標網站識別為機器人或爬蟲。以下是主要的實現方式：

### 1. 隨機延遲訪問

為了模擬真實用戶行為，我們在每個網址訪問之間添加了隨機延遲：

```javascript
// 根據設定的時間間隔等待
const minDelay = parseInt(delayMin.value, 10) * 1000; // 最小延遲（秒）
const maxDelay = parseInt(delayMax.value, 10) * 1000; // 最大延遲（秒）

// 生成一個最小和最大延遲之間的隨機值
const waitTime = Math.random() * (maxDelay - minDelay) + minDelay;

// 更新 UI 顯示等待狀態
updateUIState(downloadBtn, clearBtn, status, progress, progressBar, progressText, urlInfo, {
  downloading: true,
  statusText: `等待 ${(waitTime / 1000).toFixed(1)} 秒...`,
  urlInfo: url
});

addLog(`等待 ${(waitTime / 1000).toFixed(1)} 秒...`, 'info');

// 實際等待指定的時間
await new Promise(resolve => setTimeout(resolve, waitTime));
```

### 2. 可調整的延遲參數

我們在用戶界面中提供了可調整的延遲參數，允許用戶根據需求調整訪問間隔：

```html
<div class="settings">
  <label for="delayMin">最小延遲 (秒):</label>
  <input type="number" id="delayMin" min="1" max="30" value="2" />
  <label for="delayMax">最大延遲 (秒):</label>
  <input type="number" id="delayMax" min="1" max="30" value="5" />
</div>
```

### 3. 進度與狀態追蹤

為了讓用戶知道目前的訪問進度，我們實現了詳細的進度追蹤和狀態更新：

```javascript
// 更新進度條和狀態信息
const progressPercentage = Math.round((completedUrls / urls.length) * 100);

updateUIState(downloadBtn, clearBtn, status, progress, progressBar, progressText, urlInfo, {
  downloading: true,
  statusText: `正在處理: ${completedUrls}/${urls.length}`,
  progressValue: progressPercentage,
  urlInfo: url
});

addLog(`完成處理: ${url}`, 'success');
```

### 4. 錯誤處理與重試機制

我們為每個網址訪問添加了錯誤處理，確保即使某個網址訪問失敗，也不會影響整個排程的執行：

```javascript
try {
  // 處理當前網址
  // ...
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
```

這種排程訪問的實現方式能有效地模擬人類用戶的瀏覽行為，降低被網站封鎖的風險，同時也為用戶提供了靈活的控制選項。

## 常見問題與解決方案

### 1. 內容腳本中的函數無法訪問 DevTools 面板中的函數

**問題**: 在內容腳本中調用 `addLog` 等 DevTools 面板中定義的函數時出錯。

**解決方案**: 內容腳本運行在獨立的上下文中，無法直接訪問 DevTools 面板中的函數。應該使用消息傳遞或在內容腳本中重新定義這些函數。

```javascript
// 在內容腳本中使用 console.log 和 console.error
console.log('這是內容腳本中的日誌');

// 在 DevTools 面板中攔截內容腳本的日誌
await chrome.scripting.executeScript({
  target: { tabId: tab.id },
  function: () => {
    window.__debugLogs = [];
    window.__errorLogs = [];
    
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

// 從內容腳本中擷取日誌
const [debugLogsResult] = await chrome.scripting.executeScript({
  target: { tabId: tab.id },
  function: () => window.__debugLogs || []
});
```

### 2. 外部庫在內容腳本中無法使用

**問題**: 在內容腳本中使用 Turndown 等外部庫時，發現庫未定義。

**解決方案**: 需要顯式地注入外部庫到內容腳本中。

```javascript
// 注入 turndown.js 腳本
await chrome.scripting.executeScript({
  target: { tabId: tab.id },
  files: ['devtools/turndown.js']
});
```

### 3. Cloudflare 保護的網站處理

**問題**: 遇到 Cloudflare 保護的網站時無法自動獲取內容。

**解決方案**: 檢測 Cloudflare 驗證頁面，並提供適當的錯誤信息。

```javascript
if (document.querySelector('#challenge-form')) {
  throw new Error('遇到 Cloudflare 驗證，請稍後再試');
}
```

## 除錯技巧

### 1. 自定義控制台輸出區域

在擴充功能面板中創建一個控制台輸出區域，用於顯示日誌和錯誤信息：

```javascript
// 添加日誌到控制台輸出區域
function addLog(message, type = 'info') {
  const consoleOutput = document.getElementById('consoleOutput');
  const logItem = document.createElement('div');
  logItem.className = `log-item ${type}`;
  logItem.textContent = message;
  consoleOutput.appendChild(logItem);
  consoleOutput.scrollTop = consoleOutput.scrollHeight; // 自動滾動到底部
}
```

### 2. 攔截 console.log 和 console.error

攔截 console.log 和 console.error 方法，將輸出重定向到控制台輸出區域：

```javascript
// 攔截 console.error 輸出
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
```

### 3. 詳細的錯誤報告

提供詳細的錯誤信息，包括錯誤類型、錯誤消息和堆疊跟踪：

```javascript
try {
  // 嘗試執行可能失敗的代碼
} catch (error) {
  console.error(`錯誤類型: ${error.name}`);
  console.error(`錯誤消息: ${error.message}`);
  console.error(`錯誤堆疊: ${error.stack}`);
}
```

## 效能優化

### 1. 使用單一分頁處理多個網址

避免為每個網址創建新分頁，減少資源消耗：

```javascript
// 創建一個固定的分頁
const tab = await chrome.tabs.create({ url: 'about:blank', active: false });

// 在這個分頁中依次處理所有網址
for (const url of urls) {
  await chrome.tabs.update(tab.id, { url });
  // 處理頁面...
}

// 處理完成後關閉分頁
await chrome.tabs.remove(tab.id);
```

### 2. 使用適當的延遲避免被封鎖

添加可配置的延遲時間，避免過快請求導致被網站封鎖：

```javascript
// 根據設定的時間間隔等待
const minDelay = parseInt(delayMin.value, 10) * 1000;
const maxDelay = parseInt(delayMax.value, 10) * 1000;
const waitTime = Math.random() * (maxDelay - minDelay) + minDelay;

await new Promise(resolve => setTimeout(resolve, waitTime));
```

### 3. 移除不必要的 HTML 元素

在處理 HTML 內容時，移除不必要的元素以提高轉換效率：

```javascript
// 移除不需要的元素
turndownService.remove(['script', 'style', 'iframe', 'noscript', 'img', 'svg', 'video', 'audio']);
```

---

希望這份指南能幫助您更好地理解和開發 Chrome DevTools 擴充功能。如有任何問題，歡迎隨時提問！
