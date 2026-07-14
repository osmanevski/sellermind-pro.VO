/* SellerMind Pro v1.2 — Türkçe Arayüz, Temiz Tasarım */

/* ===== State ===== */
const SM = {
  chatHistory: [],
  ebayContext: "",
  latestCustomerMsg: "",
  selectedText: "",
  currentTone: "professional",
  currentSentiment: "neutral",
  isDark: false,
  isMinimized: false,
  dragState: { isDragging: false, offsetX: 0, offsetY: 0 },
  rufusInProgress: false,
  rufusProgressTimer: null,
  tones: {
    professional: { label: "Profesyonel", emoji: "💼" },
    friendly: { label: "Samimi", emoji: "😊" },
    firm: { label: "Kararlı", emoji: "🛡️" },
    empathetic: { label: "Empatik", emoji: "💛" },
    concise: { label: "Kısa", emoji: "⚡" }
  }
};

/* ===== Widget ===== */
function injectWidget() {
  if (document.getElementById("sellermind-widget")) return;

  const widget = document.createElement("div");
  widget.id = "sellermind-widget";
  widget.innerHTML = `
    <div id="sm-header">
      <div id="sm-header-left">
        <div id="sm-header-logo">SM</div>
        <span id="sm-header-title">SellerMind Pro</span>
      </div>
      <div id="sm-header-actions">
        <button class="sm-hdr-btn" id="sm-btn-theme" title="Tema">🌙</button>
        <button class="sm-hdr-btn" id="sm-btn-minimize" title="Küçült">─</button>
        <button class="sm-hdr-btn" id="sm-btn-close" title="Kapat">✕</button>
      </div>
    </div>
    <div id="sm-context-bar">
      <span class="sm-dot neutral" id="sm-dot"></span>
      <span id="sm-context-text">Hazır — Bir müşteri mesajı seçin</span>
    </div>
    <div id="sm-tone-bar"></div>
    <div id="sm-messages"></div>
    <div id="sm-input-area">
      <textarea id="sm-input" placeholder="Nasıl yanıtlamamı istediğinizi yazın..." rows="1"></textarea>
      <button id="sm-send" title="Gönder">➤</button>
    </div>
    <div id="sm-char-count" style="display:none;">
      <span id="sm-char-num">0</span> / 2000 karakter
    </div>
    <div id="sm-edit-tooltip">
      <input type="text" id="sm-edit-input" placeholder="Nasıl değişsin? (opsiyonel)">
      <button id="sm-edit-submit">✨ Yeniden Yaz</button>
    </div>
  `;
  document.body.appendChild(widget);

  const fab = document.createElement("button");
  fab.id = "sm-fab";
  fab.innerHTML = "✦";
  fab.title = "SellerMind Pro (Alt+S)";
  document.body.appendChild(fab);

  initToneBar();
  bindEvents();
}

/* ===== Tone Bar ===== */
function initToneBar() {
  const bar = document.getElementById("sm-tone-bar");
  if (!bar) return;
  bar.innerHTML = "";
  Object.entries(SM.tones).forEach(([key, tone]) => {
    const chip = document.createElement("button");
    chip.className = `sm-tone${key === SM.currentTone ? " active" : ""}`;
    chip.dataset.tone = key;
    chip.textContent = `${tone.emoji} ${tone.label}`;
    chip.addEventListener("click", () => {
      SM.currentTone = key;
      bar.querySelectorAll(".sm-tone").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
    });
    bar.appendChild(chip);
  });
}

