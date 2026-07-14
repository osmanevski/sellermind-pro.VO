/* SellerMind Pro v1.2 — Background Service Worker
 * Product research = inline page scraping ONLY.
 * ZERO content scripts injected into Amazon/Easync.
 * ZERO files loaded on non-eBay pages.
 */

let researchFlow = null;
let flowTimer = null;
const FLOW_TIMEOUT = 30000;

// ===== Message Handling =====
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  if (request.action === "callClaude") {
    handleClaudeRequest(request)
      .then(r => sendResponse({ success: true, data: r }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (request.action === "startRufusFlow") {
    startProductResearch(request, sender);
    sendResponse({ status: "started" });
    return true;
  }

  if (request.action === "saveToHistory") {
    saveResponseHistory(request.data);
    sendResponse({ success: true });
    return true;
  }

  if (request.action === "getStats") {
    getResponseStats()
      .then(s => sendResponse({ success: true, data: s }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (request.action === "exportSettings") {
    exportAllSettings()
      .then(d => sendResponse({ success: true, data: d }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (request.action === "importSettings") {
    importAllSettings(request.data)
      .then(() => sendResponse({ success: true }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
});

// ===== Product Research =====
// 1. Find ASIN (Easync or Amazon search)
// 2. Open product page in background tab
// 3. Scrape product info with inline executeScript
// 4. Close tab, send data to eBay
// NO Rufus. NO file injection. Just scraping.

async function startProductResearch(request, sender) {
  if (researchFlow) cleanupFlow();

  researchFlow = {
    ebayTabId: sender.tab.id,
    title: request.title,
    question: request.question,
    tabIds: []
  };

  flowTimer = setTimeout(() => {
    if (researchFlow) {
      sendToEbay({ answer: null, error: "Araştırma zaman aşımına uğradı." });
      cleanupFlow();
    }
  }, FLOW_TIMEOUT);

  try {
    const settings = await getSettings();
    let asin = null;

    if (settings.easyncStoreId) {
      asin = await findAsinFromEasync(settings.easyncStoreId, request.title);
    }
    if (!asin) {
      asin = await findAsinFromAmazonSearch(request.title);
    }
    if (!asin) {
      sendToEbay({ answer: null, error: "Amazon'da ürün bulunamadı." });
      cleanupFlow();
      return;
    }

    const productData = await scrapeAmazonProduct(asin);

    if (productData) {
      sendToEbay({ answer: productData, source: "scrape" });
    } else {
      sendToEbay({ answer: null, error: "Ürün bilgisi alınamadı." });
    }
    cleanupFlow();

  } catch (err) {
    sendToEbay({ answer: null, error: err.message });
    cleanupFlow();
  }
}

function sendToEbay(data) {
  if (!researchFlow) return;
  try {
    chrome.tabs.sendMessage(researchFlow.ebayTabId, {
      action: "rufusResult", ...data, question: researchFlow?.question
    });
  } catch(e) {}
}

// ===== Easync: Find ASIN (inline script) =====
function findAsinFromEasync(storeId, title) {
  return new Promise(resolve => {
    const url = `https://my.easync.io/stores/${storeId}/listings?listingsFilter=active&searchString=${encodeURIComponent(title)}`;
    chrome.tabs.create({ url, active: false }, tab => {
      researchFlow.tabIds.push(tab.id);
      waitForTab(tab.id, () => {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: function() {
            const rx = /[A-Z0-9]{10}/;
            for (const sel of ['a[href*="amzdrop.com/dp/"]','a[href*="amazon.com/dp/"]','[data-asin]']) {
              try {
                const el = document.querySelector(sel);
                if (!el) continue;
                if (el.dataset?.asin && rx.test(el.dataset.asin)) return el.dataset.asin;
                const h = el.href || el.closest('a')?.href || '';
                const m = h.match(/\/dp\/([A-Z0-9]{10})/i);
                if (m) return m[1].toUpperCase();
                const t = el.textContent?.trim();
                if (t && rx.test(t)) return t.match(rx)[0];
              } catch(e){}
            }
            for (const a of document.querySelectorAll('a[href]')) {
              const m = a.href.match(/\/dp\/([A-Z0-9]{10})/i);
              if (m) return m[1].toUpperCase();
            }
            return null;
          }
        }, results => {
          safeCloseTab(tab.id);
          resolve(results?.[0]?.result || null);
        });
      }, 8000);
    });
  });
}

// ===== Amazon Search: Find ASIN (inline script) =====
function findAsinFromAmazonSearch(title) {
  return new Promise(resolve => {
    const q = title.replace(/[^\w\s-]/g, '').substring(0, 80);
    const url = `https://www.amazon.com/s?k=${encodeURIComponent(q)}`;
    chrome.tabs.create({ url, active: false }, tab => {
      researchFlow.tabIds.push(tab.id);
      waitForTab(tab.id, () => {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: function() {
            for (const sel of ['[data-asin]:not([data-asin=""])','.s-result-item[data-asin]']) {
              const el = document.querySelector(sel);
              if (el?.dataset?.asin && /^[A-Z0-9]{10}$/i.test(el.dataset.asin))
                return el.dataset.asin.toUpperCase();
            }
            for (const a of document.querySelectorAll('a[href*="/dp/"]')) {
              const m = a.href.match(/\/dp\/([A-Z0-9]{10})/i);
              if (m) return m[1].toUpperCase();
            }
            return null;
          }
        }, results => {
          safeCloseTab(tab.id);
          resolve(results?.[0]?.result || null);
        });
      }, 6000);
    });
  });
}

// ===== Amazon Product Scraper (inline script) =====
function scrapeAmazonProduct(asin) {
  return new Promise(resolve => {
    const url = `https://www.amazon.com/dp/${asin}`;
    chrome.tabs.create({ url, active: false }, tab => {
      researchFlow.tabIds.push(tab.id);
      waitForTab(tab.id, () => {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: function() {
            const g = s => document.querySelector(s)?.textContent?.trim() || '';
            const title = g('#productTitle') || g('h1 span');
            const price = g('.a-price .a-offscreen') || g('#priceblock_ourprice') || g('.a-price-whole');
            const rating = g('#acrPopover .a-icon-alt');
            const bullets = [];
            document.querySelectorAll('#feature-bullets li span.a-list-item, #feature-bullets li').forEach(li => {
              const t = li.textContent?.trim();
              if (t && t.length > 5 && !t.includes('Make sure')) bullets.push(t);
            });
            const specs = {};
            document.querySelectorAll('#productDetails_techSpec_section_1 tr, #prodDetails tr, .a-keyvalue tr').forEach(tr => {
              const k = tr.querySelector('th, td:first-child')?.textContent?.trim();
              const v = tr.querySelector('td:last-child')?.textContent?.trim();
              if (k && v && k !== v) specs[k] = v;
            });
            document.querySelectorAll('#detailBullets_feature_div li').forEach(li => {
              const p = li.textContent?.trim()?.split(':');
              if (p?.length >= 2) specs[p[0].trim()] = p.slice(1).join(':').trim();
            });
            const desc = g('#productDescription p') || g('#productDescription');
            let txt = '';
            if (title) txt += 'Product: ' + title + '\n';
            if (price) txt += 'Price: ' + price + '\n';
            if (rating) txt += 'Rating: ' + rating + '\n';
            if (bullets.length) txt += '\nFeatures:\n' + bullets.slice(0, 8).map(b => '- ' + b).join('\n') + '\n';
            if (Object.keys(specs).length) {
              txt += '\nSpecs:\n';
              for (const [k,v] of Object.entries(specs)) txt += '- ' + k + ': ' + v + '\n';
            }
            if (desc) txt += '\nDescription: ' + desc.substring(0, 400) + '\n';
            return txt || null;
          }
        }, results => {
          safeCloseTab(tab.id);
          resolve(results?.[0]?.result || null);
        });
      }, 6000);
    });
  });
}

// ===== Helpers =====
function waitForTab(tabId, callback, maxWait = 6000) {
  let done = false;
  const finish = () => { if (!done) { done = true; callback(); } };
  chrome.tabs.onUpdated.addListener(function listener(tid, info) {
    if (tid === tabId && info.status === "complete") {
      chrome.tabs.onUpdated.removeListener(listener);
      setTimeout(finish, 1500);
    }
  });
  setTimeout(finish, maxWait + 2000);
}

function safeCloseTab(id) { try { chrome.tabs.remove(id); } catch(e) {} }

function cleanupFlow() {
  if (flowTimer) { clearTimeout(flowTimer); flowTimer = null; }
  if (researchFlow) { researchFlow.tabIds.forEach(safeCloseTab); researchFlow = null; }
}

// ===== OpenRouter API =====
async function handleClaudeRequest(req) {
  const s = await getSettings();
  if (!s.apiKey) throw new Error("OpenRouter API anahtarı ayarlanmamış.");
  const supportedModels = new Set([
    "google/gemini-3.1-flash-lite",
    "openai/gpt-5.4-mini",
    "anthropic/claude-haiku-4.5"
  ]);
  const requestedModel = req.model || s.model;
  const model = supportedModels.has(requestedModel) ? requestedModel : "google/gemini-3.1-flash-lite";
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${s.apiKey}`,
      "X-OpenRouter-Title": "SellerMind Pro"
    },
    body: JSON.stringify({
      model,
      max_tokens: req.maxTokens || 600,
      temperature: req.temperature || 0.3,
      messages: [
        { role: "system", content: req.systemPrompt },
        ...(req.messages || [])
      ]
    })
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e?.error?.message || `API hatası: ${res.status}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Model boş yanıt döndürdü.");
  return text;
}

// ===== Settings / History / Export =====
function getSettings() { return new Promise(r => chrome.storage.local.get(null, r)); }

function saveResponseHistory(entry) {
  chrome.storage.local.get(["responseHistory"], d => {
    const h = d.responseHistory || [];
    h.unshift({ ...entry, timestamp: Date.now() });
    if (h.length > 500) h.length = 500;
    chrome.storage.local.set({ responseHistory: h });
  });
}

function getResponseStats() {
  return new Promise(resolve => {
    chrome.storage.local.get(["responseHistory"], d => {
      const h = d.responseHistory || [];
      const now = Date.now(), day = 86400000;
      const s = { totalResponses: h.length, todayResponses: 0, weekResponses: 0, avgRating: 0, sentimentBreakdown: { positive: 0, negative: 0, neutral: 0 } };
      let rated = 0;
      h.forEach(e => {
        if (now - e.timestamp < day) s.todayResponses++;
        if (now - e.timestamp < day * 7) s.weekResponses++;
        if (e.rating) { s.avgRating += e.rating; rated++; }
        if (e.sentiment) s.sentimentBreakdown[e.sentiment]++;
      });
      if (rated) s.avgRating = (s.avgRating / rated).toFixed(1);
      resolve(s);
    });
  });
}

function exportAllSettings() {
  return new Promise(r => chrome.storage.local.get(null, d => { delete d.apiKey; r(d); }));
}

function importAllSettings(data) {
  return new Promise(r => chrome.storage.local.get(["apiKey"], c => {
    chrome.storage.local.set({ ...data, apiKey: c.apiKey }, r);
  }));
}

// ===== Shortcuts & Context Menu =====
chrome.commands.onCommand.addListener(cmd => {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: cmd });
  });
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "sellermind-reply",
    title: "SellerMind: Bu mesaja AI yanıt oluştur",
    contexts: ["selection"],
    documentUrlPatterns: ["*://*.ebay.com/*", "*://*.ebay.co.uk/*"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "sellermind-reply" && info.selectionText)
    chrome.tabs.sendMessage(tab.id, { action: "contextMenuReply", text: info.selectionText });
});
