/* SellerMind Pro — Popup Script (Türkçe) */

document.addEventListener("DOMContentLoaded", () => {

  // Tab switching
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");
      if (tab.dataset.tab === "stats") loadStats();
    });
  });

  // Load settings
  const fields = ["apiKey", "anthropicApiKey", "storeName", "repName", "shippingPolicy", "handlingPolicy", "returnPolicy", "discountLimit"];
  
  chrome.storage.local.get(fields, (data) => {
    fields.forEach(f => {
      const el = document.getElementById(f);
      if (el && data[f]) el.value = data[f];
    });
  });

  // Save settings
  document.getElementById("saveSettings").addEventListener("click", () => {
    const data = {};
    ["apiKey", "anthropicApiKey", "storeName", "repName"].forEach(f => {
      const val = document.getElementById(f)?.value?.trim();
      if (val) data[f] = val;
    });
    chrome.storage.local.set(data, () => {
      showStatus("settingsStatus", "✅ Ayarlar kaydedildi!", "ok");
    });
  });

  // Save policies
  document.getElementById("savePolicies").addEventListener("click", () => {
    const data = {};
    ["shippingPolicy", "handlingPolicy", "returnPolicy", "discountLimit"].forEach(f => {
      const val = document.getElementById(f)?.value?.trim();
      if (val) data[f] = val;
    });
    chrome.storage.local.set(data, () => {
      showStatus("policiesStatus", "✅ Politikalar kaydedildi!", "ok");
    });
  });

  // Templates
  document.getElementById("openTemplates").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL("templates.html") });
  });

  // Export
  document.getElementById("exportBtn").addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "exportSettings" }, (res) => {
      if (res?.success) {
        const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `sellermind-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  });

  // Import
  document.getElementById("importBtn").addEventListener("click", () => {
    document.getElementById("importFile").click();
  });

  document.getElementById("importFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        chrome.runtime.sendMessage({ action: "importSettings", data }, (res) => {
          if (res?.success) {
            showStatus("settingsStatus", "✅ Yedek başarıyla yüklendi!", "ok");
            setTimeout(() => location.reload(), 800);
          }
        });
      } catch {
        showStatus("settingsStatus", "❌ Geçersiz dosya formatı", "err");
      }
    };
    reader.readAsText(file);
  });

  // ===== Product list CSV (eBay item id -> Amazon ASIN) =====
  const productMapInfo = document.getElementById("productMapInfo");

  function renderProductMapInfo() {
    chrome.storage.local.get(["productMapMeta"], (d) => {
      const m = d.productMapMeta;
      if (m && m.count) {
        const when = m.importedAt ? new Date(m.importedAt).toLocaleDateString("tr-TR") : "";
        productMapInfo.textContent = `✅ ${m.count} ürün eşlemesi yüklü${when ? " · " + when : ""}.`;
      } else {
        productMapInfo.textContent = "Henüz ürün listesi yüklenmedi.";
      }
    });
  }
  renderProductMapInfo();

  // Minimal RFC-4180 CSV parser: handles quoted fields, embedded commas,
  // escaped "" quotes, CRLF, and a leading BOM.
  function parseCSV(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const rows = [];
    let row = [], field = "", inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += c;
      } else if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c !== "\r") field += c;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  document.getElementById("loadCsvBtn").addEventListener("click", () => {
    document.getElementById("productCsv").click();
  });

  document.getElementById("productCsv").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    productMapInfo.textContent = "⏳ CSV işleniyor...";
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const rows = parseCSV(String(ev.target.result));
        if (!rows.length) throw new Error("boş");
        const header = rows[0].map(h => h.trim().toLowerCase());
        const asinIdx = header.indexOf("source product id");
        const ebayIdx = header.indexOf("target product id");
        if (asinIdx === -1 || ebayIdx === -1) {
          productMapInfo.textContent = "❌ CSV başlıklarında 'Source Product Id' / 'Target Product Id' bulunamadı.";
          return;
        }
        const map = {};
        for (let r = 1; r < rows.length; r++) {
          const asin = (rows[r][asinIdx] || "").trim().toUpperCase();
          const ebayId = (rows[r][ebayIdx] || "").trim();
          if (/^[A-Z0-9]{10}$/.test(asin) && /^\d{6,15}$/.test(ebayId)) map[ebayId] = asin;
        }
        const count = Object.keys(map).length;
        if (!count) {
          productMapInfo.textContent = "❌ Geçerli eBay no ↔ ASIN eşleşmesi bulunamadı.";
          return;
        }
        chrome.storage.local.set({
          productMap: map,
          productMapMeta: { count, fileName: file.name, importedAt: Date.now() }
        }, () => {
          renderProductMapInfo();
          showStatus("settingsStatus", `✅ ${count} ürün eşlemesi yüklendi!`, "ok");
        });
      } catch (err) {
        productMapInfo.textContent = "❌ CSV okunamadı: " + (err.message || err);
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  });

  document.getElementById("clearCsvBtn").addEventListener("click", () => {
    chrome.storage.local.remove(["productMap", "productMapMeta"], () => {
      renderProductMapInfo();
      showStatus("settingsStatus", "🗑️ Ürün listesi temizlendi.", "ok");
    });
  });

  // Stats
  function loadStats() {
    chrome.runtime.sendMessage({ action: "getStats" }, (res) => {
      if (!res?.success) return;
      const s = res.data;
      document.getElementById("statTotal").textContent = s.totalResponses || 0;
      document.getElementById("statToday").textContent = s.todayResponses || 0;
      document.getElementById("statWeek").textContent = s.weekResponses || 0;
      document.getElementById("sentPos").textContent = s.sentimentBreakdown?.positive || 0;
      document.getElementById("sentNeg").textContent = s.sentimentBreakdown?.negative || 0;
      document.getElementById("sentNeu").textContent = s.sentimentBreakdown?.neutral || 0;
      document.getElementById("statRating").textContent = s.avgRating > 0 ? s.avgRating : "-";
    });
  }

  function showStatus(id, msg, type) {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.className = `status ${type}`;
    setTimeout(() => { el.className = "status"; }, 3000);
  }
});
