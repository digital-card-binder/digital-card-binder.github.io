"use strict";

(function () {
  const FIREBASE_VERSION = "12.16.0";
  const PUSH_CONFIG_URL = "/push-config.json";
  const SERVICE_WORKER_URL = "/sw.js";

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches
      || window.navigator.standalone === true;
  }

  function base64UrlToUint8Array(value) {
    const padding = "=".repeat((4 - (value.length % 4)) % 4);
    const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
  }

  async function subscriptionId(endpoint) {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(endpoint),
    );
    return [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  async function ensureServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      throw new Error("이 기기에서는 웹앱 알림을 지원하지 않습니다.");
    }
    await navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: "/" });
    return navigator.serviceWorker.ready;
  }

  async function getFirebaseContext() {
    const config = window.POKEMON_DEX_FIREBASE?.config;
    if (!config) throw new Error("Firebase 설정을 찾지 못했습니다.");

    const [appModule, authModule, firestoreModule] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`),
    ]);

    const app = appModule.getApps().length
      ? appModule.getApp()
      : appModule.initializeApp(config);
    const auth = authModule.getAuth(app);

    let user = auth.currentUser;
    if (!user) {
      user = await new Promise((resolve) => {
        let settled = false;
        const finish = (value) => {
          if (settled) return;
          settled = true;
          resolve(value || null);
        };
        const unsubscribe = authModule.onAuthStateChanged(auth, (nextUser) => {
          unsubscribe();
          finish(nextUser);
        });
        window.setTimeout(() => {
          unsubscribe();
          finish(auth.currentUser);
        }, 1800);
      });
    }

    return {
      user,
      db: firestoreModule.getFirestore(app),
      firestoreModule,
    };
  }

  async function loadPublicKey() {
    const response = await fetch(`${PUSH_CONFIG_URL}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("알림 설정이 아직 준비되지 않았습니다.");
    const config = await response.json();
    const publicKey = String(config?.publicKey || "").trim();
    if (!publicKey) throw new Error("알림 공개키를 확인하지 못했습니다.");
    return publicKey;
  }

  async function saveSubscription(subscription) {
    const { user, db, firestoreModule } = await getFirebaseContext();
    if (!user) throw new Error("Google 로그인 후 알림을 켜주세요.");

    const json = subscription.toJSON();
    const endpoint = String(json.endpoint || subscription.endpoint || "");
    const id = await subscriptionId(endpoint);
    const ref = firestoreModule.doc(
      db,
      "users",
      user.uid,
      "webPushSubscriptions",
      id,
    );

    await firestoreModule.setDoc(ref, {
      schemaVersion: 1,
      endpoint,
      p256dh: String(json.keys?.p256dh || ""),
      auth: String(json.keys?.auth || ""),
      platform: "ios-pwa",
      userAgent: navigator.userAgent.slice(0, 500),
      createdAt: firestoreModule.serverTimestamp(),
      updatedAt: firestoreModule.serverTimestamp(),
    }, { merge: true });
  }

  async function removeSubscription(subscription) {
    try {
      const { user, db, firestoreModule } = await getFirebaseContext();
      if (user && subscription?.endpoint) {
        const id = await subscriptionId(subscription.endpoint);
        await firestoreModule.deleteDoc(
          firestoreModule.doc(db, "users", user.uid, "webPushSubscriptions", id),
        );
      }
    } catch (error) {
      console.warn("웹 푸시 구독 문서를 정리하지 못했습니다.", error);
    }

    if (subscription) await subscription.unsubscribe();
  }

  function installPwaMetadata() {
    if (!document.querySelector('link[rel="manifest"]')) {
      const manifest = document.createElement("link");
      manifest.rel = "manifest";
      manifest.href = "/manifest.webmanifest";
      document.head.append(manifest);
    }

    const metaValues = [
      ["apple-mobile-web-app-capable", "yes"],
      ["apple-mobile-web-app-title", "디지털 카드 바인더"],
      ["apple-mobile-web-app-status-bar-style", "default"],
    ];
    for (const [name, content] of metaValues) {
      if (document.querySelector(`meta[name="${name}"]`)) continue;
      const meta = document.createElement("meta");
      meta.name = name;
      meta.content = content;
      document.head.append(meta);
    }
  }

  function createCard() {
    if (!isIOS() || document.getElementById("ios-pwa-card")) return null;

    const card = document.createElement("section");
    card.id = "ios-pwa-card";
    card.className = "ios-pwa-card is-visible";
    card.setAttribute("aria-label", "iPhone 앱 및 알림 설정");
    card.innerHTML = `
      <div class="ios-pwa-icon" aria-hidden="true">◉</div>
      <div class="ios-pwa-copy">
        <span class="ios-pwa-badge">iPhone Web App</span>
        <strong id="ios-pwa-title"></strong>
        <span id="ios-pwa-description" class="ios-pwa-description"></span>
      </div>
      <button id="ios-pwa-button" class="ios-pwa-button" type="button"></button>
      <p id="ios-pwa-status" class="ios-pwa-status" aria-live="polite"></p>
    `;

    const androidCard = document.getElementById("android-app-download");
    const newsStrip = document.getElementById("dashboard-news-strip");
    if (androidCard) androidCard.insertAdjacentElement("afterend", card);
    else if (newsStrip) newsStrip.insertAdjacentElement("afterend", card);
    else document.querySelector("main")?.prepend(card);
    return card;
  }

  async function refreshCard() {
    const card = document.getElementById("ios-pwa-card");
    if (!card) return;

    const title = card.querySelector("#ios-pwa-title");
    const description = card.querySelector("#ios-pwa-description");
    const button = card.querySelector("#ios-pwa-button");
    const status = card.querySelector("#ios-pwa-status");

    if (!isStandalone()) {
      title.textContent = "디지털 카드 바인더를 iPhone 앱으로 사용";
      description.textContent = "Safari 공유 메뉴에서 ‘홈 화면에 추가’를 선택하세요.";
      button.textContent = "설치 방법";
      button.disabled = false;
      status.textContent = "홈 화면에 추가하면 주소창 없이 앱처럼 실행됩니다.";
      button.onclick = () => {
        window.alert("Safari 하단의 공유 버튼을 누른 뒤 ‘홈 화면에 추가’를 선택하세요. 추가된 디지털 카드 바인더를 홈 화면에서 실행하면 알림도 켤 수 있습니다.");
      };
      return;
    }

    title.textContent = "새소식 알림";
    description.textContent = "디지털 카드 바인더의 새소식을 iPhone 알림으로 받아보세요.";

    if (!("Notification" in window) || !("PushManager" in window)) {
      button.textContent = "지원 안 됨";
      button.disabled = true;
      status.textContent = "이 iOS 버전에서는 웹앱 알림을 사용할 수 없습니다.";
      return;
    }

    let subscription = null;
    try {
      const registration = await ensureServiceWorker();
      subscription = await registration.pushManager.getSubscription();
    } catch (error) {
      console.warn(error);
    }

    if (Notification.permission === "denied") {
      button.textContent = "알림 차단됨";
      button.disabled = true;
      status.textContent = "iPhone 설정 → 알림에서 디지털 카드 바인더 알림을 허용해주세요.";
      return;
    }

    if (subscription) {
      button.textContent = "알림 끄기";
      button.disabled = false;
      status.textContent = "새소식 알림이 켜져 있습니다.";
      button.onclick = async () => {
        button.disabled = true;
        status.textContent = "알림을 끄는 중입니다…";
        await removeSubscription(subscription);
        await refreshCard();
      };
      return;
    }

    button.textContent = "알림 켜기";
    button.disabled = false;
    status.textContent = "Google 로그인 후 한 번만 알림을 허용하면 됩니다.";
    button.onclick = async () => {
      button.disabled = true;
      status.textContent = "알림을 설정하는 중입니다…";
      try {
        const { user } = await getFirebaseContext();
        if (!user) throw new Error("Google 로그인 후 알림을 켜주세요.");

        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          throw new Error("알림 권한이 허용되지 않았습니다.");
        }

        const [registration, publicKey] = await Promise.all([
          ensureServiceWorker(),
          loadPublicKey(),
        ]);
        const nextSubscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(publicKey),
        });
        await saveSubscription(nextSubscription);
        if ("setAppBadge" in navigator) {
          try { await navigator.clearAppBadge(); } catch {}
        }
        await refreshCard();
      } catch (error) {
        console.error("iPhone PWA 알림 설정 오류", error);
        status.textContent = error?.message || "알림을 설정하지 못했습니다.";
        button.disabled = false;
      }
    };
  }

  async function initialize() {
    installPwaMetadata();
    try {
      await ensureServiceWorker();
    } catch (error) {
      console.warn("서비스 워커 등록 실패", error);
    }

    if (document.body?.dataset.page === "dashboard" || document.getElementById("dashboard-news-strip")) {
      createCard();
      await refreshCard();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
