/**
 * pinned.js - 固定快捷方式栏（国内浏览器适配版）
 *
 * 变更：Favicon 改用首字母彩色占位，杜绝裂图。
 */

const PIN_MAX           = 8;
const SUGGEST_LOOKBACK  = 30;
const SUGGEST_MIN_VISITS = 8;
const SUGGEST_TOP_N     = 3;

async function getPins() {
  const { pinnedItems = [] } = await chrome.storage.local.get('pinnedItems');
  return pinnedItems;
}

async function setPins(pins) {
  await chrome.storage.local.set({ pinnedItems: pins });
}

async function getSuggestSkip() {
  const { pinSuggestSkip = [] } = await chrome.storage.local.get('pinSuggestSkip');
  return pinSuggestSkip;
}

async function addSuggestSkip(domain) {
  const skip = await getSuggestSkip();
  if (!skip.includes(domain)) {
    skip.push(domain);
    await chrome.storage.local.set({ pinSuggestSkip: skip });
  }
}

function pinFaviconHTML(name, size) {
  size = size || 24;
  const fs = Math.round(size * 0.5);
  const letter = (name || '?')[0].toUpperCase();
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  const color = `hsl(${hue}, 50%, 65%)`;
  return `<span style="display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:6px;font-size:${fs}px;font-weight:600;color:#fff;line-height:1;flex-shrink:0;background:${color};">${letter}</span>`;
}

function hostnameOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url; }
}

function normalizeUrl(raw) {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return 'https://' + trimmed;
}

