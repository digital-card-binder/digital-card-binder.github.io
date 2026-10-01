
"use strict";

(function () {
  const registry = window.CollectorCollectionRegistry;
  const catalogService = window.DigitalCardBinder?.catalog;
  const accountCore = window.DigitalCardBinder?.firebaseAccount;
  const CONFIG = window.POKEMON_DEX_FIREBASE || {};
  if (!registry || !catalogService || !accountCore) return;

  const SDK_VERSION = "12.16.0";
  const OCR_SCRIPT = "https://cdn.jsdelivr.net/npm/tesseract.js@6.0.0/dist/tesseract.min.js";
  const FIXED_COLLECTIONS = [
    "ar",
    "pokemon",
    "artist",
    "trainerPokemon",
    "fossil",
  ];

  const state = {
    cards: null,
    pokedex: null,
    selected: null,
    memberships: [],
    ocrWorker: null,
    ocrLoading: null,
    firebase: null,
    user: null,
    documentCache: new Map(),
    membershipCatalogs: new Map(),
    previewUrl: "",
    busy: false,
  };

  const els = {};
  const clean = (value) => String(value || "").trim();

  function normalizeSetCode(value) {
    return clean(value)
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9+\-]/g, "");
  }

  function parseCardNumber(value) {
    const text = clean(value).replace(/\s+/g, "");
    const slash =
      text.match(/(?:^|[_:\-])0*(\d{1,4})\/0*(\d{1,4})(?:\D|$)/i) ||
      text.match(/^0*(\d{1,4})\/0*(\d{1,4})(?:\D|$)/i);
    if (slash) {
      return {
        numerator: String(Number(slash[1])),
        denominator: String(Number(slash[2])),
      };
    }

    const separated = text.match(/(?:_|\-)(0*\d{1,4})(?:\D|$)/i);
    if (separated) {
      return { numerator: String(Number(separated[1])), denominator: "" };
    }

    const leading = text.match(/^0*(\d{1,4})(?:\D|$)/);
    return leading
      ? { numerator: String(Number(leading[1])), denominator: "" }
      : { numerator: "", denominator: "" };
  }

  function cardFingerprint(setCode, cardNumber) {
    const set = normalizeSetCode(setCode);
    const parsed = parseCardNumber(cardNumber);
    return set && parsed.numerator ? set + "::" + parsed.numerator : "";
  }

  function decodeImage(value, imageBase) {
    const source = clean(value);
    if (!source) return "";
    return source.startsWith("@/") ? imageBase + source.slice(1) : source;
  }

  async function loadSearchCards() {
    if (state.cards && state.pokedex) return;
    const payload = await catalogService.pokemonSearchIndex();
    const imageBase = clean(payload?.imageBase);
    state.pokedex = (Array.isArray(payload?.pokedex) ? payload.pokedex : []).map(
      ([number, nameKo, nameEn]) => ({ number, nameKo, nameEn }),
    );

    const cards = [];
    for (const group of Array.isArray(payload?.groups) ? payload.groups : []) {
      const [setCode, title, displayName, era, rawCards] = group;
      for (const entry of Array.isArray(rawCards) ? rawCards : []) {
        const [
          rawCode,
          name,
          pokemonName,
          image,
          meta,
          cardNumberValue,
          accountIndex,
          owned,
          originalImage,
          rarity,
          illustrators,
          trainers,
        ] = entry;
        const parsed = parseCardNumber(cardNumberValue || rawCode || meta);
        cards.push({
          setCode: clean(setCode),
          setTitle: clean(displayName || title || setCode),
          era: clean(era),
          rawCode: clean(rawCode),
          name: clean(name || pokemonName || rawCode),
          pokemonName: clean(pokemonName),
          image: decodeImage(image || originalImage, imageBase),
          originalImage: decodeImage(originalImage || image, imageBase),
          meta: clean(meta),
          cardNumber: clean(cardNumberValue || rawCode || meta),
          numerator: parsed.numerator,
          denominator: parsed.denominator,
          accountIndex: Number.isInteger(accountIndex) ? accountIndex : null,
          rarity: clean(rarity),
          illustrators: clean(illustrators).split("|").map(clean).filter(Boolean),
          trainers: clean(trainers).split("|").map(clean).filter(Boolean),
          baselineOwned: owned === 1,
        });
      }
    }
    state.cards = cards;
  }

  function cameraSvg() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5h3l1.3-2h7.4l1.3 2h3a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9.5a2 2 0 0 1 2-2Z"></path><circle cx="12" cy="13" r="4"></circle></svg>';
  }

  function buildUi() {
    if (document.querySelector("#card-scan-fab")) return;

    const fab = document.createElement("button");
    fab.id = "card-scan-fab";
    fab.className = "card-scan-fab";
    fab.type = "button";
    fab.setAttribute("aria-label", "카드 스캔");
    fab.innerHTML = cameraSvg() + "<span>스캔</span>";
    document.body.append(fab);

    const dialog = document.createElement("dialog");
    dialog.id = "card-scan-sheet";
    dialog.className = "card-scan-sheet";
    dialog.innerHTML =
      '<div class="card-scan-shell">' +
        '<div class="card-scan-head">' +
          '<div><strong>카드 스캔</strong><span>사진으로 카드를 찾고 도감별로 선택 등록</span></div>' +
          '<button class="card-scan-close" type="button" aria-label="닫기">×</button>' +
        '</div>' +
        '<div class="card-scan-body">' +
          '<div class="card-scan-start">' +
            '<input id="card-scan-camera-input" type="file" accept="image/*" capture="environment" hidden>' +
            '<input id="card-scan-file-input" type="file" accept="image/*" hidden>' +
            '<button id="card-scan-camera" class="card-scan-camera" type="button">' + cameraSvg() + '<span>카드 촬영</span></button>' +
            '<button id="card-scan-file" class="card-scan-secondary" type="button">앨범에서 선택</button>' +
            '<p class="card-scan-help">카드 전체가 프레임 안에 들어오도록 찍어주세요. 카드번호가 있는 하단 영역을 우선 인식합니다.</p>' +
            '<div class="card-scan-manual">' +
              '<input id="card-scan-set" type="text" autocomplete="off" placeholder="세트코드 예: sv2a">' +
              '<input id="card-scan-number" type="text" autocomplete="off" placeholder="카드번호 예: 142/165">' +
              '<button id="card-scan-manual-search" class="card-scan-secondary" type="button">직접 검색</button>' +
            '</div>' +
          '</div>' +
          '<div id="card-scan-preview" class="card-scan-preview" hidden>' +
            '<img id="card-scan-preview-image" alt="촬영한 카드">' +
            '<div class="card-scan-preview-copy"><strong id="card-scan-preview-title">카드 분석 중</strong><span id="card-scan-preview-meta"></span><small id="card-scan-ocr-text"></small></div>' +
          '</div>' +
          '<div id="card-scan-status" class="card-scan-status" role="status"></div>' +
          '<div class="card-scan-progress" aria-hidden="true"><span id="card-scan-progress-bar"></span></div>' +
          '<section id="card-scan-candidate-section" class="card-scan-section" hidden>' +
            '<div class="card-scan-section-head"><strong>인식 후보</strong><span id="card-scan-candidate-count"></span></div>' +
            '<div id="card-scan-candidates" class="card-scan-candidates"></div>' +
          '</section>' +
          '<section id="card-scan-membership-section" class="card-scan-section" hidden>' +
            '<div class="card-scan-section-head"><strong>등록할 도감</strong><span>도감별 보유상태는 서로 독립</span></div>' +
            '<div id="card-scan-memberships" class="card-scan-memberships"></div>' +
            '<div class="card-scan-membership-actions"><button id="card-scan-select-all" type="button">미보유 도감 전체 선택</button></div>' +
            '<div class="card-scan-save-row">' +
              '<button id="card-scan-next" class="card-scan-next" type="button">다음 카드</button>' +
              '<button id="card-scan-save" class="card-scan-save" type="button">선택한 도감에 등록</button>' +
            '</div>' +
            '<p class="card-scan-privacy">촬영 이미지는 카드번호 인식을 위해 현재 기기에서 처리하며 도감 저장 시 사진 자체는 업로드하지 않습니다.</p>' +
          '</section>' +
        '</div>' +
      '</div>';
    document.body.append(dialog);

    Object.assign(els, {
      fab,
      dialog,
      close: dialog.querySelector(".card-scan-close"),
      cameraInput: dialog.querySelector("#card-scan-camera-input"),
      fileInput: dialog.querySelector("#card-scan-file-input"),
      camera: dialog.querySelector("#card-scan-camera"),
      file: dialog.querySelector("#card-scan-file"),
      manualSet: dialog.querySelector("#card-scan-set"),
      manualNumber: dialog.querySelector("#card-scan-number"),
      manualSearch: dialog.querySelector("#card-scan-manual-search"),
      preview: dialog.querySelector("#card-scan-preview"),
      previewImage: dialog.querySelector("#card-scan-preview-image"),
      previewTitle: dialog.querySelector("#card-scan-preview-title"),
      previewMeta: dialog.querySelector("#card-scan-preview-meta"),
      ocrText: dialog.querySelector("#card-scan-ocr-text"),
      status: dialog.querySelector("#card-scan-status"),
      progress: dialog.querySelector("#card-scan-progress-bar"),
      candidateSection: dialog.querySelector("#card-scan-candidate-section"),
      candidateCount: dialog.querySelector("#card-scan-candidate-count"),
      candidates: dialog.querySelector("#card-scan-candidates"),
      membershipSection: dialog.querySelector("#card-scan-membership-section"),
      memberships: dialog.querySelector("#card-scan-memberships"),
      selectAll: dialog.querySelector("#card-scan-select-all"),
      save: dialog.querySelector("#card-scan-save"),
      next: dialog.querySelector("#card-scan-next"),
    });

    fab.addEventListener("click", openScanner);
    els.close.addEventListener("click", closeScanner);
    els.dialog.addEventListener("click", (event) => {
      if (event.target === els.dialog) closeScanner();
    });
    els.camera.addEventListener("click", () => els.cameraInput.click());
    els.file.addEventListener("click", () => els.fileInput.click());
    els.cameraInput.addEventListener("change", onPhotoSelected);
    els.fileInput.addEventListener("change", onPhotoSelected);
    els.manualSearch.addEventListener("click", manualSearch);
    els.selectAll.addEventListener("click", selectAllMissing);
    els.save.addEventListener("click", saveSelectedMemberships);
    els.next.addEventListener("click", () => {
      resetScanner();
      window.setTimeout(() => els.cameraInput.click(), 60);
    });
  }

  function openScanner() {
    resetScanner();
    if (typeof els.dialog.showModal === "function") els.dialog.showModal();
    else els.dialog.setAttribute("open", "");
    void loadSearchCards().catch((error) => {
      console.error(error);
      setStatus("카드 DB를 불러오지 못했습니다.", "error");
    });
  }

  function closeScanner() {
    if (typeof els.dialog.close === "function") els.dialog.close();
    else els.dialog.removeAttribute("open");
  }

  function resetScanner() {
    state.selected = null;
    state.memberships = [];
    state.documentCache.clear();
    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = "";
    if (els.preview) els.preview.hidden = true;
    if (els.candidateSection) els.candidateSection.hidden = true;
    if (els.membershipSection) els.membershipSection.hidden = true;
    if (els.candidates) els.candidates.replaceChildren();
    if (els.memberships) els.memberships.replaceChildren();
    if (els.previewTitle) els.previewTitle.textContent = "카드 분석 중";
    if (els.previewMeta) els.previewMeta.textContent = "";
    if (els.ocrText) els.ocrText.textContent = "";
    if (els.manualSet) els.manualSet.value = "";
    if (els.manualNumber) els.manualNumber.value = "";
    if (els.cameraInput) els.cameraInput.value = "";
    if (els.fileInput) els.fileInput.value = "";
    setProgress(0);
    setStatus("카드를 촬영하거나 세트코드와 카드번호를 직접 입력하세요.");
    setBusy(false);
  }

  function setStatus(message, stateName = "") {
    if (!els.status) return;
    els.status.textContent = message;
    els.status.dataset.state = stateName;
  }

  function setProgress(value) {
    if (!els.progress) return;
    const amount = Math.max(0, Math.min(100, Number(value) || 0));
    els.progress.style.width = amount + "%";
  }

  function setBusy(busy) {
    state.busy = Boolean(busy);
    [els.camera, els.file, els.manualSearch, els.save, els.next]
      .filter(Boolean)
      .forEach((button) => {
        button.disabled = state.busy;
      });
  }

  function loadExternalScript(src) {
    return new Promise((resolve, reject) => {
      const existing = [...document.scripts].find((script) => script.src === src);
      if (existing && window.Tesseract) {
        resolve();
        return;
      }
      const script = existing || document.createElement("script");
      if (!existing) {
        script.src = src;
        script.async = true;
        script.crossOrigin = "anonymous";
        document.head.append(script);
      }
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", () => reject(new Error("OCR 모듈을 불러오지 못했습니다.")), { once: true });
    });
  }

  async function ensureOcrWorker() {
    if (state.ocrWorker) return state.ocrWorker;
    if (state.ocrLoading) return state.ocrLoading;

    state.ocrLoading = (async () => {
      await loadExternalScript(OCR_SCRIPT);
      if (!window.Tesseract?.createWorker) throw new Error("OCR 모듈을 초기화하지 못했습니다.");
      const worker = await window.Tesseract.createWorker("eng", 1, {
        logger(message) {
          if (message?.status === "recognizing text") {
            setProgress(15 + Math.round((Number(message.progress) || 0) * 70));
          }
        },
      });
      state.ocrWorker = worker;
      return worker;
    })();

    try {
      return await state.ocrLoading;
    } finally {
      state.ocrLoading = null;
    }
  }

  async function imageBitmapFromFile(file) {
    if (typeof createImageBitmap === "function") return createImageBitmap(file);
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      return image;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function enhanceOcrCanvas(canvas, mode = "contrast") {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const gray =
        pixels.data[i] * 0.299 +
        pixels.data[i + 1] * 0.587 +
        pixels.data[i + 2] * 0.114;
      const adjusted =
        mode === "binary"
          ? gray > 150 ? 255 : 0
          : gray > 145
            ? Math.min(255, gray * 1.22)
            : Math.max(0, gray * 0.66);
      pixels.data[i] = adjusted;
      pixels.data[i + 1] = adjusted;
      pixels.data[i + 2] = adjusted;
    }
    context.putImageData(pixels, 0, 0);
    return canvas;
  }

  function makeOcrRegionCanvas(image, region) {
    const width = image.width || image.naturalWidth;
    const height = image.height || image.naturalHeight;
    const sourceX = Math.max(0, Math.floor(width * region.x));
    const sourceY = Math.max(0, Math.floor(height * region.y));
    const sourceW = Math.max(1, Math.floor(width * region.width));
    const sourceH = Math.max(1, Math.floor(height * region.height));
    const targetWidth = Math.min(
      region.maxWidth || 2200,
      Math.max(1200, Math.round(sourceW * (region.scale || 3))),
    );
    const scale = targetWidth / sourceW;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sourceW * scale));
    canvas.height = Math.max(1, Math.round(sourceH * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceW,
      sourceH,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    return enhanceOcrCanvas(canvas, region.mode || "contrast");
  }

  async function makeOcrCanvases(file) {
    const image = await imageBitmapFromFile(file);
    try {
      // Korean cards place set code / collector number near the lower-left edge.
      // Read that tiny region first, then widen the search only when necessary.
      return [
        makeOcrRegionCanvas(image, {
          x: 0.00,
          y: 0.76,
          width: 0.70,
          height: 0.24,
          scale: 4.2,
          maxWidth: 2400,
          mode: "contrast",
        }),
        makeOcrRegionCanvas(image, {
          x: 0.00,
          y: 0.68,
          width: 1.00,
          height: 0.32,
          scale: 2.8,
          maxWidth: 2200,
          mode: "contrast",
        }),
        makeOcrRegionCanvas(image, {
          x: 0.00,
          y: 0.58,
          width: 1.00,
          height: 0.42,
          scale: 2.2,
          maxWidth: 2000,
          mode: "binary",
        }),
      ];
    } finally {
      if (typeof image.close === "function") image.close();
    }
  }

  function hasStrongOcrSignal(text) {
    return Boolean(
      ocrFractions(text).length ||
      (detectedSetCodes(text).length && ocrNumberTokens(text).length),
    );
  }

  async function onPhotoSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = URL.createObjectURL(file);
    els.previewImage.src = state.previewUrl;
    els.preview.hidden = false;
    els.previewTitle.textContent = "카드번호 인식 중";
    els.previewMeta.textContent = "카드 왼쪽 아래의 세트코드·카드번호를 먼저 확대 분석합니다.";
    els.ocrText.textContent = "";
    els.candidateSection.hidden = true;
    els.membershipSection.hidden = true;
    setBusy(true);
    setProgress(8);
    setStatus("처음 사용할 때는 OCR 모듈을 내려받아 시간이 조금 더 걸릴 수 있습니다.", "loading");

    try {
      await loadSearchCards();
      const worker = await ensureOcrWorker();
      const canvases = await makeOcrCanvases(file);
      const texts = [];
      let candidates = [];

      for (let index = 0; index < canvases.length; index += 1) {
        setProgress(18 + Math.round((index / canvases.length) * 60));
        const result = await worker.recognize(canvases[index]);
        const text = clean(result?.data?.text);
        if (text) texts.push(text);
        const combined = texts.join("\n");
        candidates = findCandidatesFromOcr(combined);
        if (candidates.length && hasStrongOcrSignal(combined)) break;
      }

      const combinedText = texts.join(" ");
      els.ocrText.textContent = combinedText
        ? "인식: " + combinedText.replace(/\s+/g, " ").slice(0, 120)
        : "카드번호 텍스트를 읽지 못했습니다.";

      renderCandidates(candidates);
      if (!candidates.length) {
        setStatus(
          "자동 인식 후보를 찾지 못했습니다. 세트코드와 카드번호를 직접 입력해 주세요.",
          "error",
        );
      } else {
        setStatus("후보 카드가 맞는지 확인해 주세요.", "success");
      }
      setProgress(100);
    } catch (error) {
      console.error(error);
      setStatus("자동 인식에 실패했습니다. 직접 검색은 계속 사용할 수 있습니다.", "error");
      setProgress(0);
    } finally {
      setBusy(false);
    }
  }

  function compactOcr(value) {
    return clean(value).toLowerCase().replace(/[^a-z0-9+]/g, "");
  }

  function ocrFractions(text) {
    const values = [];
    const source = clean(text)
      .replace(/[|\\]/g, "/")
      .replace(/[Oo]/g, "0")
      .replace(/[Il]/g, "1");
    const regex = /(\d{1,4})\s*\/\s*(\d{1,4})/g;
    let match;
    while ((match = regex.exec(source))) {
      values.push({
        numerator: String(Number(match[1])),
        denominator: String(Number(match[2])),
      });
    }
    return values;
  }

  function ocrNumberTokens(text) {
    const source = clean(text)
      .replace(/[Oo]/g, "0")
      .replace(/[Il]/g, "1");
    return [...new Set(
      (source.match(/\b\d{1,4}\b/g) || [])
        .map((value) => String(Number(value)))
        .filter((value) => value !== "0"),
    )];
  }

  function editDistanceAtMostOne(left, right) {
    if (left === right) return true;
    if (Math.abs(left.length - right.length) > 1) return false;
    let i = 0;
    let j = 0;
    let edits = 0;
    while (i < left.length && j < right.length) {
      if (left[i] === right[j]) {
        i += 1;
        j += 1;
        continue;
      }
      edits += 1;
      if (edits > 1) return false;
      if (left.length > right.length) i += 1;
      else if (right.length > left.length) j += 1;
      else {
        i += 1;
        j += 1;
      }
    }
    if (i < left.length || j < right.length) edits += 1;
    return edits <= 1;
  }

  function detectedSetCodes(text) {
    const compact = compactOcr(text);
    if (!compact || !state.cards) return [];
    const codes = [...new Set(state.cards.map((card) => normalizeSetCode(card.setCode)).filter(Boolean))]
      .sort((a, b) => b.length - a.length);

    const exact = codes.filter((code) =>
      compact.includes(code.replace(/[^a-z0-9+]/g, "")),
    );
    if (exact.length) return exact.slice(0, 4);

    const fuzzy = [];
    for (const code of codes) {
      const target = code.replace(/[^a-z0-9+]/g, "");
      if (target.length < 4 || compact.length < Math.max(3, target.length - 1)) continue;
      for (let start = 0; start < compact.length; start += 1) {
        for (const length of [target.length - 1, target.length, target.length + 1]) {
          if (length < 3 || start + length > compact.length) continue;
          if (editDistanceAtMostOne(compact.slice(start, start + length), target)) {
            fuzzy.push(code);
            start = compact.length;
            break;
          }
        }
      }
      if (fuzzy.length >= 4) break;
    }
    return fuzzy;
  }

  function findCandidatesFromOcr(text) {
    if (!state.cards) return [];
    const fractions = ocrFractions(text);
    const numbers = ocrNumberTokens(text);
    const sets = detectedSetCodes(text);
    const compact = compactOcr(text);
    const scored = [];

    for (const card of state.cards) {
      let score = 0;
      const set = normalizeSetCode(card.setCode);
      if (sets.includes(set)) score += 120;

      for (const fraction of fractions) {
        if (card.numerator === fraction.numerator) {
          score += 65;
          if (card.denominator && card.denominator === fraction.denominator) score += 95;
        }
      }
      if (!fractions.length && numbers.includes(card.numerator)) score += 38;

      const rawCompact = compactOcr(card.rawCode);
      if (rawCompact && compact.includes(rawCompact)) score += 220;
      if (score > 0) scored.push({ card, score });
    }

    scored.sort((a, b) => b.score - a.score);
    if (!scored.length) return [];
    const top = scored[0].score;
    return scored
      .filter((item) => item.score >= Math.max(38, top - 85))
      .slice(0, 10)
      .map((item) => item.card);
  }

  function manualSearch() {
    void (async () => {
      await loadSearchCards();
      const set = normalizeSetCode(els.manualSet.value);
      const parsed = parseCardNumber(els.manualNumber.value);
      if (!set && !parsed.numerator) {
        setStatus("세트코드 또는 카드번호를 입력해 주세요.", "error");
        return;
      }

      const candidates = state.cards
        .filter((card) => !set || normalizeSetCode(card.setCode) === set)
        .filter((card) => !parsed.numerator || card.numerator === parsed.numerator)
        .filter((card) => !parsed.denominator || !card.denominator || card.denominator === parsed.denominator)
        .slice(0, 16);

      renderCandidates(candidates);
      if (candidates.length) setStatus("검색 결과에서 카드를 선택해 주세요.", "success");
      else setStatus("일치하는 카드를 찾지 못했습니다.", "error");
    })().catch((error) => {
      console.error(error);
      setStatus("카드 검색에 실패했습니다.", "error");
    });
  }

  function renderCandidates(candidates) {
    els.candidates.replaceChildren();
    els.candidateSection.hidden = false;
    els.candidateCount.textContent = String(candidates.length) + "개";

    for (const card of candidates) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "card-scan-candidate";

      const image = document.createElement("img");
      image.src = card.image || card.originalImage || "";
      image.alt = "";

      const copy = document.createElement("span");
      const name = document.createElement("strong");
      name.textContent = card.name || card.pokemonName || card.rawCode;
      const meta = document.createElement("small");
      meta.textContent = [
        card.setCode,
        card.cardNumber || card.rawCode,
        card.rarity,
      ].filter(Boolean).join(" · ");
      copy.append(name, meta);
      button.append(image, copy);

      button.addEventListener("click", () => {
        els.candidates.querySelectorAll(".card-scan-candidate").forEach((item) => item.classList.remove("is-selected"));
        button.classList.add("is-selected");
        void selectCard(card);
      });
      els.candidates.append(button);
    }

    if (candidates.length === 1) {
      els.candidates.firstElementChild?.classList.add("is-selected");
      void selectCard(candidates[0]);
    }
  }

  function groupName(collectionId, group) {
    if (collectionId === "artist") return clean(group?.name);
    if (collectionId === "series" || collectionId === "ar") {
      return [clean(group?.code), clean(group?.displayName || group?.title)].filter(Boolean).join(" · ");
    }
    return clean(group?.name || group?.title || group?.code);
  }

  function fingerprintForCollectionCard(collectionId, group, card) {
    if (collectionId === "series" || collectionId === "ar") {
      return cardFingerprint(group?.code, card?.cardNumber || card?.code || card?.meta);
    }
    if (collectionId === "pokemon") {
      const chunks = clean(card?.meta).split("·").map(clean).filter(Boolean);
      const number = chunks[0] || card?.cardNumber || card?.code || "";
      const set = chunks.length >= 2 ? chunks[chunks.length - 1] : "";
      return cardFingerprint(set, number);
    }
    if (collectionId === "artist") {
      return cardFingerprint(card?.set, card?.cardNumber);
    }
    if (collectionId === "trainerPokemon" || collectionId === "fossil") {
      return cardFingerprint(
        card?.set || group?.set || group?.code,
        card?.cardNumber || card?.code || card?.meta,
      );
    }
    return "";
  }

  async function groupsForCollection(collectionId) {
    if (state.membershipCatalogs.has(collectionId)) {
      return state.membershipCatalogs.get(collectionId);
    }

    let groups = [];
    if (collectionId === "series") {
      groups = await catalogService.series();
    } else if (collectionId === "ar") {
      groups = await catalogService.ar();
    } else if (collectionId === "pokemon") {
      groups = await catalogService.pokemonCollections();
    } else if (collectionId === "artist") {
      groups = (await catalogService.json("./data/artists.json"))?.artists || [];
    } else if (collectionId === "trainerPokemon") {
      groups = (await catalogService.json("./data/trainer-pokemon.json"))?.groups || [];
    } else if (collectionId === "fossil") {
      groups = (await catalogService.json("./data/fossil.json"))?.groups || [];
    }
    state.membershipCatalogs.set(collectionId, groups);
    return groups;
  }

  async function exactMemberships(card) {
    const fingerprint = cardFingerprint(card.setCode, card.rawCode || card.cardNumber);
    if (!fingerprint) return [];
    const output = [];

    if (Number.isInteger(card.accountIndex)) {
      const group = { code: card.setCode };
      const sourceCard = {
        code: card.rawCode,
        meta: card.meta,
        accountIndex: card.accountIndex,
      };
      const key = registry.cardIdentity("series", group, sourceCard, 0, card.accountIndex);
      output.push({
        id: "series:" + key,
        collectionId: "series",
        key,
        title: registry.COLLECTIONS?.series?.title || "시리즈 도감",
        groupName: [card.setCode, card.setTitle].filter(Boolean).join(" · "),
        mode: "fixed",
        owned: false,
        baselineOwned: Boolean(card.baselineOwned),
        defaultSelected: true,
      });
    } else {
      const groups = await groupsForCollection("series");
      groups.forEach((group, groupIndex) => {
        (group.cards || []).forEach((candidate, cardIndex) => {
          if (fingerprintForCollectionCard("series", group, candidate) !== fingerprint) return;
          const key = registry.cardIdentity("series", group, candidate, groupIndex, cardIndex);
          output.push({
            id: "series:" + key,
            collectionId: "series",
            key,
            title: registry.COLLECTIONS?.series?.title || "시리즈 도감",
            groupName: groupName("series", group),
            mode: "fixed",
            owned: false,
            baselineOwned: Boolean(candidate.owned),
            defaultSelected: true,
          });
        });
      });
    }

    const collections = FIXED_COLLECTIONS.filter((collectionId) => {
      if (collectionId === "pokemon" && !clean(card.pokemonName)) return false;
      if (collectionId === "artist" && !(card.illustrators || []).length) return false;
      if (collectionId === "trainerPokemon" && !(card.trainers || []).length) return false;
      return true;
    });

    for (const collectionId of collections) {
      const groups = await groupsForCollection(collectionId);
      groups.forEach((group, groupIndex) => {
        (group.cards || []).forEach((candidate, cardIndex) => {
          if (fingerprintForCollectionCard(collectionId, group, candidate) !== fingerprint) return;
          const key = registry.cardIdentity(collectionId, group, candidate, groupIndex, cardIndex);
          output.push({
            id: collectionId + ":" + key,
            collectionId,
            key,
            title: registry.COLLECTIONS?.[collectionId]?.title || collectionId,
            groupName: groupName(collectionId, group),
            mode: "fixed",
            owned: false,
            baselineOwned: Boolean(candidate.owned),
            defaultSelected: false,
          });
        });
      });
    }

    const pokemonName = clean(card.pokemonName || card.name);
    const pokemon = state.pokedex?.find((item) => item.nameKo === pokemonName);
    if (pokemon) {
      output.push({
        id: "national:" + pokemon.number,
        collectionId: "national",
        key: String(pokemon.number),
        title: "전국도감",
        groupName: "#" + String(pokemon.number).padStart(4, "0") + " " + pokemon.nameKo + " · 이 카드를 대표카드로 등록",
        mode: "representative",
        owned: false,
        baselineOwned: false,
        defaultSelected: false,
      });
    }

    await ensureFirebase().catch(() => null);
    if (state.user) {
      const customDocument = await readDocument("pokemonCollectionsDex").catch(() => ({}));
      const customDexes =
        customDocument?.customDexes &&
        typeof customDocument.customDexes === "object" &&
        !Array.isArray(customDocument.customDexes)
          ? customDocument.customDexes
          : {};

      Object.entries(customDexes).forEach(([dexId, dex]) => {
        const entries = Array.isArray(dex?.cards) ? dex.cards : [];
        entries.forEach((entry) => {
          const entryFingerprint = entry?.manual
            ? cardFingerprint(entry.manual.setCode, entry.manual.cardNumber)
            : (() => {
                const parts = clean(entry?.key).split("::");
                return parts.length >= 2
                  ? cardFingerprint(parts[0], parts.slice(1).join("::"))
                  : "";
              })();
          if (!entryFingerprint || entryFingerprint !== fingerprint) return;

          output.push({
            id: "custom:" + dexId + ":" + clean(entry.key),
            collectionId: "custom",
            key: clean(entry.key),
            title: "나만의 도감",
            groupName: clean(dex?.title) || "커스텀 도감",
            mode: "custom",
            customDexId: dexId,
            owned: Boolean(entry.owned),
            baselineOwned: false,
            defaultSelected: false,
          });
        });
      });
    }

    return output;
  }

  async function ensureFirebase() {
    if (state.firebase) return state.firebase;
    const config = CONFIG.config || {};
    if (!CONFIG.enabled || !config.apiKey || !config.authDomain || !config.projectId) {
      throw new Error("Firebase 설정을 확인할 수 없습니다.");
    }

    const [appModule, authModule, firestoreModule] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/" + SDK_VERSION + "/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/" + SDK_VERSION + "/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/" + SDK_VERSION + "/firebase-firestore.js"),
    ]);
    const app = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(config);
    const auth = authModule.getAuth(app);
    const db = firestoreModule.getFirestore(app);
    state.firebase = { app, auth, db, authModule, firestoreModule };
    state.user = await accountCore.firstAuthUser(auth, authModule);
    return state.firebase;
  }

  async function ensureSignedIn() {
    const firebase = await ensureFirebase();
    if (state.user) return state.user;

    const provider = new firebase.authModule.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const result = await firebase.authModule.signInWithPopup(firebase.auth, provider);
    state.user = result.user || firebase.auth.currentUser;
    if (!state.user) throw new Error("Google 로그인 후 다시 시도해 주세요.");
    state.documentCache.clear();
    return state.user;
  }

  async function readDocument(documentId) {
    if (state.documentCache.has(documentId)) return state.documentCache.get(documentId);
    await ensureFirebase();
    if (!state.user) return {};
    const ref = accountCore.documentRef(
      state.firebase.firestoreModule,
      state.firebase.db,
      state.user,
      CONFIG,
      documentId,
    );
    const snapshot = await state.firebase.firestoreModule.getDoc(ref);
    const data = snapshot.exists() ? snapshot.data() || {} : {};
    state.documentCache.set(documentId, data);
    return data;
  }

  function overrideOwned(value) {
    if (typeof value === "boolean") return value;
    return Boolean(value && typeof value === "object" && !Array.isArray(value) && value.owned);
  }

  async function existingOverride(documentId, key) {
    await ensureFirebase();
    if (!state.user) return null;
    const ref = accountCore.documentRef(
      state.firebase.firestoreModule,
      state.firebase.db,
      state.user,
      CONFIG,
      documentId,
    );

    if (accountCore.usesOverrideShards(documentId)) {
      const shard = state.firebase.firestoreModule.doc(
        ref,
        "overrideShards",
        accountCore.overrideShardId(key),
      );
      const snapshot = await state.firebase.firestoreModule.getDoc(shard);
      const overrides = snapshot.exists() ? snapshot.data()?.overrides || {} : {};
      return Object.prototype.hasOwnProperty.call(overrides, key)
        ? overrides[key]
        : null;
    }

    const data = await readDocument(documentId);
    const overrides =
      data?.overrides && typeof data.overrides === "object" && !Array.isArray(data.overrides)
        ? data.overrides
        : {};
    return Object.prototype.hasOwnProperty.call(overrides, key)
      ? overrides[key]
      : null;
  }

  async function applyOwnedState(memberships) {
    await ensureFirebase().catch(() => null);
    if (!state.user) return memberships;

    for (const membership of memberships) {
      const meta = registry.COLLECTIONS?.[membership.collectionId];
      if (!meta?.documentId) continue;

      if (membership.collectionId === "national") {
        const data = await readDocument(meta.documentId).catch(() => ({}));
        const value = data?.overrides?.[membership.key];
        membership.owned = Object.prototype.hasOwnProperty.call(data?.overrides || {}, membership.key)
          ? overrideOwned(value)
          : data?.baseMode === "legacy" && Boolean(membership.baselineOwned);
        continue;
      }

      const value = await existingOverride(meta.documentId, membership.key).catch(() => null);
      if (value !== null) {
        membership.owned = overrideOwned(value);
        continue;
      }
      const root = await readDocument(meta.documentId).catch(() => ({}));
      membership.owned = root?.baseMode === "legacy" && Boolean(membership.baselineOwned);
    }
    return memberships;
  }

  async function selectCard(card) {
    state.selected = card;
    els.preview.hidden = false;
    els.previewImage.src = card.image || card.originalImage || state.previewUrl || "";
    els.previewTitle.textContent = card.name || card.pokemonName || card.rawCode;
    els.previewMeta.textContent = [
      card.setTitle,
      card.setCode,
      card.cardNumber || card.rawCode,
      card.rarity,
    ].filter(Boolean).join(" · ");

    setStatus("이 카드가 들어가는 도감을 확인하고 있습니다.", "loading");
    setBusy(true);
    try {
      const memberships = await exactMemberships(card);
      await applyOwnedState(memberships);
      state.memberships = memberships;
      renderMemberships();
      setStatus(
        memberships.length
          ? "등록할 도감을 선택해 주세요."
          : "현재 도감 목록에서 같은 카드를 찾지 못했습니다.",
        memberships.length ? "success" : "error",
      );
    } catch (error) {
      console.error(error);
      setStatus("도감 목록을 확인하지 못했습니다.", "error");
    } finally {
      setBusy(false);
    }
  }

  function renderMemberships() {
    els.memberships.replaceChildren();
    els.membershipSection.hidden = false;

    for (const membership of state.memberships) {
      const label = document.createElement("label");
      label.className = "card-scan-membership";
      label.classList.toggle("is-owned", membership.owned);
      label.classList.toggle("is-representative", membership.mode === "representative");

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.membershipId = membership.id;
      checkbox.checked = membership.owned || (!membership.owned && membership.defaultSelected);
      checkbox.disabled = membership.owned;

      const copy = document.createElement("span");
      copy.className = "card-scan-membership-copy";
      const title = document.createElement("strong");
      title.textContent = membership.title;
      const detail = document.createElement("small");
      detail.textContent = membership.groupName || "동일 카드";
      copy.append(title, detail);

      const status = document.createElement("span");
      status.className = "card-scan-membership-state";
      status.textContent = membership.owned
        ? "이미 보유"
        : membership.mode === "representative"
          ? "대표카드"
          : "미보유";

      label.append(checkbox, copy, status);
      els.memberships.append(label);
    }

    els.save.disabled = !state.memberships.some((item) => !item.owned);
  }

  function selectAllMissing() {
    els.memberships.querySelectorAll('input[type="checkbox"]:not(:disabled)').forEach((input) => {
      input.checked = true;
    });
  }

  async function ensureRootDocument(documentId) {
    const firebase = await ensureFirebase();
    const user = await ensureSignedIn();
    const ref = accountCore.documentRef(
      firebase.firestoreModule,
      firebase.db,
      user,
      CONFIG,
      documentId,
    );
    const snapshot = await firebase.firestoreModule.getDoc(ref);
    if (!snapshot.exists()) {
      await firebase.firestoreModule.setDoc(
        ref,
        {
          baseMode: accountCore.baseMode(CONFIG, user),
          email: user.email || "",
          displayName: user.displayName || "",
          overrides: {},
          createdAt: firebase.firestoreModule.serverTimestamp(),
          updatedAt: firebase.firestoreModule.serverTimestamp(),
        },
        { merge: true },
      );
    }
    return ref;
  }

  async function writeFixedMembership(membership) {
    const firebase = await ensureFirebase();
    const user = await ensureSignedIn();
    const meta = registry.COLLECTIONS?.[membership.collectionId];
    if (!meta?.documentId) throw new Error("저장 위치를 확인할 수 없습니다.");
    const ref = await ensureRootDocument(meta.documentId);
    const previous = await existingOverride(meta.documentId, membership.key).catch(() => null);

    const value = {
      ...(previous && typeof previous === "object" && !Array.isArray(previous) ? previous : {}),
      owned: true,
      updatedAt: new Date().toISOString(),
      updatedBy: user.email || user.uid,
    };

    if (membership.collectionId === "series") {
      const variants = Array.isArray(value.printVariants)
        ? value.printVariants.filter(Boolean)
        : [];
      value.printVariants = variants.length ? variants : ["normal"];
    }

    if (accountCore.usesOverrideShards(meta.documentId)) {
      await accountCore.writeOverrideEntry(
        firebase.firestoreModule,
        ref,
        membership.key,
        value,
      );
    } else {
      await firebase.firestoreModule.setDoc(
        ref,
        {
          overrides: { [membership.key]: value },
          updatedAt: firebase.firestoreModule.serverTimestamp(),
        },
        {
          mergeFields: [
            new firebase.firestoreModule.FieldPath("overrides", membership.key),
            "updatedAt",
          ],
        },
      );
    }

    membership.owned = true;
    state.documentCache.delete(meta.documentId);
  }

  async function writeCustomMembership(membership) {
    const firebase = await ensureFirebase();
    const user = await ensureSignedIn();
    const documentId = "pokemonCollectionsDex";
    const ref = await ensureRootDocument(documentId);
    const source = await readDocument(documentId).catch(() => ({}));
    const customDexes =
      source?.customDexes &&
      typeof source.customDexes === "object" &&
      !Array.isArray(source.customDexes)
        ? source.customDexes
        : {};
    const dex = customDexes[membership.customDexId];
    if (!dex || !Array.isArray(dex.cards)) {
      throw new Error("나만의 도감에서 해당 카드를 찾지 못했습니다.");
    }

    let found = false;
    const cards = dex.cards.map((entry) => {
      if (clean(entry?.key) !== membership.key) return entry;
      found = true;
      return { ...entry, owned: true };
    });
    if (!found) throw new Error("나만의 도감에서 해당 카드를 찾지 못했습니다.");

    const nextDex = {
      ...dex,
      cards,
      updatedAt: new Date().toISOString(),
    };

    await firebase.firestoreModule.setDoc(
      ref,
      {
        customDexes: { [membership.customDexId]: nextDex },
        updatedAt: firebase.firestoreModule.serverTimestamp(),
      },
      {
        mergeFields: [
          new firebase.firestoreModule.FieldPath("customDexes", membership.customDexId),
          "updatedAt",
        ],
      },
    );

    membership.owned = true;
    state.documentCache.delete(documentId);
    window.dispatchEvent(
      new CustomEvent("pokemon-dex:custom-changed", {
        detail: {
          dexId: membership.customDexId,
          key: membership.key,
          source: "card-scanner",
        },
      }),
    );
  }

  async function writeNationalRepresentative(membership) {
    const firebase = await ensureFirebase();
    const user = await ensureSignedIn();
    const meta = registry.COLLECTIONS?.national;
    const ref = await ensureRootDocument(meta.documentId);
    const source = await readDocument(meta.documentId).catch(() => ({}));
    const previous =
      source?.overrides &&
      typeof source.overrides === "object" &&
      !Array.isArray(source.overrides)
        ? source.overrides[membership.key]
        : null;
    const previousObject =
      previous && typeof previous === "object" && !Array.isArray(previous)
        ? previous
        : {};

    const value = {
      ...previousObject,
      owned: true,
      setCode: state.selected.setCode,
      cardNumber: state.selected.cardNumber || state.selected.rawCode,
      cardName: state.selected.name || state.selected.pokemonName || state.selected.rawCode,
      rarity: state.selected.rarity || "",
      quantity: Math.max(1, Number(previousObject.quantity) || 1),
      tradeStatus: clean(previousObject.tradeStatus) || "none",
      imageUrl: state.selected.image || state.selected.originalImage || "",
      imageSource: "auto",
      note: clean(previousObject.note),
      updatedAt: new Date().toISOString(),
      updatedBy: user.email || user.uid,
    };

    await firebase.firestoreModule.setDoc(
      ref,
      {
        overrides: { [membership.key]: value },
        updatedAt: firebase.firestoreModule.serverTimestamp(),
      },
      {
        mergeFields: [
          new firebase.firestoreModule.FieldPath("overrides", membership.key),
          "updatedAt",
        ],
      },
    );

    membership.owned = true;
    state.documentCache.delete(meta.documentId);
  }

  async function syncPublicCollections(collectionIds) {
    const sync = window.CollectorPublicSync?.syncCollectionWithRetry;
    if (typeof sync !== "function" || !state.firebase || !state.user) return;
    for (const collectionId of [...new Set(collectionIds)]) {
      try {
        await sync({
          db: state.firebase.db,
          firestoreModule: state.firebase.firestoreModule,
          user: state.user,
          collectionId,
        });
      } catch (error) {
        console.warn(collectionId + " 공개 projection 갱신 실패", error);
      }
    }
  }

  async function saveSelectedMemberships() {
    if (!state.selected || state.busy) return;
    const selectedIds = new Set(
      [...els.memberships.querySelectorAll('input[type="checkbox"]:checked:not(:disabled)')]
        .map((input) => input.dataset.membershipId),
    );
    const targets = state.memberships.filter(
      (membership) => selectedIds.has(membership.id) && !membership.owned,
    );
    if (!targets.length) {
      setStatus("새로 등록할 도감을 선택해 주세요.", "error");
      return;
    }

    if (
      window.CollectorPublicView?.requested ||
      window.PokemonDexSharedReadonly?.isActive?.(state.user)
    ) {
      setStatus("읽기 전용 화면에서는 보유 상태를 수정할 수 없습니다.", "error");
      return;
    }

    setBusy(true);
    setProgress(12);
    setStatus("선택한 도감에 저장하고 있습니다.", "loading");

    try {
      await ensureSignedIn();
      const changed = [];
      let completed = 0;

      for (const membership of targets) {
        if (membership.mode === "representative") {
          await writeNationalRepresentative(membership);
        } else if (membership.mode === "custom") {
          await writeCustomMembership(membership);
        } else {
          await writeFixedMembership(membership);
        }
        completed += 1;
        if (membership.collectionId !== "custom") {
          changed.push(membership.collectionId);
        }
        setProgress(12 + Math.round((completed / targets.length) * 72));
        window.dispatchEvent(
          new CustomEvent("pokemon-dex:collection-changed", {
            detail: {
              category: membership.collectionId,
              key: membership.key,
              source: "card-scanner",
            },
          }),
        );
      }

      await syncPublicCollections(changed);
      setProgress(100);
      renderMemberships();
      setStatus(targets.length + "개 도감에 등록했습니다. 다음 카드를 계속 스캔할 수 있습니다.", "success");
    } catch (error) {
      console.error(error);
      setStatus(error?.message || "도감에 저장하지 못했습니다.", "error");
      setProgress(0);
    } finally {
      setBusy(false);
    }
  }

  buildUi();

  window.addEventListener("beforeunload", () => {
    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
    if (state.ocrWorker?.terminate) {
      try {
        void state.ocrWorker.terminate();
      } catch {
        // 페이지 종료 중 정리 실패는 무시합니다.
      }
    }
  });
})();
