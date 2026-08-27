"use strict";

(function () {
  const params = new URLSearchParams(window.location.search);
  const arView = params.get("view") === "series" ? "series" : "national";

  function syncArCountLabels() {
    const arLink = document.querySelector('a.collection-link[href="./ar.html"]');
    const subtitle = arLink?.querySelector("small");
    if (subtitle) subtitle.textContent = "SV · M · 510 CARDS";
  }

  function scopedNationalGroups(sourceGroups) {
    return (Array.isArray(sourceGroups) ? sourceGroups : []).map(
      (group, groupIndex) => ({
        ...group,
        code: `national::${String(group?.code || groupIndex)}`,
        cards: (Array.isArray(group?.cards) ? group.cards : []).map((card) => ({
          ...card,
          owned: false,
          legacyOwned: false,
          accountKey: "",
        })),
      }),
    );
  }

  function wrapAccount(account) {
    if (!account || account.__arDualCatalogWrapped) return account;

    const originalApplyGroups = account.applyGroups?.bind(account);
    if (typeof originalApplyGroups === "function") {
      account.applyGroups = (sourceGroups) => {
        if (arView !== "national") {
          return originalApplyGroups(sourceGroups);
        }

        const scopedGroups = scopedNationalGroups(sourceGroups);
        originalApplyGroups(scopedGroups);

        (Array.isArray(sourceGroups) ? sourceGroups : []).forEach(
          (group, groupIndex) => {
            (Array.isArray(group?.cards) ? group.cards : []).forEach(
              (card, cardIndex) => {
                const scopedCard = scopedGroups[groupIndex]?.cards?.[cardIndex];
                if (!scopedCard) return;
                card.owned = Boolean(scopedCard.owned);
                card.accountKey = scopedCard.accountKey || "";
              },
            );
          },
        );

        return sourceGroups;
      };
    }

    Object.defineProperty(account, "__arDualCatalogWrapped", {
      value: true,
      enumerable: false,
    });
    return account;
  }

  function installAccountWrapper() {
    const existing = window.PokemonDexPageAccount;
    if (existing) {
      window.PokemonDexPageAccount = wrapAccount(existing);
      return;
    }

    let accountValue;
    Object.defineProperty(window, "PokemonDexPageAccount", {
      configurable: true,
      enumerable: true,
      get() {
        return accountValue;
      },
      set(value) {
        accountValue = wrapAccount(value);
      },
    });
  }

  function viewUrl(nextView) {
    const url = new URL(window.location.href);
    url.searchParams.set("view", nextView);
    return url.href;
  }

  function injectStyles() {
    if (document.getElementById("ar-dual-catalog-style")) return;
    const style = document.createElement("style");
    style.id = "ar-dual-catalog-style";
    style.textContent = `
      .ar-view-tabs {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        margin: 0 0 20px;
        padding: 6px;
        border: 1px solid rgba(23, 35, 63, 0.09);
        border-radius: 16px;
        background: #f4f6fa;
      }
      .ar-view-tab {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 9px;
        min-height: 48px;
        border-radius: 11px;
        color: var(--ink-soft, #5e6677);
        font-size: 0.78rem;
        font-weight: 800;
        text-decoration: none;
        transition: transform 0.16s ease, background 0.16s ease, color 0.16s ease;
      }
      .ar-view-tab small {
        color: inherit;
        font-size: 0.6rem;
        font-weight: 700;
        opacity: 0.66;
      }
      .ar-view-tab:hover {
        transform: translateY(-1px);
      }
      .ar-view-tab.is-active {
        background: var(--navy, #17233f);
        color: #fff;
        box-shadow: 0 8px 18px rgba(23, 35, 63, 0.14);
      }
      .ar-view-national .catalog-select {
        display: none;
      }
      .ar-view-national .catalog-toolbar .search-field {
        grid-column: 1 / -1;
      }
      @media (max-width: 690px) {
        .ar-view-tabs {
          margin-bottom: 16px;
          border-radius: 13px;
        }
        .ar-view-tab {
          min-height: 44px;
          gap: 5px;
          font-size: 0.72rem;
        }
        .ar-view-tab small {
          display: none;
        }
      }
    `;
    document.head.append(style);
  }

  function injectTabs() {
    const panel = document.querySelector(".catalog-panel");
    const heading = panel?.querySelector(".catalog-heading");
    if (!panel || !heading) return;

    let tabs = panel.querySelector(".ar-view-tabs");
    if (!tabs) {
      tabs = document.createElement("nav");
      tabs.className = "ar-view-tabs";
      tabs.setAttribute("aria-label", "AR 도감 보기 선택");
      tabs.innerHTML = `
        <a class="ar-view-tab" data-ar-view="national" href="${viewUrl("national")}">
          <span>전국도감별</span><small>전국도감 순</small>
        </a>
        <a class="ar-view-tab" data-ar-view="series" href="${viewUrl("series")}">
          <span>시리즈별</span><small>세트별 수집</small>
        </a>
      `;
      heading.insertAdjacentElement("afterend", tabs);
    }

    tabs.querySelectorAll("[data-ar-view]").forEach((tab) => {
      const active = tab.dataset.arView === arView;
      tab.classList.toggle("is-active", active);
      if (active) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    });
  }

  function applyViewCopy() {
    document.body?.classList.toggle("ar-view-national", arView === "national");
    document.body?.classList.toggle("ar-view-series", arView === "series");

    const description = document.querySelector(".hero-description");
    if (description) {
      description.textContent =
        arView === "national"
          ? "전국도감 번호 순으로 모아보는 독립 AR 컬렉션"
          : "시리즈별로 모아보는 독립 AR 컬렉션";
    }

    const kicker = document.querySelector(".catalog-heading .section-kicker");
    if (kicker) {
      kicker.textContent =
        arView === "national"
          ? "NATIONAL DEX ART RARE CATALOG"
          : "SERIES ART RARE CATALOG";
    }

    const title = document.querySelector(".catalog-heading h2");
    if (title) {
      title.textContent = arView === "national" ? "전국도감별 AR" : "시리즈별 AR";
    }

    const filterLabel = document.querySelector(".catalog-select .filter-label");
    if (filterLabel) {
      filterLabel.textContent = arView === "series" ? "시리즈 선택" : "보기 선택";
    }
  }

  function configureSelect() {
    const select = document.getElementById("catalog-select");
    if (!select || !select.options.length) return false;

    if (arView === "series") {
      select.querySelector('option[value="national"]')?.remove();
      const firstGroup = select.querySelector("optgroup");
      if (firstGroup) firstGroup.label = "시리즈 보기";

      if (select.value === "national" || !select.value) {
        select.value = "all";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    } else if (select.value !== "national") {
      select.value = "national";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }

    applyViewCopy();
    return true;
  }

  function watchSelect() {
    const select = document.getElementById("catalog-select");
    if (!select) return;

    const observer = new MutationObserver(() => {
      if (configureSelect()) observer.disconnect();
    });
    observer.observe(select, { childList: true, subtree: true });

    configureSelect();
    window.addEventListener("load", () => {
      configureSelect();
      applyViewCopy();
    }, { once: true });
  }

  installAccountWrapper();
  syncArCountLabels();
  injectStyles();
  injectTabs();
  applyViewCopy();
  watchSelect();
})();
