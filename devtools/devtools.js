// 創建 DevTools 面板
chrome.devtools.panels.create(
  "網頁下載器", // 面板標題
  "", // 圖標路徑（空字符串表示沒有圖標）
  "devtools/panel.html", // 面板頁面的路徑
  (panel) => {
    console.log("網頁下載器面板已創建");
  }
);
