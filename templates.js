/* SellerMind Pro — Şablon Yöneticisi */

let templates = [];
let editIndex = -1;

const catIcons = { general: "📝", refund: "💰", shipping: "📦", return: "↩️", defective: "⚠️" };
const catLabels = { general: "Genel", refund: "İade", shipping: "Kargo", return: "Geri Gönderim", defective: "Arızalı" };

document.addEventListener("DOMContentLoaded", () => {
  loadTemplates();

  document.getElementById("addBtn").addEventListener("click", () => {
    editIndex = -1;
    clearEditor();
    document.getElementById("editorTitle").textContent = "Yeni Şablon";
  });

  document.getElementById("saveBtn").addEventListener("click", saveTemplate);
  document.getElementById("aiBtn").addEventListener("click", aiEnhance);
});

function loadTemplates() {
  chrome.storage.local.get(["templates"], (data) => {
    templates = data.templates || [];
    renderList();
  });
}

function renderList() {
  const list = document.getElementById("tplList");
  if (templates.length === 0) {
    list.innerHTML = `<div class="empty-msg">Henüz şablon yok. "Yeni" butonuna tıklayın.</div>`;
    return;
  }
  list.innerHTML = "";
  templates.forEach((t, i) => {
    const item = document.createElement("div");
    item.className = `tpl-item${i === editIndex ? " active" : ""}`;
    item.innerHTML = `
      <span class="tpl-icon">${catIcons[t.category] || "📝"}</span>
      <div class="tpl-info">
        <div class="tpl-name">${t.title}</div>
        <div class="tpl-cat">${catLabels[t.category] || "Genel"}</div>
      </div>
      <button class="tpl-del" data-i="${i}" title="Sil">✕</button>
    `;
    item.addEventListener("click", (e) => {
      if (e.target.closest(".tpl-del")) return;
      editIndex = i;
      loadEditor(t);
      renderList();
    });
    list.appendChild(item);
  });

  // Delete handlers
  list.querySelectorAll(".tpl-del").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.i);
      if (confirm(`"${templates[idx].title}" şablonunu silmek istediğinize emin misiniz?`)) {
        templates.splice(idx, 1);
        if (editIndex === idx) { editIndex = -1; clearEditor(); }
        else if (editIndex > idx) editIndex--;
        saveAll();
        renderList();
      }
    });
  });
}

function loadEditor(t) {
  document.getElementById("editorTitle").textContent = "Şablonu Düzenle";
  document.getElementById("tplName").value = t.title || "";
  document.getElementById("tplCategory").value = t.category || "general";
  document.getElementById("tplContent").value = t.content || "";
}

function clearEditor() {
  document.getElementById("tplName").value = "";
  document.getElementById("tplCategory").value = "general";
  document.getElementById("tplContent").value = "";
}

function saveTemplate() {
  const title = document.getElementById("tplName").value.trim();
  const category = document.getElementById("tplCategory").value;
  const content = document.getElementById("tplContent").value.trim();

  if (!title || !content) {
    alert("Şablon adı ve içerik zorunludur.");
    return;
  }

  const tpl = { title, category, content };

  if (editIndex >= 0) {
    templates[editIndex] = tpl;
  } else {
    templates.push(tpl);
    editIndex = templates.length - 1;
  }

  saveAll();
  renderList();
  showSaved();
}

function saveAll() {
  chrome.storage.local.set({ templates });
}

function showSaved() {
  const msg = document.getElementById("savedMsg");
  msg.style.display = "inline";
  setTimeout(() => { msg.style.display = "none"; }, 2000);
}

async function aiEnhance() {
  const content = document.getElementById("tplContent").value.trim();
  if (!content) { alert("Önce bir şablon içeriği yazın."); return; }

  const btn = document.getElementById("aiBtn");
  btn.textContent = "⏳ İyileştiriliyor...";
  btn.disabled = true;

  try {
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: "callClaude",
        systemPrompt: "You are a customer service writing expert. Improve the given eBay message template to be more professional, warm, and effective. Keep all {variables} intact. Output ONLY the improved message, nothing else.",
        messages: [{ role: "user", content: `Improve this template:\n${content}` }],
        temperature: 0.3,
        maxTokens: 500
      }, (res) => {
        if (res?.success) resolve(res.data);
        else reject(new Error(res?.error || "OpenRouter hatası"));
      });
    });

    document.getElementById("tplContent").value = response;
  } catch (err) {
    alert(`OpenRouter hatası: ${err.message}`);
  } finally {
    btn.textContent = "✨ AI ile İyileştir";
    btn.disabled = false;
  }
}
