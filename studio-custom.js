"use strict";

(function () {
  const panel = document.querySelector("#studio-custom");
  if (!panel) return;

  const tabs = [...document.querySelectorAll("[data-studio-tab]")];
  const panels = {
    print: document.querySelector("#studio-print"),
    custom: panel,
  };

  const fileInput = panel.querySelector("#studio-custom-file");
  const dropzone = panel.querySelector("#studio-custom-dropzone");
  const resetButton = panel.querySelector("#studio-custom-reset");
  const gridInputs = [...panel.querySelectorAll('input[name="studio-custom-grid"]')];
  const previewEmpty = panel.querySelector("#studio-custom-preview-empty");
  const previewWrap = panel.querySelector("#studio-custom-preview-wrap");
  const previewImage = panel.querySelector("#studio-custom-preview-image");
  const overlay = panel.querySelector("#studio-custom-grid-overlay");
  const gridLabel = panel.querySelector("#studio-custom-grid-label");
  const slotLabel = panel.querySelector("#studio-custom-slot-label");
  const fileLabel = panel.querySelector("#studio-custom-file-label");
  const imageMeta = panel.querySelector("#studio-custom-image-meta");
  const ratioNote = panel.querySelector("#studio-custom-ratio-note");

  let objectUrl = "";

  function activateTab(name, updateHash = true) {
    const selected = name === "custom" ? "custom" : "print";
    Object.entries(panels).forEach(([key, section]) => {
      if (!section) return;
      section.hidden = key !== selected;
    });
    tabs.forEach((tab) => {
      const active = tab.dataset.studioTab === selected;
      tab.classList.toggle("is-active", active);
      if (active) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    });
    if (updateHash) {
      history.replaceState(null, "", selected === "custom" ? "#studio-custom" : "#studio-print");
    }
  }

  function selectedGrid() {
    const value = gridInputs.find((input) => input.checked)?.value || "3x4";
    const [cols, rows] = value.split("x").map(Number);
    return { cols, rows, value };
  }

  function renderGrid() {
    const { cols, rows } = selectedGrid();
    overlay.replaceChildren();
    overlay.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    overlay.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

    for (let index = 0; index < cols * rows; index += 1) {
      const cell = document.createElement("span");
      cell.setAttribute("aria-hidden", "true");
      overlay.append(cell);
    }

    gridLabel.textContent = `${cols} × ${rows}`;
    slotLabel.textContent = `${cols * rows}칸`;

    if (previewImage.naturalWidth && previewImage.naturalHeight) {
      updateRatioNote(previewImage.naturalWidth, previewImage.naturalHeight);
    }
  }

  function updateRatioNote(width, height) {
    const { cols, rows } = selectedGrid();
    const expected = (cols * 63) / (rows * 88);
    const actual = width / height;
    const gap = Math.abs(actual - expected) / expected;

    if (gap <= 0.04) {
      ratioNote.textContent = "선택한 그리드 비율과 잘 맞습니다.";
      ratioNote.className = "studio-custom-ratio-note is-good";
    } else {
      ratioNote.textContent = "이미지 비율과 선택한 그리드 비율이 다릅니다. 칸 위치를 확인해 주세요.";
      ratioNote.className = "studio-custom-ratio-note is-warning";
    }
  }

  function clearImage() {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = "";
    fileInput.value = "";
    previewImage.removeAttribute("src");
    previewImage.removeAttribute("alt");
    previewWrap.hidden = true;
    previewEmpty.hidden = false;
    fileLabel.textContent = "이미지를 선택하거나 여기에 놓으세요";
    imageMeta.textContent = "PNG · JPG · WEBP · 최대 10MB";
    ratioNote.textContent = "이미지를 올리면 선택한 그리드와 비율을 확인합니다.";
    ratioNote.className = "studio-custom-ratio-note";
  }

  function loadFile(file) {
    if (!file) return;

    const allowed = new Set(["image/png", "image/jpeg", "image/webp"]);
    if (!allowed.has(file.type)) {
      window.alert("PNG, JPG, WEBP 이미지만 사용할 수 있습니다.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      window.alert("이미지는 최대 10MB까지 사용할 수 있습니다.");
      return;
    }

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    previewImage.src = objectUrl;
    previewImage.alt = file.name;
    fileLabel.textContent = file.name;
    imageMeta.textContent = `${(file.size / 1024 / 1024).toFixed(2)}MB · 기기 안에서만 미리보기`;

    previewImage.onload = () => {
      previewEmpty.hidden = true;
      previewWrap.hidden = false;
      imageMeta.textContent =
        `${previewImage.naturalWidth.toLocaleString("ko-KR")} × ${previewImage.naturalHeight.toLocaleString("ko-KR")}px · ${(file.size / 1024 / 1024).toFixed(2)}MB`;
      updateRatioNote(previewImage.naturalWidth, previewImage.naturalHeight);
    };
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", (event) => {
      event.preventDefault();
      activateTab(tab.dataset.studioTab);
    });
  });

  gridInputs.forEach((input) => input.addEventListener("change", renderGrid));

  fileInput.addEventListener("change", () => loadFile(fileInput.files?.[0]));

  ["dragenter", "dragover"].forEach((type) => {
    dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      dropzone.classList.add("is-dragging");
    });
  });
  ["dragleave", "drop"].forEach((type) => {
    dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      dropzone.classList.remove("is-dragging");
    });
  });
  dropzone.addEventListener("drop", (event) => {
    loadFile(event.dataTransfer?.files?.[0]);
  });

  resetButton.addEventListener("click", () => {
    const defaultGrid = gridInputs.find((input) => input.value === "3x4");
    if (defaultGrid) defaultGrid.checked = true;
    renderGrid();
    clearImage();
  });

  window.addEventListener("beforeunload", () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  });

  renderGrid();
  clearImage();
  activateTab(window.location.hash === "#studio-custom" ? "custom" : "print", false);
})();
