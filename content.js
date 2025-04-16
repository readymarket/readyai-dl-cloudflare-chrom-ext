// 隨機延遲函數
function delay(min, max) {
  const ms = Math.random() * (max - min) + min;
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 檢查是否有 Cloudflare 驗證
function hasCloudflareChallenge() {
  return document.querySelector('#challenge-form') !== null;
}

// 獲取網頁內容
async function getPageContent() {
  try {
    if (hasCloudflareChallenge()) {
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
