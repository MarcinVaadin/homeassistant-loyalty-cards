const BASE_PATH = new URL(".", import.meta.url).pathname.replace(/\/$/, "");

const JSBARCODE_FORMAT_MAP = {
  ean13: "EAN13",
  ean8: "EAN8",
  upca: "UPC",
  upce: "UPC",
  code128: "CODE128",
  code39: "CODE39",
  code93: "CODE93",
  codabar: "codabar",
  itf: "ITF14",
};

const CODE_TYPE_LABELS = {
  qr: "QR Code",
  ean13: "EAN-13",
  ean8: "EAN-8",
  upca: "UPC-A",
  upce: "UPC-E",
  code128: "Code 128",
  code39: "Code 39",
  code93: "Code 93",
  codabar: "Codabar",
  itf: "ITF",
  datamatrix: "Data Matrix",
  pdf417: "PDF 417",
};

const SCANNER_FORMAT_MAP = {
  QR_CODE: "qr",
  EAN_13: "ean13",
  EAN_8: "ean8",
  UPC_A: "upca",
  UPC_E: "upce",
  CODE_128: "code128",
  CODE_39: "code39",
  CODE_93: "code93",
  CODABAR: "codabar",
  ITF: "itf",
  DATA_MATRIX: "datamatrix",
  PDF_417: "pdf417",
};

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

