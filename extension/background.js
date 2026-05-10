/**
 * background.js - Service Worker（标签数量角标更新）
 *
 * 兼容国内 Chromium 浏览器（千问、夸克、360、星愿等）。
 * 额外过滤了国产浏览器的内部页面 URL 前缀。
 */

async function updateBadge() {
  try {
    const tabs = await chrome.tabs.query({});

    const count = tabs.filter(t => {
      const url = t.url || '';
      return (
        !url.startsWith('chrome://') &&
        !url.startsWith('chrome-extension://') &&
        !url.startsWith('edge://') &&
        !url.startsWith('brave://') &&
        !url.startsWith('about:') &&
        // 国内浏览器内部页面
        !url.startsWith('quark://') &&
        !url.startsWith('uc://') &&
        !url.startsWith('qqbrowser://') &&
        !url.startsWith('se://') &&
        !url.startsWith('liebao://') &&
        !url.startsWith('2345://') &&
        !url.startsWith('sogou://') &&
        !url.startsWith('baidu://') &&
        !url.startsWith('qianwen://') &&
        !url.startsWith('tongyi://') &&
        !url.startsWith('dingtalk://') &&
        !url.startsWith('xwph://')
      );
    }).length;

    await chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });

    if (count === 0) return;

    let color;
    if (count <= 10) {
      color = '#3d7a4a';
    } else if (count <= 20) {
      color = '#b8892e';
    } else {
      color = '#b35a5a';
    }

    await chrome.action.setBadgeBackgroundColor({ color });

  } catch {
    chrome.action.setBadgeText({ text: '' });
  }
}

chrome.runtime.onInstalled.addListener(() => updateBadge());
chrome.runtime.onStartup.addListener(() => updateBadge());
chrome.tabs.onCreated.addListener(() => updateBadge());
chrome.tabs.onRemoved.addListener(() => updateBadge());
chrome.tabs.onUpdated.addListener(() => updateBadge());

updateBadge();
