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
  const fields = ["apiKey", "model", "storeName", "repName", "easyncStoreId", "shippingPolicy", "handlingPolicy", "returnPolicy", "discountLimit"];
  
  chrome.storage.local.get(fields, (data) => {
    const supportedModels = [
      "google/gemini-3.1-flash-lite",
      "openai/gpt-5.4-mini",
      "anthropic/claude-haiku-4.5"
    ];
    fields.forEach(f => {
      const el = document.getElementById(f);
      if (el && data[f]) el.value = data[f];
    });
    if (!supportedModels.includes(data.model)) {
      document.getElementById("model").value = "google/gemini-3.1-flash-lite";
    }
  });

  // Save settings
  document.getElementById("saveSettings").addEventListener("click", () => {
    const data = {};
    ["apiKey", "model", "storeName", "repName", "easyncStoreId"].forEach(f => {
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
