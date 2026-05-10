/**
 * Tab Out - 国内版 Popup 逻辑
 * 点击扩展图标弹出快速面板，可查看/关闭标签页，或打开完整 Dashboard。
 */

// ─── 国内浏览器内部协议 ───
const BROWSER_INTERNAL_PREFIXES = [
  'chrome://', 'chrome-extension://', 'about:',
  'quark://', 'uc://', 'qqbrowser://', 'se://',
  'liebao://', '2345://', 'sogou://', 'baidu://',
  'qianwen://', 'tongyi://', 'dingtalk://', 'xwph://',
];

function isInternalUrl(url) {
  return BROWSER_INTERNAL_PREFIXES.some(p => url.startsWith(p));
}

// ─── 友好域名映射 ───
const FRIENDLY_DOMAINS = {
  'www.bilibili.com': 'B站', 'bilibili.com': 'B站',
  'www.zhihu.com': '知乎', 'zhihu.com': '知乎',
  'weibo.com': '微博', 'www.weibo.com': '微博',
  'www.douyin.com': '抖音', 'douyin.com': '抖音',
  'www.xiaohongshu.com': '小红书', 'xiaohongshu.com': '小红书',
  'www.taobao.com': '淘宝', 'taobao.com': '淘宝',
  'www.jd.com': '京东', 'jd.com': '京东',
  'www.feishu.cn': '飞书', 'feishu.cn': '飞书',
  'www.dingtalk.com': '钉钉', 'dingtalk.com': '钉钉',
  'tongyi.aliyun.com': '通义千问',
  'chatglm.cn': '智谱清言',
  'kimi.moonshot.cn': 'Kimi',
  'www.doubao.com': '豆包', 'doubao.com': '豆包',
  'www.baidu.com': '百度', 'baidu.com': '百度',
  'www.google.com': 'Google', 'google.com': 'Google',
  'www.youtube.com': 'YouTube', 'youtube.com': 'YouTube',
  'github.com': 'GitHub',
  'www.notion.so': 'Notion', 'notion.so': 'Notion',
  'mail.qq.com': 'QQ邮箱',
  'mail.google.com': 'Gmail',
  'www.163.com': '网易', '163.com': '网易',
  'www.toutiao.com': '今日头条', 'toutiao.com': '今日头条',
  'www.csdn.net': 'CSDN', 'csdn.net': 'CSDN',
  'juejin.cn': '掘金',
  'segmentfault.com': '思否',
  'www.npmjs.com': 'npm',
  'stackoverflow.com': 'StackOverflow',
  'docs.qq.com': '腾讯文档',
  'shimo.im': '石墨文档',
  'www.figma.com': 'Figma',
  'www.canva.cn': 'Canva',
  'claude.ai': 'Claude',
  'chat.openai.com': 'ChatGPT',
  'www.twitter.com': 'X', 'twitter.com': 'X', 'x.com': 'X',
  'mp.weixin.qq.com': '公众号',
};

function getFriendlyDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    return FRIENDLY_DOMAINS[hostname] || hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

// ─── 字符串转颜色 ───
function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < (str || '').length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 50%, 65%)`;
}

// ─── Favicon：只用首字母占位，彻底杜绝裂图 ───
function makeFavicon(text, size) {
  const s = size || 16;
  const fs = Math.round(s * 0.6);
  const span = document.createElement('span');
  span.style.cssText = `display:inline-flex;align-items:center;justify-content:center;width:${s}px;height:${s}px;border-radius:3px;font-size:${fs}px;font-weight:600;color:#fff;line-height:1;flex-shrink:0;`;
  span.textContent = (text || '?')[0].toUpperCase();
  span.style.backgroundColor = stringToColor(text);
  return span;
}

// ─── 时间问候 ───
function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 12) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

function getDateDisplay() {
  const now = new Date();
  const opts = { month: 'long', day: 'numeric', weekday: 'long' };
  return now.toLocaleDateString('zh-CN', opts);
}