class LoyaltyCardsPanel extends HTMLElement {
  constructor() {
    super();
    this._hass = null;
    this._cards = [];
    this._view = "grid";
    this._selectedCard = null;
    this._codeDisplayMode = "barcode";
    this._scanner = null;
    this._scannerRunning = false;
    this._scannedCode = null;
    this._scannedCodeType = null;
    this._addCardName = "";
    this._manualEntry = false;
    this._manualCode = "";
    this._manualCodeType = "ean13";
    this._libsLoaded = false;
    this._scannerLibLoaded = false;
    this._container = null;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._container) {
      this._init();
    }
  }

  set panel(panel) {
    this._panel = panel;
  }

  async _init() {
    this._injectStyles();
    this._container = document.createElement("div");
    this._container.className = "lc-root";
    this.appendChild(this._container);
    await this._loadLibraries();
    await this._loadCards();
    this._render();
  }

  async _loadLibraries() {
    try {
      await Promise.all([
        loadScript(`${BASE_PATH}/lib/jsbarcode.all.min.js`),
        loadScript(`${BASE_PATH}/lib/qrcode-svg.min.js`),
      ]);
      this._libsLoaded = true;
    } catch (e) {
      console.error("Failed to load loyalty cards libraries:", e);
    }
  }

  async _loadScannerLib() {
    if (this._scannerLibLoaded) return true;
    try {
      await loadScript(`${BASE_PATH}/lib/html5-qrcode.min.js`);
      this._scannerLibLoaded = true;
      return true;
    } catch (e) {
      console.error("Failed to load scanner library:", e);
      return false;
    }
  }

  disconnectedCallback() {
    this._stopScanner();
  }

  async _loadCards() {
    if (!this._hass) return;
    try {
      const result = await this._hass.connection.sendMessagePromise({
        type: "loyalty_cards/cards/list",
      });
      this._cards = result.cards || [];
    } catch (e) {
      console.error("Failed to load loyalty cards:", e);
      this._cards = [];
    }
  }

  async _addCard(name, code, codeType) {
    if (!this._hass) return;
    try {
      const result = await this._hass.connection.sendMessagePromise({
        type: "loyalty_cards/cards/add",
        name: name,
        code: code,
        code_type: codeType,
      });
      this._cards.push(result.card);
    } catch (e) {
      console.error("Failed to add loyalty card:", e);
    }
  }

  async _removeCard(cardId) {
    if (!this._hass) return;
    try {
      await this._hass.connection.sendMessagePromise({
        type: "loyalty_cards/cards/remove",
        card_id: cardId,
      });
      this._cards = this._cards.filter((c) => c.id !== cardId);
    } catch (e) {
      console.error("Failed to remove loyalty card:", e);
    }
  }

  // ---- Rendering ----

  _render() {
    if (!this._container) return;
    switch (this._view) {
      case "grid":
        this._renderGrid();
        break;
      case "detail":
        this._renderDetail();
        break;
      case "add":
        this._renderAdd();
        break;
    }
  }

  _renderGrid() {
    const c = this._container;
    c.innerHTML = "";

    // Header
    const header = document.createElement("div");
    header.className = "lc-header";
    header.innerHTML = `
      <h1 class="lc-title">Loyalty Cards</h1>
    `;
    c.appendChild(header);

    if (this._cards.length === 0) {
      this._renderEmptyState(c);
    } else {
      const grid = document.createElement("div");
      grid.className = "lc-grid";
      this._cards.forEach((card) => {
        const el = document.createElement("div");
        el.className = "lc-card";
        el.addEventListener("click", () => this._onCardClick(card));

        const initial = document.createElement("div");
        initial.className = "lc-card-initial";
        initial.textContent = card.name.charAt(0).toUpperCase();
        // Generate a consistent color from the name
        initial.style.backgroundColor = this._nameToColor(card.name);

        const name = document.createElement("div");
        name.className = "lc-card-name";
        name.textContent = card.name;

        el.appendChild(initial);
        el.appendChild(name);
        grid.appendChild(el);
      });
      c.appendChild(grid);
    }

    // FAB
    const fab = document.createElement("button");
    fab.className = "lc-fab";
    fab.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`;
    fab.addEventListener("click", () => this._onAddClick());
    c.appendChild(fab);
  }

  _renderEmptyState(container) {
    const empty = document.createElement("div");
    empty.className = "lc-empty";
    empty.innerHTML = `
      <svg viewBox="0 0 24 24" width="64" height="64" class="lc-empty-icon">
        <path fill="currentColor" d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/>
      </svg>
      <p class="lc-empty-title">No loyalty cards yet</p>
      <p class="lc-empty-subtitle">Tap + to add your first card</p>
    `;
    container.appendChild(empty);
  }

  _renderDetail() {
    const c = this._container;
    c.innerHTML = "";
    const card = this._selectedCard;
    if (!card) return;

    // Top bar
    const topBar = document.createElement("div");
    topBar.className = "lc-topbar";

    const backBtn = document.createElement("button");
    backBtn.className = "lc-icon-btn";
    backBtn.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>`;
    backBtn.addEventListener("click", () => {
      this._view = "grid";
      this._render();
    });

    const title = document.createElement("span");
    title.className = "lc-topbar-title";
    title.textContent = card.name;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "lc-icon-btn lc-delete-btn";
    deleteBtn.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;
    deleteBtn.addEventListener("click", () => this._onDeleteClick(card));

    topBar.appendChild(backBtn);
    topBar.appendChild(title);
    topBar.appendChild(deleteBtn);
    c.appendChild(topBar);

    // Code display area
    const codeArea = document.createElement("div");
    codeArea.className = "lc-code-area";

    const codeContainer = document.createElement("div");
    codeContainer.className = "lc-code-container";
    codeContainer.id = "lc-code-display";
    codeArea.appendChild(codeContainer);

    // Raw code text
    const rawCode = document.createElement("div");
    rawCode.className = "lc-raw-code";
    rawCode.textContent = card.code;
    codeArea.appendChild(rawCode);

    c.appendChild(codeArea);

    // Toggle buttons
    const toggleRow = document.createElement("div");
    toggleRow.className = "lc-toggle-row";

    const barcodeBtn = document.createElement("button");
    barcodeBtn.className = `lc-toggle-btn ${this._codeDisplayMode === "barcode" ? "lc-toggle-active" : ""}`;
    barcodeBtn.textContent = "Barcode";
    barcodeBtn.addEventListener("click", () => {
      this._codeDisplayMode = "barcode";
      this._renderCodeDisplay(codeContainer, card);
      barcodeBtn.className = "lc-toggle-btn lc-toggle-active";
      qrBtn.className = "lc-toggle-btn";
    });

    const qrBtn = document.createElement("button");
    qrBtn.className = `lc-toggle-btn ${this._codeDisplayMode === "qr" ? "lc-toggle-active" : ""}`;
    qrBtn.textContent = "QR Code";
    qrBtn.addEventListener("click", () => {
      this._codeDisplayMode = "qr";
      this._renderCodeDisplay(codeContainer, card);
      qrBtn.className = "lc-toggle-btn lc-toggle-active";
      barcodeBtn.className = "lc-toggle-btn";
    });

    toggleRow.appendChild(barcodeBtn);
    toggleRow.appendChild(qrBtn);
    c.appendChild(toggleRow);

    // Render the code
    this._renderCodeDisplay(codeContainer, card);
  }

  _renderCodeDisplay(container, card) {
    container.innerHTML = "";
    if (!this._libsLoaded) {
      container.textContent = "Loading...";
      return;
    }

    if (this._codeDisplayMode === "barcode") {
      this._renderBarcode(container, card);
    } else {
      this._renderQrCode(container, card);
    }
  }

  _renderBarcode(container, card) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.className = "lc-barcode-svg";
    container.appendChild(svg);

    const format = JSBARCODE_FORMAT_MAP[card.code_type] || "CODE128";

    try {
      JsBarcode(svg, card.code, {
        format: format,
        width: 2,
        height: 100,
        displayValue: true,
        fontSize: 16,
        margin: 10,
        background: "transparent",
      });
    } catch (e) {
      // Fallback to CODE128 if the format-specific encoding fails
      try {
        JsBarcode(svg, card.code, {
          format: "CODE128",
          width: 2,
          height: 100,
          displayValue: true,
          fontSize: 16,
          margin: 10,
          background: "transparent",
        });
      } catch (e2) {
        container.innerHTML = "";
        const msg = document.createElement("div");
        msg.className = "lc-code-error";
        msg.textContent = "Cannot render barcode for this code";
        container.appendChild(msg);
      }
    }
  }

  _renderQrCode(container, card) {
    try {
      const qr = new QRCode({
        content: card.code,
        padding: 4,
        width: 256,
        height: 256,
        color: getComputedStyle(document.documentElement)
          .getPropertyValue("--primary-text-color")
          .trim() || "#000000",
        background: "transparent",
        ecl: "M",
      });
      container.innerHTML = qr.svg();
    } catch (e) {
      const msg = document.createElement("div");
      msg.className = "lc-code-error";
      msg.textContent = "Cannot generate QR code for this value";
      container.appendChild(msg);
    }
  }

  _renderAdd() {
    const c = this._container;
    c.innerHTML = "";

    // Top bar
    const topBar = document.createElement("div");
    topBar.className = "lc-topbar";

    const backBtn = document.createElement("button");
    backBtn.className = "lc-icon-btn";
    backBtn.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>`;
    backBtn.addEventListener("click", () => {
      this._stopScanner();
      this._resetAddState();
      this._view = "grid";
      this._render();
    });

    const title = document.createElement("span");
    title.className = "lc-topbar-title";
    title.textContent = "Add Card";

    topBar.appendChild(backBtn);
    topBar.appendChild(title);
    c.appendChild(topBar);

    // Form
    const form = document.createElement("div");
    form.className = "lc-add-form";

    // Name input
    const nameLabel = document.createElement("label");
    nameLabel.className = "lc-label";
    nameLabel.textContent = "Shop Name";
    form.appendChild(nameLabel);

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "lc-input";
    nameInput.placeholder = "Enter shop name...";
    nameInput.value = this._addCardName;
    nameInput.addEventListener("input", (e) => {
      this._addCardName = e.target.value;
      this._updateSaveButton();
    });
    form.appendChild(nameInput);

    // Scanner area
    if (!this._manualEntry) {
      const scannerSection = document.createElement("div");
      scannerSection.className = "lc-scanner-section";

      if (!this._scannedCode) {
        const scannerContainer = document.createElement("div");
        scannerContainer.className = "lc-scanner-container";
        scannerContainer.id = "lc-scanner-region";
        scannerSection.appendChild(scannerContainer);

        const manualLink = document.createElement("button");
        manualLink.className = "lc-link-btn";
        manualLink.textContent = "Enter code manually";
        manualLink.addEventListener("click", () => {
          this._stopScanner();
          this._manualEntry = true;
          this._render();
        });
        scannerSection.appendChild(manualLink);
      } else {
        const scannedInfo = document.createElement("div");
        scannedInfo.className = "lc-scanned-info";
        scannedInfo.innerHTML = `
          <div class="lc-scanned-label">Scanned Code</div>
          <div class="lc-scanned-code">${this._escapeHtml(this._scannedCode)}</div>
          <div class="lc-scanned-type">${CODE_TYPE_LABELS[this._scannedCodeType] || this._scannedCodeType}</div>
        `;
        scannerSection.appendChild(scannedInfo);

        const rescanBtn = document.createElement("button");
        rescanBtn.className = "lc-link-btn";
        rescanBtn.textContent = "Scan again";
        rescanBtn.addEventListener("click", () => {
          this._scannedCode = null;
          this._scannedCodeType = null;
          this._render();
        });
        scannerSection.appendChild(rescanBtn);
      }

      form.appendChild(scannerSection);
    } else {
      // Manual entry
      const codeLabel = document.createElement("label");
      codeLabel.className = "lc-label";
      codeLabel.textContent = "Code";
      form.appendChild(codeLabel);

      const codeInput = document.createElement("input");
      codeInput.type = "text";
      codeInput.className = "lc-input";
      codeInput.placeholder = "Enter card code...";
      codeInput.value = this._manualCode;
      codeInput.addEventListener("input", (e) => {
        this._manualCode = e.target.value;
        this._updateSaveButton();
      });
      form.appendChild(codeInput);

      const typeLabel = document.createElement("label");
      typeLabel.className = "lc-label";
      typeLabel.textContent = "Code Type";
      form.appendChild(typeLabel);

      const typeSelect = document.createElement("select");
      typeSelect.className = "lc-input";
      Object.entries(CODE_TYPE_LABELS).forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        if (value === this._manualCodeType) option.selected = true;
        typeSelect.appendChild(option);
      });
      typeSelect.addEventListener("change", (e) => {
        this._manualCodeType = e.target.value;
      });
      form.appendChild(typeSelect);

      const scanLink = document.createElement("button");
      scanLink.className = "lc-link-btn";
      scanLink.textContent = "Use camera scanner";
      scanLink.addEventListener("click", () => {
        this._manualEntry = false;
        this._render();
      });
      form.appendChild(scanLink);
    }

    // Save button
    const saveBtn = document.createElement("button");
    saveBtn.className = "lc-save-btn";
    saveBtn.id = "lc-save-btn";
    saveBtn.textContent = "Save Card";
    saveBtn.disabled = !this._canSave();
    saveBtn.addEventListener("click", () => this._onSaveClick());
    form.appendChild(saveBtn);

    c.appendChild(form);

    // Start scanner if needed
    if (!this._manualEntry && !this._scannedCode) {
      setTimeout(() => this._startScanner(), 100);
    }
  }

  _canSave() {
    const hasName = this._addCardName.trim().length > 0;
    if (this._manualEntry) {
      return hasName && this._manualCode.trim().length > 0;
    }
    return hasName && this._scannedCode !== null;
  }

  _updateSaveButton() {
    const btn = document.getElementById("lc-save-btn");
    if (btn) {
      btn.disabled = !this._canSave();
    }
  }

  async _onSaveClick() {
    const name = this._addCardName.trim();
    let code, codeType;

    if (this._manualEntry) {
      code = this._manualCode.trim();
      codeType = this._manualCodeType;
    } else {
      code = this._scannedCode;
      codeType = this._scannedCodeType;
    }

    if (!name || !code) return;

    await this._addCard(name, code, codeType);
    this._resetAddState();
    this._view = "grid";
    this._render();
  }

  _resetAddState() {
    this._addCardName = "";
    this._scannedCode = null;
    this._scannedCodeType = null;
    this._manualEntry = false;
    this._manualCode = "";
    this._manualCodeType = "ean13";
  }

  // ---- Scanner ----

  async _startScanner() {
    const container = document.getElementById("lc-scanner-region");
    if (!container) return;

    if (!window.isSecureContext) {
      container.innerHTML = `
        <div class="lc-scanner-message">
          <p>Camera requires a secure connection (HTTPS).</p>
          <p>Use the Home Assistant Companion App or access via HTTPS.</p>
        </div>
      `;
      return;
    }

    const loaded = await this._loadScannerLib();
    if (!loaded) {
      container.innerHTML = `
        <div class="lc-scanner-message">
          <p>Failed to load scanner. Please try manual entry.</p>
        </div>
      `;
      return;
    }

    try {
      this._scanner = new Html5Qrcode("lc-scanner-region");
      await this._scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText, decodedResult) => {
          this._onScanSuccess(decodedText, decodedResult);
        },
        () => {
          // Scan error — happens every frame without a detection, ignore
        }
      );
      this._scannerRunning = true;
    } catch (e) {
      console.error("Scanner start failed:", e);
      container.innerHTML = `
        <div class="lc-scanner-message">
          <p>Could not access camera.</p>
          <p>Please check permissions or use manual entry.</p>
        </div>
      `;
    }
  }

  async _stopScanner() {
    if (this._scanner && this._scannerRunning) {
      try {
        await this._scanner.stop();
      } catch (e) {
        // Already stopped or failed
      }
      this._scannerRunning = false;
    }
  }

  async _onScanSuccess(decodedText, decodedResult) {
    await this._stopScanner();

    this._scannedCode = decodedText;

    const formatName =
      decodedResult &&
      decodedResult.result &&
      decodedResult.result.format &&
      decodedResult.result.format.formatName;
    this._scannedCodeType = SCANNER_FORMAT_MAP[formatName] || "code128";

    this._render();
  }

  // ---- Events ----

  _onCardClick(card) {
    this._selectedCard = card;
    this._codeDisplayMode = "barcode";
    this._view = "detail";
    this._render();
  }

  _onAddClick() {
    this._resetAddState();
    this._view = "add";
    this._render();
  }

  async _onDeleteClick(card) {
    if (!confirm(`Delete "${card.name}"?`)) return;
    await this._removeCard(card.id);
    this._view = "grid";
    this._render();
  }

  // ---- Helpers ----

  _nameToColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 55%, 55%)`;
  }

  _escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  _injectStyles() {
    if (document.getElementById("lc-styles")) return;
    const style = document.createElement("style");
    style.id = "lc-styles";
    style.textContent = `
      .lc-root {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        background: var(--primary-background-color, #fafafa);
        color: var(--primary-text-color, #212121);
        font-family: var(--paper-font-body1_-_font-family, Roboto, Noto, sans-serif);
        padding-bottom: 80px;
      }

      .lc-header {
        padding: 16px 16px 0 16px;
      }

      .lc-title {
        margin: 0;
        font-size: 24px;
        font-weight: 400;
        color: var(--primary-text-color, #212121);
      }

      /* Grid */
      .lc-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 12px;
        padding: 16px;
      }

      .lc-card {
        background: var(--ha-card-background, var(--card-background-color, #fff));
        border-radius: var(--ha-card-border-radius, 12px);
        box-shadow: var(--ha-card-box-shadow, 0 2px 4px rgba(0,0,0,0.1));
        padding: 16px;
        display: flex;
        flex-direction: column;
        align-items: center;
        cursor: pointer;
        transition: transform 0.15s, box-shadow 0.15s;
        -webkit-tap-highlight-color: transparent;
        min-height: 120px;
        justify-content: center;
      }

      .lc-card:active {
        transform: scale(0.97);
      }

      .lc-card-initial {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        font-weight: 500;
        color: #fff;
        margin-bottom: 8px;
      }

      .lc-card-name {
        font-size: 14px;
        font-weight: 500;
        text-align: center;
        word-break: break-word;
        color: var(--primary-text-color, #212121);
      }

      /* Empty state */
      .lc-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 64px 16px;
        text-align: center;
      }

      .lc-empty-icon {
        color: var(--secondary-text-color, #727272);
        opacity: 0.5;
        margin-bottom: 16px;
      }

      .lc-empty-title {
        font-size: 18px;
        font-weight: 500;
        color: var(--primary-text-color, #212121);
        margin: 0 0 4px 0;
      }

      .lc-empty-subtitle {
        font-size: 14px;
        color: var(--secondary-text-color, #727272);
        margin: 0;
      }

      /* FAB */
      .lc-fab {
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: var(--primary-color, #03a9f4);
        color: var(--text-primary-color, #fff);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        transition: transform 0.15s;
        z-index: 10;
        -webkit-tap-highlight-color: transparent;
      }

      .lc-fab:active {
        transform: scale(0.92);
      }

      /* Top bar */
      .lc-topbar {
        display: flex;
        align-items: center;
        padding: 8px;
        gap: 8px;
        border-bottom: 1px solid var(--divider-color, #e0e0e0);
        background: var(--ha-card-background, var(--card-background-color, #fff));
      }

      .lc-topbar-title {
        flex: 1;
        font-size: 18px;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .lc-icon-btn {
        background: none;
        border: none;
        cursor: pointer;
        padding: 8px;
        border-radius: 50%;
        color: var(--primary-text-color, #212121);
        display: flex;
        align-items: center;
        justify-content: center;
        -webkit-tap-highlight-color: transparent;
      }

      .lc-icon-btn:active {
        background: var(--secondary-background-color, rgba(0,0,0,0.06));
      }

      .lc-delete-btn {
        color: var(--error-color, #db4437);
      }

      /* Code display */
      .lc-code-area {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 24px 16px;
      }

      .lc-code-container {
        max-width: 100%;
        overflow: auto;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .lc-code-container svg {
        max-width: 100%;
        height: auto;
      }

      .lc-raw-code {
        margin-top: 12px;
        font-size: 16px;
        font-family: monospace;
        color: var(--secondary-text-color, #727272);
        word-break: break-all;
        text-align: center;
      }

      .lc-code-error {
        color: var(--secondary-text-color, #727272);
        font-size: 14px;
        padding: 24px;
        text-align: center;
      }

      /* Toggle buttons */
      .lc-toggle-row {
        display: flex;
        justify-content: center;
        gap: 8px;
        padding: 16px;
      }

      .lc-toggle-btn {
        padding: 8px 24px;
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 20px;
        background: transparent;
        color: var(--primary-text-color, #212121);
        cursor: pointer;
        font-size: 14px;
        transition: background 0.15s, color 0.15s;
        -webkit-tap-highlight-color: transparent;
      }

      .lc-toggle-active {
        background: var(--primary-color, #03a9f4);
        color: var(--text-primary-color, #fff);
        border-color: var(--primary-color, #03a9f4);
      }

      /* Add form */
      .lc-add-form {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .lc-label {
        font-size: 12px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--secondary-text-color, #727272);
      }

      .lc-input {
        width: 100%;
        padding: 12px;
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 8px;
        font-size: 16px;
        background: var(--ha-card-background, var(--card-background-color, #fff));
        color: var(--primary-text-color, #212121);
        box-sizing: border-box;
        font-family: inherit;
      }

      .lc-input:focus {
        outline: none;
        border-color: var(--primary-color, #03a9f4);
      }

      /* Scanner */
      .lc-scanner-section {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
      }

      .lc-scanner-container {
        width: 100%;
        max-width: 400px;
        min-height: 300px;
        border-radius: 8px;
        overflow: hidden;
        background: #000;
      }

      .lc-scanner-message {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 200px;
        padding: 24px;
        text-align: center;
        color: var(--secondary-text-color, #727272);
        font-size: 14px;
      }

      .lc-scanner-message p {
        margin: 4px 0;
      }

      .lc-link-btn {
        background: none;
        border: none;
        color: var(--primary-color, #03a9f4);
        cursor: pointer;
        font-size: 14px;
        padding: 8px;
        -webkit-tap-highlight-color: transparent;
      }

      /* Scanned info */
      .lc-scanned-info {
        background: var(--ha-card-background, var(--card-background-color, #fff));
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 8px;
        padding: 16px;
        text-align: center;
        width: 100%;
        box-sizing: border-box;
      }

      .lc-scanned-label {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--secondary-text-color, #727272);
        margin-bottom: 8px;
      }

      .lc-scanned-code {
        font-size: 18px;
        font-family: monospace;
        font-weight: 500;
        color: var(--primary-text-color, #212121);
        word-break: break-all;
      }

      .lc-scanned-type {
        font-size: 13px;
        color: var(--secondary-text-color, #727272);
        margin-top: 4px;
      }

      /* Save button */
      .lc-save-btn {
        width: 100%;
        padding: 14px;
        border: none;
        border-radius: 8px;
        background: var(--primary-color, #03a9f4);
        color: var(--text-primary-color, #fff);
        font-size: 16px;
        font-weight: 500;
        cursor: pointer;
        margin-top: 8px;
        -webkit-tap-highlight-color: transparent;
      }

      .lc-save-btn:disabled {
        opacity: 0.5;
        cursor: default;
      }

      .lc-save-btn:not(:disabled):active {
        opacity: 0.85;
      }
    `;
    document.head.appendChild(style);
  }
}

customElements.define("loyalty-cards-panel", LoyaltyCardsPanel);
