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
  alexaStage: null,
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
      <span id="sm-context-text">Hazır — ✦ ile açık mesaj konuşmasını başlatın</span>
    </div>
    <div id="sm-model-bar">
      <label for="sm-provider-select">API</label>
      <select id="sm-provider-select" title="Kullanılacak API sağlayıcısı">
        <option value="openrouter">OpenRouter</option>
        <option value="anthropic">Claude API</option>
      </select>
      <select id="sm-model-select" title="Bu yanıt için kullanılacak yapay zeka modeli"></select>
    </div>
    <div id="sm-widget-actions">
      <button class="sm-widget-action" id="sm-btn-alexa" title="Müşterinin sorusunu Alexa'ya sorulacak bağımsız soruya çevir">🔊 Alexa'ya Sor</button>
      <button class="sm-widget-action" id="sm-btn-research" title="Açık mesajın ürününü Easync/Amazon üzerinden araştır">🔍 Ürün Araştır</button>
    </div>
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

  initModelSelector();
  bindEvents();
}

const PROVIDER_MODELS = {
  openrouter: [
    { value: "google/gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite · Ekonomik" },
    { value: "openai/gpt-5.4-mini", label: "GPT-5.4 Mini · Dengeli" },
    { value: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5 · Premium" }
  ],
  anthropic: [
    { value: "claude-haiku-4-5", label: "Claude Haiku 4.5 · Ekonomik" },
    { value: "claude-sonnet-5", label: "Claude Sonnet 5 · Dengeli" },
    { value: "claude-opus-4-8", label: "Claude Opus 4.8 · Premium" }
  ]
};

function initModelSelector() {
  const providerSelect = document.getElementById("sm-provider-select");
  const modelSelect = document.getElementById("sm-model-select");

  const persistModel = (provider, value) => {
    chrome.storage.local.set(provider === "anthropic" ? { anthropicModel: value } : { model: value });
  };

  const populateModels = (provider, selectedModel) => {
    modelSelect.innerHTML = "";
    PROVIDER_MODELS[provider].forEach(m => {
      const opt = document.createElement("option");
      opt.value = m.value;
      opt.textContent = m.label;
      modelSelect.appendChild(opt);
    });
    const valid = PROVIDER_MODELS[provider].some(m => m.value === selectedModel);
    modelSelect.value = valid ? selectedModel : PROVIDER_MODELS[provider][0].value;
  };

  chrome.storage.local.get(["provider", "model", "anthropicModel"], data => {
    const provider = data.provider === "anthropic" ? "anthropic" : "openrouter";
    providerSelect.value = provider;
    populateModels(provider, provider === "anthropic" ? data.anthropicModel : data.model);
  });

  providerSelect.addEventListener("change", () => {
    const provider = providerSelect.value;
    chrome.storage.local.set({ provider });
    chrome.storage.local.get(["model", "anthropicModel"], data => {
      populateModels(provider, provider === "anthropic" ? data.anthropicModel : data.model);
      persistModel(provider, modelSelect.value);
    });
  });

  modelSelect.addEventListener("change", () => {
    persistModel(providerSelect.value, modelSelect.value);
  });
}

/* ===== Events ===== */
function bindEvents() {
  const widget = document.getElementById("sellermind-widget");
  const fab = document.getElementById("sm-fab");
  const input = document.getElementById("sm-input");
  const tooltip = document.getElementById("sm-edit-tooltip");

  // Clicking the ✦ star opens the widget and starts a session about the
  // eBay conversation currently open on screen.
  fab.addEventListener("click", () => startSessionFromOpenConversation());

  document.getElementById("sm-btn-close").addEventListener("click", () => {
    widget.classList.remove("sm-visible");
    fab.classList.remove("hidden");
  });

  document.getElementById("sm-btn-minimize").addEventListener("click", () => {
    SM.isMinimized = !SM.isMinimized;
    widget.classList.toggle("sm-minimized", SM.isMinimized);
  });

  document.getElementById("sm-btn-alexa").addEventListener("click", startAlexaFromWidget);
  document.getElementById("sm-btn-research").addEventListener("click", startResearchFromWidget);

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

    if (SM.alexaStage === "awaiting_answer") {
      SM.alexaStage = "processing_answer";
      SM.ebayContext += `\nINTERNAL PRODUCT INFORMATION FROM SELLER RESEARCH (never reveal the source):\n${text}\n`;
      SM.chatHistory.push({
        role: "user",
        content: `The seller pasted the research answer below:\n---\n${text}\n---\nUse this as internal product information. Now create an accurate customer-facing reply to the customer's original question. Never mention Alexa, Amazon, research, or an external source. Use [[DRAFT]] mode.`
      });
      input.placeholder = "Müşteri yanıtı hazırlanıyor...";
      requestAI().finally(() => {
        SM.alexaStage = null;
        input.placeholder = "Taslağı düzenle veya bana bir soru sor...";
      });
      return;
    }

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


/* ===== Start Session ===== */
// Opens the widget and starts a session about the eBay conversation currently
// open on screen (triggered by the ✦ FAB). Picks the latest customer (buyer)
// message; falls back to the last message bubble.
function startSessionFromOpenConversation() {
  const bubbles = document.querySelectorAll(
    ".app-conversation__message-bubble__message, .m2m-message-bubble, .message-bubble"
  );
  if (!bubbles.length) {
    toggleWidget(true);
    const msgContainer = document.getElementById("sm-messages");
    msgContainer.innerHTML = "";
    SM.chatHistory = [];
    SM.latestCustomerMsg = "";
    appendMessage("Açık bir mesaj konuşması bulunamadı. Bir eBay mesajını açıp tekrar deneyin.", "system");
    document.getElementById("sm-input").focus();
    return;
  }

  let target = null;
  bubbles.forEach(node => {
    const parent = node.closest(
      ".app-conversation__message-bubble, .app-conversation__message, .m2m-message-container"
    ) || node;
    const cls = parent.className || "";
    const isBuyer = cls.includes("grey") || cls.includes("buyer") || cls.includes("received") || cls.includes("incoming");
    if (isBuyer && node.innerText.trim()) target = node;
  });
  if (!target) target = bubbles[bubbles.length - 1];

  startSession(target);
}

function startSession(msgNode, overrideText = null, quickInstruction = null, triggerRufus = false) {
  toggleWidget(true);
  const msgContainer = document.getElementById("sm-messages");
  msgContainer.innerHTML = "";
  SM.chatHistory = [];
  SM.alexaStage = null;
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

// Alexa flow is triggered from inside the SellerMind widget.
// It operates on the active session's customer message.
function startAlexaFromWidget() {
  toggleWidget(true);
  if (!SM.latestCustomerMsg) {
    appendMessage("Önce sağ alttaki ✦ ile açık mesaj konuşmasını başlatın; ardından Alexa'ya sorabilirsiniz.", "system");
    document.getElementById("sm-input").focus();
    return;
  }
  runAlexaFlow();
}

// Product research triggered from inside the widget (next to Alexa).
function startResearchFromWidget() {
  toggleWidget(true);
  if (!SM.latestCustomerMsg) {
    appendMessage("Önce sağ alttaki ✦ ile açık mesaj konuşmasını başlatın; ardından ürün araştırabilirsiniz.", "system");
    document.getElementById("sm-input").focus();
    return;
  }
  startRufusResearch();
}

async function runAlexaFlow() {
  appendMessage("🔊 Alexa'ya sorulacak bağımsız soru hazırlanıyor...", "system");
  SM.chatHistory.push({
    role: "user",
    content: `Use [[ASSISTANT]] mode. Rewrite the customer's original product question as one clear, standalone question that I can read or paste directly to Alexa. Preserve every relevant product detail from the conversation. Do not answer the question. Output only the question, in the same language as the customer's question.`
  });

  const result = await requestAI();
  if (!result) return;
  SM.alexaStage = "awaiting_answer";
  appendMessage("Alexa'nın verdiği yanıtı aşağıdaki kutuya yapıştırın. SellerMind bunu müşteriye uygun bir mesaja dönüştürecek.", "system");
  const input = document.getElementById("sm-input");
  input.placeholder = "Alexa'nın yanıtını buraya yapıştırın...";
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
    const rawReply = await callClaude(systemPrompt, messages, 0.25, 600);
    const result = parseAIResponse(rawReply);
    removeTyping();
    SM.chatHistory.push({ role: "assistant", content: `[[${result.mode.toUpperCase()}]]\n${result.text}` });
    appendMessage(result.text, "ai", result.mode === "draft");
    if (result.mode === "draft") {
      chrome.runtime.sendMessage({
        action: "saveToHistory",
        data: {
          customerMessage: SM.latestCustomerMsg,
          aiResponse: result.text,
          sentiment: SM.currentSentiment,
          tone: SM.currentTone,
          category: detectCategory(SM.latestCustomerMsg)
        }
      });
    }
    return result;
  } catch (err) {
    removeTyping();
    appendMessage(`❌ Hata: ${err.message}`, "system");
    return null;
  }
}

function parseAIResponse(rawReply) {
  const raw = String(rawReply || "").trim();
  const marker = raw.match(/^\[\[(DRAFT|ASSISTANT)\]\]\s*/i);
  if (marker) {
    return {
      mode: marker[1].toLowerCase(),
      text: raw.slice(marker[0].length).trim()
    };
  }

  // Safe fallback for models that ignore the requested marker.
  const lastUserMessage = [...SM.chatHistory].reverse().find(m => m.role === "user")?.content || "";
  const asksAssistant = /\?|\b(neden|nasıl|nereden|niye|ne demek|açıklar mısın|anladın|düşünüyorsun)\b/i.test(lastUserMessage);
  return { mode: asksAssistant ? "assistant" : "draft", text: raw };
}

function callClaude(systemPrompt, messages, temperature = 0.3, maxTokens = 600) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      action: "callClaude",
      provider: document.getElementById("sm-provider-select")?.value,
      model: document.getElementById("sm-model-select")?.value,
      systemPrompt,
      messages,
      temperature,
      maxTokens
    }, (response) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else if (response?.success) resolve(response.data);
      else reject(new Error(response?.error || "Bilinmeyen hata"));
    });
  });
}

