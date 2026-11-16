"use strict";

// 위시카드 페이지: 도감 구분 없이 담은 카드를 한 목록으로 보여 준다.
(function () {
  const wishlist = window.DigitalCardBinder?.wishlist;
  const grid = document.querySelector("#wish-grid");
  const stateBox = document.querySelector("#wish-state");
  const countEl = document.querySelector("#wish-count");
  const search = document.querySelector("#wish-search");
  if (!wishlist || !grid || !stateBox) return;

  function setState(title, body, action) {
    stateBox.hidden = false;
    stateBox.replaceChildren();
    const strong = document.createElement("strong");
    strong.textContent = title;
    stateBox.append(strong);
    if (body) {
      const text = document.createElement("p");
      text.textContent = body;
      stateBox.append(text);
    }
    if (action) stateBox.append(action);
    grid.hidden = true;
  }

  function linkButton(label, href, onClick) {
    const element = document.createElement(href ? "a" : "button");
    element.className = "wish-action";
    element.textContent = label;
    if (href) element.href = href;
    else {
      element.type = "button";
      element.addEventListener("click", onClick);
    }
    return element;
  }

  function cardElement(item) {
    const article = document.createElement("article");
    article.className = "wish-card";

    const open = document.createElement("a");
    open.className = "wish-card-link";
    open.href = item.p || "./";
    open.setAttribute("aria-label", `${item.n} 도감에서 보기`);

    const imageWrap = document.createElement("span");
    imageWrap.className = "wish-card-image";
    if (item.i) {
      const image = document.createElement("img");
      image.src = item.i;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.addEventListener("error", () => imageWrap.classList.add("is-broken"), { once: true });
      imageWrap.append(image);
    }

    const body = document.createElement("span");
    body.className = "wish-card-body";
    const tag = document.createElement("span");
    tag.className = "wish-card-tag";
    tag.textContent = item.t || "";
    const name = document.createElement("strong");
    name.className = "wish-card-name";
    name.textContent = item.n;
    body.append(tag, name);
    open.append(imageWrap, body);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "wish-heart is-wished";
    remove.textContent = "♥";
    remove.setAttribute("aria-pressed", "true");
    remove.setAttribute("aria-label", `${item.n} 위시에서 빼기`);
    remove.addEventListener("click", async () => {
      remove.disabled = true;
      const result = await wishlist.toggle({ name: item.n, tag: item.t, image: item.i, page: item.p });
      if (result === "error") remove.disabled = false;
    });

    article.append(open, remove);
    return article;
  }

  function render() {
    const status = wishlist.state.status;
    const items = wishlist.list();
    if (countEl) countEl.textContent = status === "ready" ? String(items.length) : "—";

    if (status === "loading") return setState("위시카드를 불러오는 중입니다.");
    if (status === "unconfigured") return setState("Firebase 설정이 필요합니다.", "로그인 기능을 사용할 수 없어 위시카드를 불러올 수 없습니다.");
    if (status === "error") return setState("위시카드를 불러오지 못했습니다.", "잠시 후 새로고침해 주세요. 다른 도감 데이터에는 영향이 없습니다.");
    if (status === "signed-out") {
      return setState(
        "로그인하면 위시카드가 보여요.",
        "Google 계정으로 로그인하면 어느 기기에서든 같은 위시카드를 볼 수 있어요.",
        linkButton("Google 로그인", "", () => wishlist.signIn().catch((error) => console.warn("로그인 실패", error))),
      );
    }
    if (!items.length) {
      return setState(
        "아직 담은 카드가 없어요.",
        "카드 왼쪽 위의 ♡를 누르면 이곳에 모여요.",
        linkButton("도감 둘러보기", "./series.html"),
      );
    }

    const query = String(search?.value || "").trim().toLocaleLowerCase("ko-KR");
    const shown = query
      ? items.filter((item) => `${item.n} ${item.t}`.toLocaleLowerCase("ko-KR").includes(query))
      : items;
    if (!shown.length) return setState("조건에 맞는 카드가 없어요.", "검색어를 바꿔 보세요.");

    stateBox.hidden = true;
    grid.hidden = false;
    grid.replaceChildren(...shown.map(cardElement));
  }

  wishlist.subscribe(render);
  search?.addEventListener("input", render);
  render();
  wishlist.ready().then(render);
})();