// ─── 主逻辑 ───
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('greeting').textContent = getGreeting();
  document.getElementById('dateDisplay').textContent = getDateDisplay();

  const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTabId = currentTab?.id;

  const tabs = await chrome.tabs.query({ currentWindow: true });
  const webTabs = tabs.filter(t => !isInternalUrl(t.url));

  document.getElementById('statTabs').textContent = webTabs.length;

  const btnCloseAll = document.getElementById('btnCloseAll');
  if (webTabs.length > 1) {
    btnCloseAll.style.display = 'inline-flex';
  }

  if (webTabs.length === 0) {
    document.getElementById('popupEmpty').style.display = 'block';
    document.getElementById('popupTabs').style.display = 'none';
  } else {
    // 按域名分组
    const groups = {};
    webTabs.forEach(tab => {
      const domain = getFriendlyDomain(tab.url);
      if (!groups[domain]) groups[domain] = [];
      groups[domain].push(tab);
    });

    const container = document.getElementById('popupTabs');
    const sortedDomains = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length);

    sortedDomains.forEach(domain => {
      const groupTabs = groups[domain];

      if (groupTabs.length > 1 || sortedDomains.length > 1) {
        const title = document.createElement('div');
        title.className = 'tab-group-title';
        title.textContent = domain;
        container.appendChild(title);
      }

      groupTabs.forEach(tab => {
        const item = document.createElement('div');
        item.className = 'tab-item' + (tab.id === currentTabId ? ' active' : '');

        // 首字母 favicon，永不裂图
        const favicon = makeFavicon(domain, 16);

        const titleEl = document.createElement('span');
        titleEl.className = 'tab-title';
        titleEl.textContent = tab.title || tab.url;

        const domainSpan = document.createElement('span');
        domainSpan.className = 'tab-domain';
        domainSpan.textContent = domain;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'tab-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          chrome.tabs.remove(tab.id);
          item.style.opacity = '0';
          setTimeout(() => item.remove(), 150);
          const count = container.querySelectorAll('.tab-item').length;
          document.getElementById('statTabs').textContent = Math.max(0, count - 1);
        });

        item.appendChild(favicon);
        item.appendChild(titleEl);
        item.appendChild(domainSpan);
        item.appendChild(closeBtn);

        item.addEventListener('click', () => {
          chrome.tabs.update(tab.id, { active: true });
          window.close();
        });

        container.appendChild(item);
      });
    });
  }

  // ─── 固定快捷栏 ───
  loadPinnedBar();

  // ─── 打开完整面板 ───
  document.getElementById('btnOpenDashboard').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
    window.close();
  });

  // ─── 关闭全部 ───
  document.getElementById('btnCloseAll').addEventListener('click', async () => {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const webTabs = tabs.filter(t => !isInternalUrl(t.url) && !t.active);
    await chrome.tabs.remove(webTabs.map(t => t.id));
    window.close();
  });
});

// ─── 固定栏逻辑 ───
async function loadPinnedBar() {
  const bar = document.getElementById('pinnedBar');
  const { pinned = [] } = await chrome.storage.local.get('pinned');

  if (window.CUSTOM_SHORTCUTS && window.CUSTOM_SHORTCUTS.length > 0) {
    pinned.length = 0;
    pinned.push(...window.CUSTOM_SHORTCUTS);
  }

  if (pinned.length === 0) {
    try {
      const history = await chrome.history.search({
        text: '',
        startTime: Date.now() - 30 * 24 * 60 * 60 * 1000,
        maxResults: 100
      });

      const domainCount = {};
      history.forEach(h => {
        if (isInternalUrl(h.url)) return;
        try {
          const host = new URL(h.url).hostname;
          domainCount[host] = (domainCount[host] || 0) + h.visitCount;
        } catch {}
      });

      const topDomains = Object.entries(domainCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);

      if (topDomains.length > 0) {
        topDomains.forEach(([domain]) => {
          const name = FRIENDLY_DOMAINS[domain] || FRIENDLY_DOMAINS[`www.${domain}`] || domain.replace(/^www\./, '');
          const url = `https://${domain}`;
          addPinnedItem(bar, name, url);
        });
      }
    } catch {}
    return;
  }

  pinned.forEach(item => {
    addPinnedItem(bar, item.name, item.url);
  });
}

function addPinnedItem(bar, name, url) {
  const el = document.createElement('a');
  el.className = 'pinned-item';
  el.href = '#';

  // 首字母 favicon
  const favicon = makeFavicon(name, 14);

  const label = document.createElement('span');
  label.textContent = name;

  el.appendChild(favicon);
  el.appendChild(label);
  el.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url });
    window.close();
  });
  bar.appendChild(el);
}