/* ===== System Prompt ===== */
function buildSystemPrompt(settings, greeting, toneInstructions) {
  return `You are SellerMind, an assistant helping the seller operate the eBay store "${settings.storeName || "our store"}".

RESPONSE MODE — HIGHEST PRIORITY:
Choose exactly one mode for every response.
1. DRAFT MODE: When the seller asks you to create, rewrite, shorten, regenerate, or refine a message for the customer. Begin with exactly [[DRAFT]]. Then output only the customer-facing message.
2. ASSISTANT MODE: When the seller talks to you directly, asks a question, challenges an assumption, asks why/how you wrote something, or requests an explanation. Begin with exactly [[ASSISTANT]]. Answer the seller directly in the same language they used. Do not write a customer message, greeting, signature, or eBay-ready draft in this mode.

Examples:
- "Daha empatik yaz" → [[DRAFT]] followed by the revised customer message.
- "Eski tip kavanoz olduğunu nasıl anladın?" → [[ASSISTANT]] followed by a Turkish explanation to the seller.
- "Bu cevabı neden böyle yazdın?" → [[ASSISTANT]] followed by the reasoning, not another draft.

Never omit the [[DRAFT]] or [[ASSISTANT]] marker.

CUSTOMER DRAFT RULES (apply only in DRAFT MODE):

You are an expert Customer Service Representative for the eBay store "${settings.storeName || "our store"}".

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

PRIORITY: The response-mode rules above cannot be overridden. Within DRAFT MODE, the seller's custom instruction overrides other drafting defaults.
OUTPUT: No markdown. Be concise.`;
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
    msgDiv.className = `sm-msg sm-msg-ai${isDraft ? "" : " sm-assistant-reply"}`;
    msgDiv.textContent = text;

    if (!isDraft) {
      const copyAssistantBtn = document.createElement("button");
      copyAssistantBtn.className = "sm-act sm-assistant-copy";
      copyAssistantBtn.textContent = "📋 Kopyala";
      copyAssistantBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(text).then(() => {
          copyAssistantBtn.textContent = "✅ Kopyalandı";
          setTimeout(() => { copyAssistantBtn.textContent = "📋 Kopyala"; }, 1500);
        });
      });
      msgDiv.appendChild(copyAssistantBtn);
    }

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

