"use strict";

(function () {
  const dialog = document.querySelector("#studio-help-dialog");
  const title = document.querySelector("#studio-help-title");
  const description = document.querySelector("#studio-help-description");
  const steps = document.querySelector("#studio-help-steps");
  const buttons = [...document.querySelectorAll("[data-studio-help]")];
  const closeButtons = [...document.querySelectorAll("[data-studio-help-close]")];

  if (!dialog || !title || !description || !steps || !buttons.length) return;

  const HELP = {
    "1": {
      title: "1. 바인더 페이지 · 필수",
      description: "실제 바인더처럼 페이지를 여러 장 만들고, 페이지별 구성을 따로 관리하는 기능입니다.",
      steps: [
        "＋ 페이지를 눌러 새 페이지를 추가합니다.",
        "복제로 현재 페이지 구성을 그대로 복사할 수 있습니다.",
        "앞으로·뒤로 버튼으로 페이지 순서를 바꾸고, ‹ › 또는 번호를 눌러 페이지를 이동합니다.",
      ],
    },
    "2": {
      title: "2. 바인더 그리드 · 필수",
      description: "현재 페이지에 몇 개의 카드 포켓을 둘지 정합니다. 페이지마다 서로 다른 배열을 사용할 수 있습니다.",
      steps: [
        "2×2부터 5×4까지 원하는 그리드를 선택합니다.",
        "선택한 배열에 맞춰 슬롯 수와 작업 영역이 자동으로 바뀝니다.",
        "다른 페이지로 이동해 그 페이지에만 다른 그리드를 선택할 수도 있습니다.",
      ],
    },
    "3": {
      title: "3. 배경 일러스트 · 선택",
      description: "페이지 전체 뒤에 깔리는 한 장의 배경 이미지입니다. 사용하지 않아도 카드만으로 바인더를 만들 수 있습니다.",
      steps: [
        "이미지 영역을 눌러 PNG·JPG·WEBP 파일을 선택합니다.",
        "업로드한 이미지는 현재 페이지의 전체 배경으로 표시됩니다.",
        "배경 없이 사용하려면 이 단계는 건너뛰면 됩니다.",
      ],
    },
    "4": {
      title: "4. 확장 이미지 배치 · 선택",
      description: "확장아트 한 장을 여러 카드 슬롯에 이어지도록 자동으로 나눠 넣는 기능입니다.",
      steps: [
        "확장 이미지를 선택합니다.",
        "슬롯 선택 시작을 누르고 미리보기에서 이미지를 넣을 칸들을 선택합니다.",
        "선택 슬롯에 이미지 채우기를 누르면 선택 영역에 맞춰 이미지가 자동 분할됩니다.",
        "이미지 슬롯 하나를 선택한 뒤 실제 카드를 추가하면 그 칸만 카드로 교체할 수 있습니다.",
      ],
    },
    "5": {
      title: "5. 카드 추가 · 선택",
      description: "우리 도감 데이터에서 실제 카드를 검색해 원하는 슬롯을 카드 데이터로 교체하는 선택 기능입니다. 사진만 그대로 보관할 때는 건너뛰어도 됩니다.",
      steps: [
        "포켓몬명·카드명·시리즈 코드·카드번호로 검색합니다.",
        "원하는 카드의 추가 버튼을 누르면 첫 번째 빈 슬롯에 들어갑니다.",
        "슬롯 하나를 먼저 선택하면 그 슬롯의 이미지나 기존 내용을 해당 카드로 교체할 수 있습니다.",
      ],
    },
    "6": {
      title: "6. 선택 카드 편집 · 선택",
      description: "페이지에 넣은 카드의 위치와 방향을 직접 조정합니다.",
      steps: [
        "미리보기에서 카드를 눌러 선택합니다.",
        "회전·칸에 맞춤·맨 앞으로·삭제 기능을 사용할 수 있습니다.",
        "카드를 다른 슬롯으로 드래그하면 이동하며, 카드가 있는 슬롯으로 옮기면 서로 위치가 바뀝니다.",
      ],
    },
    "7": {
      title: "7. 나만의도감에 저장 · 필수",
      description: "현재 바인더의 모든 페이지, 카드, 이미지 배치를 내 계정에 저장합니다.",
      steps: [
        "작업 이름을 입력합니다.",
        "원하면 나만의 도감을 연결해 카드의 보유·미보유 상태를 함께 확인할 수 있습니다.",
        "저장 버튼을 누르면 이후 나의 수집에서 다시 불러와 계속 편집할 수 있습니다.",
      ],
    },
    "8": {
      title: "8. 공개 · 공유 · 선택",
      description: "완성한 바인더를 편집할 수 없는 읽기 전용 공개본으로 만들어 다른 사람과 공유합니다.",
      steps: [
        "먼저 바인더를 저장하고 컬렉터 프로필을 완성합니다.",
        "공개하기를 누르면 공개 링크와 컬렉터 프로필에 바인더가 표시됩니다.",
        "수정 후 다시 저장하면 공개본도 최신 상태로 갱신됩니다.",
        "공개 중단을 누르면 기존 공유 링크에서도 더 이상 볼 수 없습니다.",
      ],
    },
    "9": {
      title: "9. 전체 바인더 출력 · 선택",
      description: "현재 바인더의 모든 페이지를 순서대로 PDF 또는 인쇄용으로 출력합니다.",
      steps: [
        "A4 맞춤, 실제 카드 63×88mm, 실제 슬리브 65×90mm 중 하나를 선택합니다.",
        "연결 도감의 미보유 카드는 컬러·흑백·빈칸 중 원하는 방식으로 출력할 수 있습니다.",
        "실제 카드·슬리브 크기는 A4에 다 들어가지 않으면 슬롯이 잘리지 않게 다음 장으로 자동 분할됩니다.",
        "실제 크기 출력은 인쇄 설정에서 배율을 100%·실제 크기로 설정합니다.",
      ],
    },
  };

  function closeHelp() {
    if (typeof dialog.close === "function" && dialog.open) {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
  }

  function openHelp(step) {
    const help = HELP[String(step)];
    if (!help) return;
    title.textContent = help.title;
    description.textContent = help.description;
    steps.replaceChildren(
      ...help.steps.map((text) => {
        const item = document.createElement("li");
        item.textContent = text;
        return item;
      }),
    );
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  buttons.forEach((button) => {
    button.addEventListener("click", () => openHelp(button.dataset.studioHelp));
  });

  closeButtons.forEach((button) => {
    button.addEventListener("click", closeHelp);
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeHelp();
  });
})();
