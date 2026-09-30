"use strict";

(function () {
  const PRINT_MARGIN_MM = 7;
  const A4 = {
    portrait: { width: 210, height: 297, label: "A4 세로" },
    landscape: { width: 297, height: 210, label: "A4 가로" },
  };
  const SIZE_MODES = {
    card: { cellWidth: 63, cellHeight: 88, label: "실제 카드 63 × 88 mm" },
    sleeve: { cellWidth: 65, cellHeight: 90, label: "슬리브 65 × 90 mm" },
  };

  const elements = {
    file: document.querySelector("#studio-file"),
    fileLabel: document.querySelector("#studio-file-label"),
    dropzone: document.querySelector("#studio-dropzone"),
    cols: document.querySelector("#studio-cols"),
    rows: document.querySelector("#studio-rows"),
    presets: [...document.querySelectorAll("[data-grid-preset]")],
    sizeInputs: [...document.querySelectorAll('input[name="studio-size"]')],
    reset: document.querySelector("#studio-reset"),
    print: document.querySelector("#studio-print-button"),
    pageCount: document.querySelector("#studio-page-count"),
    pageNote: document.querySelector("#studio-page-note"),
    orientation: document.querySelector("#studio-orientation-badge"),
    empty: document.querySelector("#studio-empty-preview"),
    preview: document.querySelector("#studio-page-preview"),
    printRoot: document.querySelector("#studio-print-root"),
  };

  if (!elements.file || !elements.preview || !elements.printRoot) return;

  const state = {
    objectUrl: "",
    fileName: "",
    image: null,
    cols: 3,
    rows: 4,
    mode: "card",
    plan: null,
  };

  function selectedMode() {
    return elements.sizeInputs.find((input) => input.checked)?.value || "card";
  }

  function printableArea(orientation) {
    const page = A4[orientation];
    return {
      width: page.width - PRINT_MARGIN_MM * 2,
      height: page.height - PRINT_MARGIN_MM * 2,
    };
  }

  function exactPlanForOrientation(orientation, cols, rows, mode) {
    const page = A4[orientation];
    const area = printableArea(orientation);
    const size = SIZE_MODES[mode];
    const perPageCols = Math.max(1, Math.floor((area.width + 0.001) / size.cellWidth));
    const perPageRows = Math.max(1, Math.floor((area.height + 0.001) / size.cellHeight));
    const horizontalPages = Math.ceil(cols / perPageCols);
    const verticalPages = Math.ceil(rows / perPageRows);

    return {
      orientation,
      page,
      area,
      mode,
      perPageCols,
      perPageRows,
      pageCount: horizontalPages * verticalPages,
      horizontalPages,
      verticalPages,
      cellWidth: size.cellWidth,
      cellHeight: size.cellHeight,
    };
  }

  function chooseExactPlan(cols, rows, mode) {
    const portrait = exactPlanForOrientation("portrait", cols, rows, mode);
    const landscape = exactPlanForOrientation("landscape", cols, rows, mode);
    const candidates = [portrait, landscape].sort((a, b) => {
      if (a.pageCount !== b.pageCount) return a.pageCount - b.pageCount;
      const aCapacity = a.perPageCols * a.perPageRows;
      const bCapacity = b.perPageCols * b.perPageRows;
      if (aCapacity !== bCapacity) return bCapacity - aCapacity;
      return a.orientation === "portrait" ? -1 : 1;
    });
    return candidates[0];
  }

  function chooseFitPlan(image) {
    const candidates = ["portrait", "landscape"].map((orientation) => {
      const page = A4[orientation];
      const area = printableArea(orientation);
      const scale = Math.min(area.width / image.naturalWidth, area.height / image.naturalHeight);
      return { orientation, page, area, pageCount: 1, scale, mode: "fit" };
    });
    return candidates.sort((a, b) => b.scale - a.scale)[0];
  }

  function buildSlices(plan, cols, rows) {
    if (plan.mode === "fit") {
      return [{
        colStart: 0,
        rowStart: 0,
        colCount: cols,
        rowCount: rows,
        physicalWidth: null,
        physicalHeight: null,
      }];
    }

    const slices = [];
    for (let rowStart = 0; rowStart < rows; rowStart += plan.perPageRows) {
      const rowCount = Math.min(plan.perPageRows, rows - rowStart);
      for (let colStart = 0; colStart < cols; colStart += plan.perPageCols) {
        const colCount = Math.min(plan.perPageCols, cols - colStart);
        slices.push({
          colStart,
          rowStart,
          colCount,
          rowCount,
          physicalWidth: colCount * plan.cellWidth,
          physicalHeight: rowCount * plan.cellHeight,
        });
      }
    }
    return slices;
  }

  function computePlan() {
    if (!state.image) return null;
    const cols = Number(elements.cols.value) || 3;
    const rows = Number(elements.rows.value) || 4;
    const mode = selectedMode();
    const base = mode === "fit"
      ? chooseFitPlan(state.image)
      : chooseExactPlan(cols, rows, mode);

    return {
      ...base,
      cols,
      rows,
      slices: buildSlices(base, cols, rows),
    };
  }

  function expectedAspect(plan) {
    if (!plan || plan.mode === "fit") return null;
    return (plan.cols * plan.cellWidth) / (plan.rows * plan.cellHeight);
  }

  function sourceAspect() {
    if (!state.image) return null;
    return state.image.naturalWidth / state.image.naturalHeight;
  }

  function aspectMismatch(plan) {
    const expected = expectedAspect(plan);
    const source = sourceAspect();
    if (!expected || !source) return 0;
    return Math.abs(source - expected) / expected;
  }

  function sourceCrop(slice, plan) {
    const image = state.image;
    const cellWidthPx = image.naturalWidth / plan.cols;
    const cellHeightPx = image.naturalHeight / plan.rows;
    return {
      sx: slice.colStart * cellWidthPx,
      sy: slice.rowStart * cellHeightPx,
      sw: slice.colCount * cellWidthPx,
      sh: slice.rowCount * cellHeightPx,
    };
  }

  function createPreviewCanvas(slice, plan) {
    const portrait = plan.orientation === "portrait";
    const width = portrait ? 340 : 480;
    const height = Math.round(width * plan.page.height / plan.page.width);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    const mmToPx = width / plan.page.width;
    const areaX = PRINT_MARGIN_MM * mmToPx;
    const areaY = PRINT_MARGIN_MM * mmToPx;
    const areaWidth = plan.area.width * mmToPx;
    const areaHeight = plan.area.height * mmToPx;

    const crop = sourceCrop(slice, plan);

    if (plan.mode === "fit") {
      const imageAspect = state.image.naturalWidth / state.image.naturalHeight;
      const areaAspect = areaWidth / areaHeight;
      let drawWidth = areaWidth;
      let drawHeight = areaHeight;
      if (imageAspect > areaAspect) {
        drawHeight = drawWidth / imageAspect;
      } else {
        drawWidth = drawHeight * imageAspect;
      }
      const dx = areaX + (areaWidth - drawWidth) / 2;
      const dy = areaY + (areaHeight - drawHeight) / 2;
      ctx.drawImage(state.image, 0, 0, state.image.naturalWidth, state.image.naturalHeight, dx, dy, drawWidth, drawHeight);
    } else {
      const drawWidth = slice.physicalWidth * mmToPx;
      const drawHeight = slice.physicalHeight * mmToPx;
      const dx = areaX + (areaWidth - drawWidth) / 2;
      const dy = areaY + (areaHeight - drawHeight) / 2;
      ctx.drawImage(state.image, crop.sx, crop.sy, crop.sw, crop.sh, dx, dy, drawWidth, drawHeight);

      ctx.save();
      ctx.strokeStyle = "rgba(42, 64, 84, 0.26)";
      ctx.lineWidth = 1;
      for (let c = 1; c < slice.colCount; c += 1) {
        const x = dx + c * plan.cellWidth * mmToPx;
        ctx.beginPath();
        ctx.moveTo(x, dy);
        ctx.lineTo(x, dy + drawHeight);
        ctx.stroke();
      }
      for (let r = 1; r < slice.rowCount; r += 1) {
        const y = dy + r * plan.cellHeight * mmToPx;
        ctx.beginPath();
        ctx.moveTo(dx, y);
        ctx.lineTo(dx + drawWidth, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    return canvas;
  }

  function renderPreview() {
    state.cols = Number(elements.cols.value) || 3;
    state.rows = Number(elements.rows.value) || 4;
    state.mode = selectedMode();
    state.plan = computePlan();

    syncPresetButtons();

    if (!state.plan) {
      elements.empty.hidden = false;
      elements.preview.hidden = true;
      elements.preview.replaceChildren();
      elements.pageCount.textContent = "이미지를 선택하세요";
      elements.pageNote.textContent = "실제 크기 인쇄 시 A4 방향도 자동으로 최적화합니다.";
      elements.orientation.textContent = "A4 자동";
      elements.print.disabled = true;
      return;
    }

    elements.empty.hidden = true;
    elements.preview.hidden = false;
    elements.preview.replaceChildren();

    state.plan.slices.forEach((slice, index) => {
      const item = document.createElement("div");
      item.className = "studio-preview-page";
      const canvas = createPreviewCanvas(slice, state.plan);
      const label = document.createElement("span");
      label.textContent = state.plan.slices.length === 1
        ? "1페이지"
        : `${index + 1} / ${state.plan.slices.length}페이지`;
      item.append(canvas, label);
      elements.preview.append(item);
    });

    const count = state.plan.slices.length;
    const orientationLabel = A4[state.plan.orientation].label;
    elements.orientation.textContent = orientationLabel;
    elements.pageCount.textContent = count === 1
      ? `A4 1장 · ${orientationLabel}`
      : `A4 ${count}장 · ${orientationLabel}`;

    const mismatch = aspectMismatch(state.plan);
    if (state.plan.mode === "fit") {
      elements.pageNote.textContent = "원본 비율을 유지해 한 장에 맞춥니다.";
    } else if (mismatch > 0.035) {
      elements.pageNote.textContent = "원본 비율이 선택한 그리드와 조금 다릅니다. 실제 크기에 맞추며 약간의 비율 보정이 생길 수 있습니다.";
    } else {
      const size = SIZE_MODES[state.plan.mode];
      elements.pageNote.textContent =
        `한 칸 ${size.cellWidth} × ${size.cellHeight} mm · 칸 경계에서만 페이지를 나눕니다.`;
    }
    elements.print.disabled = false;
  }

  function syncPresetButtons() {
    const key = `${elements.cols.value}x${elements.rows.value}`;
    elements.presets.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.gridPreset === key);
    });
  }

  function resetFile() {
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = "";
    state.fileName = "";
    state.image = null;
    elements.file.value = "";
    elements.fileLabel.textContent = "이미지 불러오기";
    elements.dropzone.classList.remove("has-file");
  }

  function resetAll() {
    resetFile();
    elements.cols.value = "3";
    elements.rows.value = "4";
    elements.sizeInputs.forEach((input) => {
      input.checked = input.value === "card";
    });
    renderPreview();
  }

  function loadFile(file) {
    if (!file || !file.type.startsWith("image/")) {
      window.alert("PNG, JPG 또는 WEBP 이미지 파일을 선택해 주세요.");
      return;
    }

    resetFile();
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      state.objectUrl = url;
      state.fileName = file.name;
      state.image = image;
      elements.fileLabel.textContent = file.name;
      elements.dropzone.classList.add("has-file");
      renderPreview();
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      window.alert("이미지를 불러오지 못했습니다. 다른 파일로 다시 시도해 주세요.");
    };
    image.src = url;
  }

  function cloneSliceCanvas(slice, plan) {
    const crop = sourceCrop(slice, plan);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(crop.sw));
    canvas.height = Math.max(1, Math.round(crop.sh));
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(
        state.image,
        crop.sx,
        crop.sy,
        crop.sw,
        crop.sh,
        0,
        0,
        canvas.width,
        canvas.height,
      );
    }
    return canvas;
  }

  function installDynamicPageStyle(plan) {
    document.querySelector("#studio-dynamic-page-style")?.remove();
    const style = document.createElement("style");
    style.id = "studio-dynamic-page-style";
    style.textContent = `@media print { @page { size: A4 ${plan.orientation}; margin: 0; } }`;
    document.head.append(style);
  }

  function buildPrintSheets() {
    const plan = state.plan || computePlan();
    if (!plan || !state.image) return false;

    installDynamicPageStyle(plan);
    elements.printRoot.replaceChildren();

    plan.slices.forEach((slice) => {
      const sheet = document.createElement("section");
      sheet.className = "studio-print-sheet";
      sheet.style.width = `${plan.page.width}mm`;
      sheet.style.height = `${plan.page.height}mm`;
      sheet.style.padding = `${PRINT_MARGIN_MM}mm`;

      if (plan.mode === "fit") {
        const image = document.createElement("img");
        image.src = state.objectUrl;
        image.alt = "";
        image.style.maxWidth = `${plan.area.width}mm`;
        image.style.maxHeight = `${plan.area.height}mm`;
        image.style.width = "auto";
        image.style.height = "auto";
        image.style.objectFit = "contain";
        sheet.append(image);
      } else {
        const canvas = cloneSliceCanvas(slice, plan);
        canvas.style.width = `${slice.physicalWidth}mm`;
        canvas.style.height = `${slice.physicalHeight}mm`;
        sheet.append(canvas);

        const calibration = document.createElement("div");
        calibration.className = "studio-calibration";
        calibration.textContent = "10 mm";
        sheet.append(calibration);
      }

      elements.printRoot.append(sheet);
    });

    return true;
  }

  function startPrint() {
    if (!buildPrintSheets()) return;
    elements.print.disabled = true;
    const previous = elements.print.textContent;
    elements.print.textContent = "인쇄 준비 중…";

    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        elements.print.disabled = false;
        elements.print.textContent = previous;
        window.print();
      }, 80);
    });
  }

  elements.file.addEventListener("change", () => {
    loadFile(elements.file.files?.[0]);
  });

  elements.dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    elements.dropzone.classList.add("is-dragging");
  });

  elements.dropzone.addEventListener("dragleave", () => {
    elements.dropzone.classList.remove("is-dragging");
  });

  elements.dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    elements.dropzone.classList.remove("is-dragging");
    loadFile(event.dataTransfer?.files?.[0]);
  });

  elements.presets.forEach((button) => {
    button.addEventListener("click", () => {
      const [cols, rows] = String(button.dataset.gridPreset || "3x4").split("x");
      elements.cols.value = cols;
      elements.rows.value = rows;
      renderPreview();
    });
  });

  elements.cols.addEventListener("change", renderPreview);
  elements.rows.addEventListener("change", renderPreview);
  elements.sizeInputs.forEach((input) => input.addEventListener("change", renderPreview));
  elements.reset.addEventListener("click", resetAll);
  elements.print.addEventListener("click", startPrint);

  window.addEventListener("beforeunload", () => {
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  });

  renderPreview();
})();