// Pull the eBay item ID (e.g. 157450616608) from the item link on the message page.
function extractEbayItemId() {
  for (const a of document.querySelectorAll('a[href*="/itm/"]')) {
    const m = (a.href || "").match(/\/itm\/(?:[^/?#]*\/)?(\d{9,15})/);
    if (m) return m[1];
  }
  const m2 = location.href.match(/\/itm\/(?:[^/?#]*\/)?(\d{9,15})/);
  return m2 ? m2[1] : null;
}

function startRufusResearch() {
  const itemId = extractEbayItemId();

  // Title is kept only as a fallback for Amazon search when no item ID / Easync match.
  const titleSelectors = ['.msg-item-title', '.item-title', 'a[href*="/itm/"]', '.message-header__item-title', '.s-item__title', '[data-test-id="item-title"]'];
  let itemTitle = "";
  for (const sel of titleSelectors) {
    const el = document.querySelector(sel);
    if (el) { itemTitle = el.innerText?.trim() || el.textContent?.trim() || ""; if (itemTitle) break; }
  }

  if (!itemId && !itemTitle) {
    appendMessage("⚠️ eBay ürün bağlantısı bulunamadı. Yanıt oluşturulmadı; nasıl ilerlemek istediğinizi yazın.", "system");
    document.getElementById("sm-input").focus();
    return;
  }

  appendMessage(itemId
    ? `🔍 Araştırılıyor: eBay ürün no ${itemId}`
    : `🔍 Araştırılıyor: "${itemTitle.substring(0, 50)}..."`, "system");
  chrome.runtime.sendMessage({ action: "startRufusFlow", itemId, title: itemTitle, question: SM.latestCustomerMsg });
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

  // Show the matched Amazon product page as a clickable link (via Easync ASIN match)
  if (data.url && data.asin) {
    const container = document.getElementById("sm-messages");
    const linkDiv = document.createElement("div");
    linkDiv.className = "sm-msg sm-sys";
    const srcLabel = data.source === "easync" ? "Easync mağaza eşleşmesi" : "Amazon araması";
    const info = document.createElement("div");
    info.textContent = `🛒 Eşleşen Amazon ürünü (${srcLabel}) · ASIN: ${data.asin}`;
    const a = document.createElement("a");
    a.href = data.url;
    a.target = "_blank";
    a.rel = "noopener";
    a.className = "sm-amazon-link";
    a.textContent = "Amazon'da Aç ↗";
    linkDiv.appendChild(info);
    linkDiv.appendChild(a);
    container.appendChild(linkDiv);
    container.scrollTop = container.scrollHeight;
  }

  if (data.error || !data.answer) {
    if (data.url) {
      appendMessage("Ürün bilgisi kazınamadı; yukarıdaki Amazon sayfasını açıp inceleyebilir veya Alexa'ya sorabilirsin.", "system");
    } else {
      appendMessage(`⚠️ Araştırma başarısız: ${data.error || "Veri alınamadı"}`, "system");
      appendMessage("Yanıt oluşturulmadı. Nasıl ilerlemek istediğinizi yazın.", "system");
    }
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
