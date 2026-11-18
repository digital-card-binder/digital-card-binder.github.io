"use strict";

// 바인더 스튜디오 시작 화면(사진으로 시작 / 빈 바인더로 시작)과 저장한 바인더 개수 표시.
// 기존 편집 로직(studio-custom.js)은 건드리지 않고 화면 표시만 담당한다.
(function () {
  const start = document.querySelector("#studio-start-choice");
  if (!start) return;
  const blank = document.querySelector("#studio-start-blank");
  const scanInput = document.querySelector("#studio-quick-page-scan");
  const placed = document.querySelector("#studio-custom-placed-count");
  const library = document.querySelector("#studio-custom-library");
  const libraryCount = document.querySelector("#studio-library-count");
  const libraryEmpty = document.querySelector("#studio-custom-library-empty");
  const preview = document.querySelector(".studio-custom-preview-panel");

  const hideStart = () => {
    start.hidden = true;
  };

  blank?.addEventListener("click", () => {
    hideStart();
    preview?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  scanInput?.addEventListener("change", () => {
    if (scanInput.files?.length) hideStart();
  });

  // 저장된 작업을 불러오거나 카드를 이미 배치했다면 시작 안내는 필요 없다.
  function syncStart() {
    const count = Number.parseInt(String(placed?.textContent || "0").replace(/[^0-9]/g, ""), 10) || 0;
    if (count > 0) hideStart();
  }
  if (placed) new MutationObserver(syncStart).observe(placed, { childList: true, characterData: true, subtree: true });
  syncStart();

  function syncLibrary() {
    if (!libraryCount) return;
    const count = library?.children.length || 0;
    if (count) libraryCount.textContent = `${count}개`;
    else libraryCount.textContent = libraryEmpty?.textContent?.includes("로그인") ? "로그인 후 표시" : "아직 없음";
  }
  if (library) new MutationObserver(syncLibrary).observe(library, { childList: true });
  if (libraryEmpty) new MutationObserver(syncLibrary).observe(libraryEmpty, { childList: true, characterData: true, subtree: true, attributes: true });
  syncLibrary();
})();