/* ===== Events ===== */
function bindEvents() {
  const widget = document.getElementById("sellermind-widget");
  const fab = document.getElementById("sm-fab");
  const input = document.getElementById("sm-input");
  const tooltip = document.getElementById("sm-edit-tooltip");

  fab.addEventListener("click", () => toggleWidget());

  document.getElementById("sm-btn-close").addEventListener("click", () => {
    widget.classList.remove("sm-visible");
    fab.classList.remove("hidden");
  });

  document.getElementById("sm-btn-minimize").addEventListener("click", () => {
    SM.isMinimized = !SM.isMinimized;
    widget.classList.toggle("sm-minimized", SM.isMinimized);
  });

  document.getElementById("sm-btn-theme").addEventListener("click", () => {
    SM.isDark = !SM.isDark;
    widget.classList.toggle("sm-dark", SM.isDark);
    document.getElementById("sm-btn-theme").textContent = SM.isDark ? "☀️" : "🌙";
    chrome.storage.local.set({ smDarkMode: SM.isDark });
  });

  chrome.storage.local.get(["smDarkMode"], (d) => {
    if (d.smDarkMode) {
      SM.isDark = true;
      widget.classList.add("sm-dark");
      document.getElementById("sm-btn-theme").textContent = "☀️";
    }
  });

  const send = () => {
    const text = input.value.trim();
    if (!text) return;
    appendMessage(text, "user");
    input.value = "";
    input.style.height = "auto";
    SM.chatHistory.push({ role: "user", content: text });
    requestAI();
  };

  document.getElementById("sm-send").addEventListener("click", send);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  });
  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 80) + "px";
  });

  // Inline edit via text selection
  const msgContainer = document.getElementById("sm-messages");
  msgContainer.addEventListener("mouseup", (e) => {
    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel.toString().trim();
      const parentMsg = sel.anchorNode?.parentElement?.closest(".sm-msg-ai");
      if (text.length > 2 && parentMsg) {
        SM.selectedText = text;
        const wRect = widget.getBoundingClientRect();
        let x = e.clientX - wRect.left;
        let y = e.clientY - wRect.top - 10;
        if (x + 220 > wRect.width) x = wRect.width - 230;
        if (y < 50) y = 50;
        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y}px`;
        tooltip.classList.add("visible");
        document.getElementById("sm-edit-input").value = "";
        document.getElementById("sm-edit-input").focus();
      }
    }, 10);
  });

  document.addEventListener("mousedown", (e) => {
    if (!tooltip.contains(e.target) && !e.target.closest(".sm-msg-ai")) tooltip.classList.remove("visible");
  });

  document.getElementById("sm-edit-submit").addEventListener("click", () => {
    const instruction = document.getElementById("sm-edit-input").value.trim();
    tooltip.classList.remove("visible");
    window.getSelection().removeAllRanges();
    const userPrompt = instruction
      ? `Bu kısmı değiştir: "${SM.selectedText}" — Talimat: ${instruction}`
      : `Bu kısmı farklı ifade et: "${SM.selectedText}"`;
    appendMessage(userPrompt, "user");
    SM.chatHistory.push({
      role: "user",
      content: `In the current draft, change this specific part: "${SM.selectedText}". Instruction: ${instruction || "Rephrase it differently"}. Rewrite the FULL message with this change applied. Output ONLY the final customer message.`
    });
    requestAI();
  });

  document.getElementById("sm-edit-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("sm-edit-submit").click();
  });

  // Draggable
  const header = document.getElementById("sm-header");
  header.addEventListener("mousedown", (e) => {
    if (e.target.closest(".sm-hdr-btn")) return;
    SM.dragState.isDragging = true;
    const rect = widget.getBoundingClientRect();
    SM.dragState.offsetX = e.clientX - rect.left;
    SM.dragState.offsetY = e.clientY - rect.top;
    widget.style.transition = "none";
  });
  document.addEventListener("mousemove", (e) => {
    if (!SM.dragState.isDragging) return;
    widget.style.left = `${Math.max(0, e.clientX - SM.dragState.offsetX)}px`;
    widget.style.top = `${Math.max(0, e.clientY - SM.dragState.offsetY)}px`;
    widget.style.right = "auto";
    widget.style.bottom = "auto";
  });
  document.addEventListener("mouseup", () => { SM.dragState.isDragging = false; widget.style.transition = ""; });

  // Messages from background
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "toggle-widget") toggleWidget();
    if (msg.action === "quick-reply") quickReplyLastMessage();
    if (msg.action === "contextMenuReply") { SM.latestCustomerMsg = msg.text; toggleWidget(true); startSession(null, msg.text); }
    if (msg.action === "rufusResult") handleRufusResult(msg);
  });

  // Close any open dropdown on outside click
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".sm-action-menu") && !e.target.closest(".sm-action-dropdown")) {
      document.querySelectorAll(".sm-action-dropdown").forEach(d => {
        d.style.display = "none";
        if (d.parentNode === document.body) d.remove();
      });
    }
  });
}

function toggleWidget(forceOpen = false) {
  const widget = document.getElementById("sellermind-widget");
  const fab = document.getElementById("sm-fab");
  if (forceOpen || !widget.classList.contains("sm-visible")) {
    widget.classList.add("sm-visible");
    fab.classList.add("hidden");
    SM.isMinimized = false;
    widget.classList.remove("sm-minimized");
  } else {
    widget.classList.remove("sm-visible");
    fab.classList.remove("hidden");
  }
}

/* ===== eBay Button Injection — Clean 2-Button Design ===== */
function injecteBayButtons() {
  const selectors = [
    ".app-conversation__message-bubble__message",
    ".m2m-message-bubble",
    ".message-bubble"
  ];
  let messages = [];
  selectors.forEach(s => { document.querySelectorAll(s).forEach(n => { if (!messages.includes(n)) messages.push(n); }); });

  messages.forEach(msgNode => {
    if (msgNode.dataset.smProcessed) return;
    msgNode.dataset.smProcessed = "true";

    const wrapper = document.createElement("div");
    wrapper.className = "sm-ebay-bar";

    // Primary: AI Yanıt
    const aiBtn = document.createElement("button");
    aiBtn.className = "sm-ebay-btn sm-primary";
    aiBtn.innerHTML = `<span class="sm-btn-icon">✦</span> AI Yanıt`;
    aiBtn.addEventListener("click", () => startSession(msgNode));

    // Secondary: Dropdown menu
    const menuWrap = document.createElement("div");
    menuWrap.className = "sm-action-menu";

    const menuBtn = document.createElement("button");
    menuBtn.className = "sm-ebay-btn sm-more";
    menuBtn.innerHTML = `⋯`;
    menuBtn.title = "Daha fazla işlem";

    const dropdown = document.createElement("div");
    dropdown.className = "sm-action-dropdown";

    const actions = [
      { icon: "🔍", label: "Ürün Araştır", action: () => startSession(msgNode, null, null, true) },
      { icon: "💰", label: "İade Teklifi", action: () => startSession(msgNode, null, "Offer a full refund politely") },
      { icon: "📦", label: "Değişim Teklifi", action: () => startSession(msgNode, null, "Offer a free replacement") },
      { icon: "🙏", label: "Özür Mesajı", action: () => startSession(msgNode, null, "Write a sincere apology") },
      { divider: true },
      { icon: "📋", label: "Şablonlar", action: () => { openTemplateMenu(dropdown, msgNode); } }
    ];

    actions.forEach(a => {
      if (a.divider) {
        const hr = document.createElement("div");
        hr.className = "sm-dropdown-divider";
        dropdown.appendChild(hr);
        return;
      }
      const item = document.createElement("button");
      item.className = "sm-dropdown-item";
      item.innerHTML = `<span class="sm-di-icon">${a.icon}</span>${a.label}`;
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdown.style.display = "none";
        if (dropdown.parentNode === document.body) dropdown.remove();
        a.action();
      });
      dropdown.appendChild(item);
    });

    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      // Close all open dropdowns
      document.querySelectorAll(".sm-action-dropdown").forEach(d => {
        d.style.display = "none";
        if (d.parentNode === document.body) d.remove();
      });
      
      // Position dropdown fixed on body with smart positioning
      const rect = menuBtn.getBoundingClientRect();
      const dropdownHeight = 280; // max-height value
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      let topPos;
      let bottomPos;
      
      // If enough space below, open down; otherwise open up
      if (spaceBelow > dropdownHeight + 20) {
        topPos = rect.bottom + 4;
        bottomPos = "auto";
      } else if (spaceAbove > dropdownHeight + 20) {
        topPos = "auto";
        bottomPos = window.innerHeight - rect.top + 4;
      } else {
        // Default to down if neither has enough space
        topPos = rect.bottom + 4;
        bottomPos = "auto";
      }
      
      dropdown.style.cssText = "display:block;position:fixed;top:" + (topPos === "auto" ? "auto" : topPos + "px") + ";bottom:" + (bottomPos === "auto" ? "auto" : bottomPos + "px") + ";left:" + rect.left + "px;z-index:2147483646;min-width:180px;max-height:280px;overflow-y:auto;background:#fff;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.15);padding:4px;";
      document.body.appendChild(dropdown);
    });

    menuWrap.appendChild(menuBtn);
    wrapper.appendChild(aiBtn);
    wrapper.appendChild(menuWrap);

    const parentBubble = msgNode.closest(
      ".app-conversation__message-bubble, .app-conversation__message, .m2m-message-container"
    ) || msgNode;
    if (parentBubble.dataset.smWrapper) return;
    parentBubble.dataset.smWrapper = "true";
    if (parentBubble.nextSibling) {
      parentBubble.parentNode.insertBefore(wrapper, parentBubble.nextSibling);
    } else {
      parentBubble.parentNode.appendChild(wrapper);
    }
  });
}

function openTemplateMenu(parentDropdown, msgNode) {
  // Close the dropdown menu first
  parentDropdown.style.display = "none";
  if (parentDropdown.parentNode === document.body) parentDropdown.remove();

  // Remove any old template popup
  var oldPopup = document.getElementById("sm-template-popup");
  if (oldPopup) oldPopup.remove();

  // Find the ⋯ button closest to this message for positioning
  var msgBar = msgNode ? msgNode.closest(".app-conversation__message-bubble, .app-conversation__message, .m2m-message-container") : null;
  var menuBtn = msgBar ? msgBar.parentElement.querySelector(".sm-ebay-btn.sm-more") : null;
  if (!menuBtn) {
    var allBtns = document.querySelectorAll(".sm-ebay-btn.sm-more");
    if (allBtns.length > 0) menuBtn = allBtns[allBtns.length - 1];
  }
  var btnRect = menuBtn ? menuBtn.getBoundingClientRect() : { bottom: 300, left: 300, top: 280 };

  // Calculate available space
  var viewH = window.innerHeight;
  var spaceBelow = viewH - btnRect.bottom - 10;
  var spaceAbove = btnRect.top - 10;
  var maxH = Math.max(spaceBelow, spaceAbove, 200);
  if (maxH > 400) maxH = 400;

  var openUp = spaceBelow < maxH && spaceAbove > spaceBelow;
  var topPos, bottomPos;
  
  if (openUp) {
    topPos = "auto";
    bottomPos = viewH - btnRect.top + 4;
  } else {
    topPos = btnRect.bottom + 4;
    bottomPos = "auto";
  }

  // Build popup — ALL styles inline
  var popup = document.createElement("div");
  popup.id = "sm-template-popup";
  popup.style.cssText = "position:fixed;top:" + (topPos === "auto" ? "auto" : topPos + "px") + ";bottom:" + (bottomPos === "auto" ? "auto" : bottomPos + "px") + ";left:" + btnRect.left + "px;z-index:2147483647;min-width:220px;max-width:300px;max-height:" + maxH + "px;overflow-y:auto;background:#ffffff;border:1px solid #d1d5db;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,0.18);padding:6px;font-family:Segoe UI,sans-serif;scrollbar-width:thin;";

  // Header
  var hdr = document.createElement("div");
  hdr.style.cssText = "padding:6px 10px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb;margin-bottom:4px;position:sticky;top:-6px;background:#ffffff;z-index:1;";
  hdr.textContent = "\u015eablonlar";
  popup.appendChild(hdr);

  document.body.appendChild(popup);

  // Close on outside click
  function closePopup(e) {
    if (popup && !popup.contains(e.target)) {
      if (popup.parentNode) popup.remove();
      document.removeEventListener("mousedown", closePopup, true);
    }
  }
  setTimeout(function() {
    document.addEventListener("mousedown", closePopup, true);
  }, 100);

  // Load templates
  chrome.storage.local.get(["templates"], function(data) {
    var templates = data.templates || [];
    if (templates.length === 0) {
      var empty = document.createElement("div");
      empty.style.cssText = "padding:16px 10px;font-size:12px;color:#9ca3af;text-align:center;";
      empty.textContent = "Hen\u00fcz \u015fablon yok. Ayarlardan ekleyin.";
      popup.appendChild(empty);
    } else {
      var cats = { refund: "\ud83d\udcb0", shipping: "\ud83d\udce6", "return": "\u21a9\ufe0f", defective: "\u26a0\ufe0f", general: "\ud83d\udcdd" };
      for (var idx = 0; idx < templates.length; idx++) {
        (function(t) {
          var btn = document.createElement("button");
          btn.style.cssText = "display:flex;align-items:center;gap:8px;width:100%;padding:9px 10px;border:none;border-radius:7px;background:none;color:#374151;font-size:13px;cursor:pointer;font-family:Segoe UI,sans-serif;text-align:left;line-height:1.3;";
          var iconSpan = document.createElement("span");
          iconSpan.style.cssText = "font-size:15px;width:22px;text-align:center;flex-shrink:0;";
          iconSpan.textContent = cats[t.category] || "\ud83d\udcdd";
          btn.appendChild(iconSpan);
          btn.appendChild(document.createTextNode(t.title));
          btn.onmouseenter = function() { btn.style.background = "#f3f4f6"; };
          btn.onmouseleave = function() { btn.style.background = "none"; };
          btn.onclick = function(e) {
            e.stopPropagation();
            e.preventDefault();
            fillEbayTextArea(t.content);
            if (popup.parentNode) popup.remove();
            document.removeEventListener("mousedown", closePopup, true);
          };
          popup.appendChild(btn);
        })(templates[idx]);
      }
    }
  });
}

/* ===== Start Session ===== */
function startSession(msgNode, overrideText = null, quickInstruction = null, triggerRufus = false) {
  toggleWidget(true);
  const msgContainer = document.getElementById("sm-messages");
  msgContainer.innerHTML = "";
  SM.chatHistory = [];
  SM.latestCustomerMsg = overrideText || (msgNode ? msgNode.innerText.trim() : "");

  if (!SM.latestCustomerMsg) {
    appendMessage("Yanıtlanacak müşteri mesajı bulunamadı.", "system");
    return;
  }

  SM.ebayContext = extractConversationContext();

  // Detect order number
  const orderMatch = SM.latestCustomerMsg.match(/\b(\d{2}-\d{5}-\d{5})\b/) || SM.ebayContext.match(/\b(\d{2}-\d{5}-\d{5})\b/);
  const orderInfo = orderMatch ? ` · Sipariş: ${orderMatch[1]}` : "";

  const sentiment = analyzeSentiment(SM.latestCustomerMsg);
  SM.currentSentiment = sentiment;
  updateContextBar(sentiment, orderInfo);

  appendMessage(`Müşteri mesajı:\n${SM.latestCustomerMsg}`, "system");

  if (triggerRufus) {
    startRufusResearch();
    return;
  }

  appendMessage("Nasıl yanıtlamamı istediğinizi yazın. Siz talimat vermeden taslak oluşturulmayacak.", "system");
  appendInstructionStarters();
  const input = document.getElementById("sm-input");
  input.value = quickInstruction || "";
  input.placeholder = "Örn: Kibarca gecikme için özür dile ve 3 gün beklemesini söyle";
  input.focus();
}

function appendInstructionStarters() {
  const container = document.getElementById("sm-messages");
  const guide = document.createElement("div");
  guide.className = "sm-instruction-guide";
  const title = document.createElement("div");
  title.className = "sm-instruction-title";
  title.textContent = "Hızlı yönergeler";
  guide.appendChild(title);

  [
    ["Kısa yanıtla", "Kısa ve doğrudan yanıtla."],
    ["Empatik ol", "Müşterinin duygusunu kabul et, empatik ve çözüm odaklı yanıtla."],
    ["Politikayı açıkla", "Mağaza politikamızı net şekilde açıkla ve uygun sonraki adımı belirt."],
    ["Çözüm öner", "Sorunu özetlemeden doğrudan en uygun çözümü öner."]
  ].forEach(([label, instruction]) => {
    const button = document.createElement("button");
    button.className = "sm-instruction-chip";
    button.textContent = label;
    button.addEventListener("click", () => {
      const input = document.getElementById("sm-input");
      input.value = instruction;
      input.focus();
    });
    guide.appendChild(button);
  });
  container.appendChild(guide);
}

/* ===== Context Extraction ===== */
function extractConversationContext() {
  let context = "";
  document.querySelectorAll(
    ".app-conversation__message-bubble__message, .m2m-message-bubble, .message-bubble"
  ).forEach(node => {
    const text = node.innerText.trim();
    if (!text) return;
    const lower = text.toLowerCase();
    if (["thank you for your order", "has been shipped", "tracking number", "order confirmed"].some(kw => lower.includes(kw))) return;
    const parent = node.closest(".app-conversation__message-bubble, .app-conversation__message, .m2m-message-container") || node;
    const cls = parent.className || "";
    const isBuyer = cls.includes("grey") || cls.includes("buyer") || cls.includes("received") || cls.includes("incoming");
    context += (isBuyer ? "CUSTOMER: " : "STORE: ") + text + "\n";
  });
  return context;
}

/* ===== Sentiment ===== */
function analyzeSentiment(message) {
  const text = message.toLowerCase();
  const negative = ["angry", "upset", "unacceptable", "disappointed", "terrible", "awful", "scam", "fraud", "broken", "damaged", "late", "lost", "refund", "complaint"];
  const positive = ["thank you", "thanks", "great", "excellent", "happy", "perfect", "appreciate", "love"];
  if (negative.some(word => text.includes(word))) return "negative";
  if (positive.some(word => text.includes(word))) return "positive";
  return "neutral";
}

function updateContextBar(sentiment, extra = "") {
  const dot = document.getElementById("sm-dot");
  const info = document.getElementById("sm-context-text");
  dot.className = `sm-dot ${sentiment}`;
  const labels = {
    positive: "😊 Olumlu müşteri",
    negative: "⚠️ Olumsuz — dikkatli yaklaş",
    neutral: "📋 Nötr talep"
  };
  const preview = SM.latestCustomerMsg.substring(0, 50) + (SM.latestCustomerMsg.length > 50 ? "..." : "");
  info.textContent = `${labels[sentiment]}${extra} · "${preview}"`;
}

/* ===== AI Request ===== */
async function requestAI() {
  showTyping();
  try {
    const settings = await getSettings();
    const greeting = getUSGreeting();
    const toneInstructions = getToneInstructions();
    const systemPrompt = buildSystemPrompt(settings, greeting, toneInstructions);
    const messages = SM.chatHistory.map(m => ({ role: m.role, content: m.content }));
    const aiReply = await callClaude(systemPrompt, messages, 0.25, 600);
    removeTyping();
    SM.chatHistory.push({ role: "assistant", content: aiReply });
    appendMessage(aiReply, "ai", true);
    chrome.runtime.sendMessage({
      action: "saveToHistory",
      data: {
        customerMessage: SM.latestCustomerMsg,
        aiResponse: aiReply,
        sentiment: SM.currentSentiment,
        tone: SM.currentTone,
        category: detectCategory(SM.latestCustomerMsg)
      }
    });
  } catch (err) {
    removeTyping();
    appendMessage(`❌ Hata: ${err.message}`, "system");
  }
}

function callClaude(systemPrompt, messages, temperature = 0.3, maxTokens = 600) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      action: "callClaude", systemPrompt, messages, temperature, maxTokens
    }, (response) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else if (response?.success) resolve(response.data);
      else reject(new Error(response?.error || "Bilinmeyen hata"));
    });
  });
}

/* ===== System Prompt ===== */
function buildSystemPrompt(settings, greeting, toneInstructions) {
  return `You are an expert Customer Service Representative for the eBay store "${settings.storeName || "our store"}".

IDENTITY:
- Name: ${settings.repName || "Customer Support"}
- Store: ${settings.storeName || "Our Store"}

TONE: ${toneInstructions}

CONVERSATION:
${SM.ebayContext || "No prior messages."}

LATEST MESSAGE:
"${SM.latestCustomerMsg}"

SENTIMENT: ${SM.currentSentiment}
${SM.currentSentiment === "negative" ? "⚠️ Customer is frustrated. Acknowledge briefly, then solution." : ""}

POLICIES:
- Shipping: ${settings.shippingPolicy || "Standard (3-5 days)"}
- Handling: ${settings.handlingPolicy || "1-2 business days"}
- Returns: ${settings.returnPolicy || "30-day free returns"}
- Compensation: ${settings.discountLimit || "Up to 15%"}

LENGTH RULES (STRICT):
- Simple questions: 2-5 sentences
- Complex issues: 4-8 sentences
- NEVER exceed 10 sentences
- No filler. No repeating the problem. Jump to solution.
- Greeting + solution + closing = ideal

RULES:
1. FORBIDDEN: "Amazon", "Dropshipping", "Arbitrage", "Walmart", "AliExpress", "Alibaba", "Wholesale", "Supplier"
2. Never ask clarification. Give confident answers.
3. Damaged/Wrong → Apology + FREE replacement or FULL refund
4. Delayed/Lost → Refund or replace if not delivered in 3 days
5. Delivered not received → Check neighbors/mailroom. No auto-refund
6. Cancellation → "Quality inspection found an issue. Full refund issued."
7. Amazon packaging → "Premium logistics partner for fastest delivery."
8. Start with "${greeting}," end with:
Best regards,
${settings.repName || "Customer Support Team"}
${settings.storeName || ""}

PRIORITY: User's custom instruction overrides all defaults.
OUTPUT: Final customer message only. No markdown. Be CONCISE.`;
}

function getToneInstructions() {
  const map = {
    professional: "Formal, direct, no fluff. 4-6 sentences.",
    friendly: "Warm but brief. Friendly opener then straight to point. 4-6 sentences.",
    firm: "Assertive, clear on policy. 3-5 sentences.",
    empathetic: "Acknowledge feeling in ONE sentence, then solution. 5-7 sentences.",
    concise: "Ultra-brief. Greeting + answer + closing. 2-3 sentences ONLY."
  };
  return map[SM.currentTone] || map.professional;
}

function detectCategory(msg) {
  const l = msg.toLowerCase();
  if (["refund", "money back", "charge", "cancel"].some(k => l.includes(k))) return "refund";
  if (["ship", "deliver", "track", "arrive", "late", "lost"].some(k => l.includes(k))) return "shipping";
  if (["return", "exchange", "swap", "send back"].some(k => l.includes(k))) return "return";
  if (["broken", "damage", "defect", "wrong", "not work"].some(k => l.includes(k))) return "defective";
  return "general";
}

function getUSGreeting() {
  const h = parseInt(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }).format(new Date()));
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 18) return "Good afternoon";
  return "Good evening";
}

/* ===== Messages ===== */
function appendMessage(text, sender, isDraft = false) {
  const container = document.getElementById("sm-messages");
  removeTyping();
  const msgDiv = document.createElement("div");

  if (sender === "system") {
    msgDiv.className = "sm-msg sm-sys";
    msgDiv.textContent = text;
  } else if (sender === "user") {
    msgDiv.className = "sm-msg sm-user";
    msgDiv.textContent = text;
  } else {
    msgDiv.className = "sm-msg sm-msg-ai";
    msgDiv.textContent = text;

    if (isDraft) {
      // Character count
      const charInfo = document.createElement("div");
      charInfo.className = "sm-char-info";
      const len = text.length;
      charInfo.innerHTML = `<span class="${len > 2000 ? "sm-over" : ""}">${len}</span> / 2000 karakter`;
      msgDiv.appendChild(charInfo);

      // Actions row
      const actions = document.createElement("div");
      actions.className = "sm-draft-actions";

      const insertBtn = document.createElement("button");
      insertBtn.className = "sm-act sm-act-primary";
      insertBtn.innerHTML = "📥 eBay'e Aktar";
      insertBtn.addEventListener("click", () => {
        fillEbayTextArea(text);
        insertBtn.innerHTML = "✅ Aktarıldı!";
        setTimeout(() => { toggleWidget(); }, 800);
      });

      const copyBtn = document.createElement("button");
      copyBtn.className = "sm-act";
      copyBtn.innerHTML = "📋 Kopyala";
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(text).then(() => {
          copyBtn.innerHTML = "✅ Kopyalandı!";
          setTimeout(() => { copyBtn.innerHTML = "📋 Kopyala"; }, 1500);
        });
      });

      const regenBtn = document.createElement("button");
      regenBtn.className = "sm-act";
      regenBtn.innerHTML = "🔄 Yeniden";
      regenBtn.addEventListener("click", () => {
        SM.chatHistory.push({ role: "user", content: "Generate a different version. Change phrasing and approach but keep same intent." });
        requestAI();
      });

      actions.appendChild(insertBtn);
      actions.appendChild(copyBtn);
      actions.appendChild(regenBtn);
      msgDiv.appendChild(actions);

      // Rating
      const rateDiv = document.createElement("div");
      rateDiv.className = "sm-rate-row";
      ["👍", "👎"].forEach((emoji, i) => {
        const btn = document.createElement("button");
        btn.className = "sm-rate-btn";
        btn.textContent = emoji;
        btn.addEventListener("click", () => {
          rateDiv.querySelectorAll(".sm-rate-btn").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          chrome.runtime.sendMessage({
            action: "saveToHistory",
            data: { customerMessage: SM.latestCustomerMsg, aiResponse: text, rating: i === 0 ? 5 : 1, sentiment: SM.currentSentiment, tone: SM.currentTone }
          });
        });
        rateDiv.appendChild(btn);
      });
      msgDiv.appendChild(rateDiv);

      // Quick refinements
      const chips = document.createElement("div");
      chips.className = "sm-chips";
      ["Kısalt", "Daha empatik", "Daha resmi", "İndirim ekle", "İade sunma"].forEach(r => {
        const chip = document.createElement("button");
        chip.className = "sm-chip";
        chip.textContent = r;
        chip.addEventListener("click", () => {
          appendMessage(r, "user");
          SM.chatHistory.push({ role: "user", content: r });
          requestAI();
        });
        chips.appendChild(chip);
      });
      msgDiv.appendChild(chips);
    }
  }
  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}

function showTyping() {
  const container = document.getElementById("sm-messages");
  removeTyping();
  const t = document.createElement("div");
  t.className = "sm-typing";
  t.id = "sm-typing";
  t.innerHTML = `<div class="sm-dots"><span></span><span></span><span></span></div><span>Düşünüyor...</span>`;
  container.appendChild(t);
  container.scrollTop = container.scrollHeight;
}

function removeTyping() { const t = document.getElementById("sm-typing"); if (t) t.remove(); }

/* ===== eBay Fill ===== */
function fillEbayTextArea(text) {
  const selectors = ["#imageupload__sendmessage--textbox", 'textarea[placeholder*="message"]', 'textarea[name*="message"]', "textarea", '[contenteditable="true"]'];
  let textArea = null;
  for (const s of selectors) { textArea = document.querySelector(s); if (textArea) break; }
  if (!textArea) return;

  if (textArea.tagName === "TEXTAREA" || textArea.tagName === "INPUT") {
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (nativeSetter) nativeSetter.call(textArea, text);
    else textArea.value = text;
  } else {
    textArea.innerText = text;
  }
  textArea.dispatchEvent(new Event("input", { bubbles: true }));
  textArea.dispatchEvent(new Event("change", { bubbles: true }));
  textArea.focus();

  for (const s of ["#imageupload__send--button", 'button[type="submit"]', 'button[aria-label*="Send"]', ".m2m-send-btn"]) {
    const btn = document.querySelector(s);
    if (btn) { btn.removeAttribute("disabled"); break; }
  }
}

function quickReplyLastMessage() {
  const msgs = document.querySelectorAll(".app-conversation__message-bubble__message, .m2m-message-bubble");
  if (msgs.length > 0) startSession(msgs[msgs.length - 1]);
}

function getSettings() { return new Promise(resolve => { chrome.storage.local.get(null, data => resolve(data)); }); }

/* ===== Product Research — Only via explicit button ===== */

function startRufusResearch() {
  const titleSelectors = ['.msg-item-title', '.item-title', 'a[href*="/itm/"]', '.message-header__item-title', '.s-item__title', '[data-test-id="item-title"]'];
  let itemTitle = "";
  for (const sel of titleSelectors) {
    const el = document.querySelector(sel);
    if (el) { itemTitle = el.innerText?.trim() || el.textContent?.trim() || ""; if (itemTitle) break; }
  }
  if (!itemTitle) {
    appendMessage("⚠️ Ürün başlığı bulunamadı. Yanıt oluşturulmadı; nasıl ilerlemek istediğinizi yazın.", "system");
    document.getElementById("sm-input").focus();
    return;
  }
  appendMessage(`🔍 Araştırılıyor: "${itemTitle.substring(0, 50)}..."`, "system");
  chrome.runtime.sendMessage({ action: "startRufusFlow", title: itemTitle, question: SM.latestCustomerMsg });
  SM.rufusInProgress = true;
  showRufusProgress();
}

function showRufusProgress() {
  const container = document.getElementById("sm-messages");
  const p = document.createElement("div");
  p.className = "sm-msg sm-sys sm-pulse";
  p.id = "sm-rufus-progress";
  p.textContent = "⏳ Ürün bilgileri araştırılıyor... 10-30 saniye sürebilir.";
  container.appendChild(p);
  container.scrollTop = container.scrollHeight;

  const steps = ["⏳ Ürün aranıyor...", "🔍 Ürün sayfası açılıyor...", "📦 Özellikler alınıyor...", "📝 Bilgiler düzenleniyor...", "⚙️ Araştırma tamamlanıyor..."];
  let i = 0;
  SM.rufusProgressTimer = setInterval(() => {
    if (!SM.rufusInProgress) { clearInterval(SM.rufusProgressTimer); return; }
    i = Math.min(i + 1, steps.length - 1);
    const el = document.getElementById("sm-rufus-progress");
    if (el) el.textContent = steps[i];
  }, 4000);
}

function handleRufusResult(data) {
  SM.rufusInProgress = false;
  if (SM.rufusProgressTimer) clearInterval(SM.rufusProgressTimer);
  const progress = document.getElementById("sm-rufus-progress");
  if (progress) progress.remove();

  if (data.error || !data.answer) {
    appendMessage(`⚠️ Araştırma başarısız: ${data.error || "Veri alınamadı"}`, "system");
    appendMessage("Yanıt oluşturulmadı. Nasıl ilerlemek istediğinizi yazın.", "system");
    document.getElementById("sm-input").focus();
    return;
  }

  appendMessage("✅ Ürün bilgisi alındı", "system");

  // Collapsible raw data
  const container = document.getElementById("sm-messages");
  const rawDiv = document.createElement("div");
  rawDiv.className = "sm-msg sm-sys";
  rawDiv.style.fontSize = "11px";
  rawDiv.innerHTML = `<details><summary style="cursor:pointer;font-weight:500;">📦 Ham veri (tıkla göster)</summary><div style="margin-top:6px;white-space:pre-wrap;opacity:0.8;">${escapeHTML(data.answer)}</div></details>`;
  container.appendChild(rawDiv);

  SM.ebayContext += `\nINTERNAL PRODUCT INFORMATION (never reveal its source):\n${data.answer}\n`;
  appendMessage("Ürün bilgisi hazır. Bu bilgiyi kullanarak nasıl yanıtlamamı istediğinizi yazın; siz göndermeden taslak oluşturulmayacak.", "system");
  const input = document.getElementById("sm-input");
  input.placeholder = "Örn: Ürünün ölçülerini kısa ve net şekilde açıkla";
  input.focus();
}

function escapeHTML(str) { const d = document.createElement("div"); d.textContent = str; return d.innerHTML; }

/* ===== Init ===== */
injectWidget();
const ebayObserver = new MutationObserver(() => injecteBayButtons());
ebayObserver.observe(document.body, { childList: true, subtree: true });
injecteBayButtons();