function pinId() {
  return 'pin_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

async function renderPinnedBar() {
  const bar = document.getElementById('pinnedBar');
  if (!bar) return;
  const pins = await getPins();

  const tiles = pins.map(pin => {
    return `<button class="pin-tile"
            data-action="pin-open"
            data-pin-id="${pin.id}"
            data-pin-url="${escapeAttr(pin.url)}"
            title="${escapeAttr(pin.name)} — ${escapeAttr(hostnameOf(pin.url))}"
            aria-label="${escapeAttr(pin.name)}">
      ${pinFaviconHTML(pin.name, 24)}
      <span class="pin-tile-label">${escapeHtml(pin.name)}</span>
      <span class="pin-tile-edit" data-action="pin-edit" data-pin-id="${pin.id}" title="编辑">⋯</span>
    </button>`;
  }).join('');

  const addTile = pins.length < PIN_MAX
    ? `<button class="pin-tile pin-tile-add" data-action="pin-add" title="添加固定" aria-label="添加固定">
         <span class="pin-tile-plus">+</span>
       </button>`
    : '';

  bar.innerHTML = tiles + addTile;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function escapeAttr(s) { return escapeHtml(s); }

let editingPinId = null;

function openPinModal(pin = null) {
  editingPinId = pin ? pin.id : null;
  document.getElementById('pinModalTitle').textContent = pin ? '编辑固定项' : '添加固定项';
  document.getElementById('pinName').value = pin ? pin.name : '';
  document.getElementById('pinUrl').value  = pin ? pin.url  : '';
  document.getElementById('pinName').placeholder = '如：B站';
  document.getElementById('pinUrl').placeholder = 'https://www.bilibili.com';

  const actions = document.querySelector('.pin-modal-actions');
  const existingDelete = actions.querySelector('[data-action="pin-modal-delete"]');
  if (pin && !existingDelete) {
    const del = document.createElement('button');
    del.className = 'pin-btn-danger';
    del.dataset.action = 'pin-modal-delete';
    del.textContent = '删除';
    actions.insertBefore(del, actions.firstChild);
  } else if (!pin && existingDelete) {
    existingDelete.remove();
  }

  const modal = document.getElementById('pinModal');
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  setTimeout(() => document.getElementById('pinName').focus(), 50);
}

function closePinModal() {
  const modal = document.getElementById('pinModal');
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  editingPinId = null;
}

async function savePinFromModal() {
  const name = document.getElementById('pinName').value.trim();
  const url  = normalizeUrl(document.getElementById('pinUrl').value);
  if (!name || !url) {
    const target = !name ? 'pinName' : 'pinUrl';
    const el = document.getElementById(target);
    el.classList.add('pin-field-error');
    setTimeout(() => el.classList.remove('pin-field-error'), 600);
    return;
  }
  const pins = await getPins();
  if (editingPinId) {
    const idx = pins.findIndex(p => p.id === editingPinId);
    if (idx !== -1) pins[idx] = { ...pins[idx], name, url };
  } else {
    if (pins.length >= PIN_MAX) return;
    pins.push({ id: pinId(), name, url, createdAt: Date.now() });
  }
  await setPins(pins);
  closePinModal();
  await renderPinnedBar();
}

async function deletePinFromModal() {
  if (!editingPinId) return;
  const pins = (await getPins()).filter(p => p.id !== editingPinId);
  await setPins(pins);
  closePinModal();
  await renderPinnedBar();
  await renderSuggestions();
}

async function computeTopDomains() {
  if (!chrome.history || !chrome.history.search) return [];
  const startTime = Date.now() - SUGGEST_LOOKBACK * 24 * 60 * 60 * 1000;
  const items = await chrome.history.search({ text: '', startTime, maxResults: 5000 });
  const counts = {};
  for (const item of items) {
    const host = hostnameOf(item.url || '');
    if (!host || host.includes('localhost')) continue;
    if (host.startsWith('chrome') || host.startsWith('newtab')) continue;
    counts[host] = (counts[host] || 0) + (item.visitCount || 1);
  }
  return Object.entries(counts)
    .map(([domain, visits]) => ({ domain, visits }))
    .sort((a, b) => b.visits - a.visits);
}

async function renderSuggestions() {
  const box = document.getElementById('pinSuggest');
  if (!box) return;
  const [pins, skip, top] = await Promise.all([
    getPins(), getSuggestSkip(), computeTopDomains(),
  ]);
  const pinnedHosts = new Set(pins.map(p => hostnameOf(p.url)));
  const skipSet     = new Set(skip);
  const suggestions = top
    .filter(t => t.visits >= SUGGEST_MIN_VISITS)
    .filter(t => !pinnedHosts.has(t.domain))
    .filter(t => !skipSet.has(t.domain))
    .slice(0, SUGGEST_TOP_N);

  if (suggestions.length === 0 || pins.length >= PIN_MAX) {
    box.style.display = 'none';
    box.innerHTML = '';
    return;
  }

  box.innerHTML = `
    <span class="pin-suggest-label">💡 推荐固定：</span>
    ${suggestions.map(s => {
      return `<span class="pin-suggest-item">
        ${pinFaviconHTML(s.domain, 16)}
        <span class="pin-suggest-name">${escapeHtml(s.domain)}</span>
        <span class="pin-suggest-count">(${s.visits})</span>
        <button class="pin-suggest-btn" data-action="pin-suggest-accept" data-domain="${escapeAttr(s.domain)}">固定</button>
        <button class="pin-suggest-dismiss" data-action="pin-suggest-dismiss" data-domain="${escapeAttr(s.domain)}" title="不再推荐">×</button>
      </span>`;
    }).join('')}
  `;
  box.style.display = 'flex';
}

async function acceptSuggestion(domain) {
  const pins = await getPins();
  if (pins.length >= PIN_MAX) return;
  pins.push({
    id: pinId(),
    name: domain.split('.')[0].replace(/^\w/, c => c.toUpperCase()),
    url: 'https://' + domain,
    createdAt: Date.now(),
  });
  await setPins(pins);
  await renderPinnedBar();
  await renderSuggestions();
}

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  switch (action) {
    case 'pin-open': {
      if (e.target.closest('[data-action="pin-edit"]')) return;
      const url = el.dataset.pinUrl;
      if (url) chrome.tabs.create({ url });
      return;
    }
    case 'pin-edit': {
      e.stopPropagation();
      const pins = await getPins();
      const pin = pins.find(p => p.id === el.dataset.pinId);
      if (pin) openPinModal(pin);
      return;
    }
    case 'pin-add': openPinModal(null); return;
    case 'pin-modal-close': closePinModal(); return;
    case 'pin-modal-save': await savePinFromModal(); return;
    case 'pin-modal-delete': await deletePinFromModal(); return;
    case 'pin-suggest-accept': await acceptSuggestion(el.dataset.domain); return;
    case 'pin-suggest-dismiss': await addSuggestSkip(el.dataset.domain); await renderSuggestions(); return;
  }
});

document.addEventListener('keydown', (e) => {
  const modalOpen = document.getElementById('pinModal')?.classList.contains('is-open');
  if (!modalOpen) return;
  if (e.key === 'Enter')  { e.preventDefault(); savePinFromModal(); }
  if (e.key === 'Escape') { e.preventDefault(); closePinModal(); }
});

window.initPinned = async function initPinned() {
  await renderPinnedBar();
  renderSuggestions();
};
