"use strict";

(function () {
  const SDK_VERSION = "12.16.0";
  const CONFIG = window.POKEMON_DEX_FIREBASE || {};
  const TRADE_DRAFT_KEY = "digitalCardBinderTradeDraftV2";
  const PROPOSAL_DRAFT_KEY = "digitalCardBinderProposalDraftV1";
  const state = {
    firebase: null, user: null, profile: null, posts: [], draft: null,
    proposalDraft: null, received: [], sent: [],
    unreadByProposal: new Map(), activeConversation: null,
  };
  const $ = (id) => document.getElementById(id);
  const clean = (value, max = 160) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);

  function configured() {
    const config = CONFIG.config || {};
    return Boolean(CONFIG.enabled && config.apiKey && config.authDomain && config.projectId);
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
    })[character]);
  }

  function safeImageUrl(value) {
    try {
      const source = String(value || "").trim();
      if (!source) return "";
      const url = new URL(source, window.location.href);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch { return ""; }
  }

  function readSessionJson(key) {
    try { return JSON.parse(window.sessionStorage.getItem(key) || "null"); }
    catch { return null; }
  }

  function sanitizeCard(value) {
    if (!value || !clean(value.name, 100)) return null;
    return {
      name: clean(value.name, 100), imageUrl: safeImageUrl(value.imageUrl),
      detail: clean(value.detail, 160), sourcePage: clean(value.sourcePage, 80),
    };
  }

  function sanitizeCards(value) {
    return Array.isArray(value)
      ? value.map(sanitizeCard).filter(Boolean).slice(0, 6)
      : [];
  }

  function readTradeDraft() {
    const value = readSessionJson(TRADE_DRAFT_KEY);
    const wantedCard = sanitizeCard(value?.wantedCard);
    if (!wantedCard) return null;
    return { wantedCard, offeredCards: sanitizeCards(value?.offeredCards) };
  }

  function readProposalDraft() {
    const value = readSessionJson(PROPOSAL_DRAFT_KEY);
    if (!value?.postId || !value?.postAuthorUid) return null;
    return {
      postId: clean(value.postId, 128), postAuthorUid: clean(value.postAuthorUid, 128),
      postLabel: clean(value.postLabel, 160),
      cards: sanitizeCards(value.cards),
    };
  }

  function wantedCardFor(post) {
    const card = sanitizeCard(post?.wantedCard);
    if (card) return card;
    const legacyName = clean(post?.wantedCard, 120);
    return legacyName
      ? { name: legacyName, imageUrl: "", detail: "", sourcePage: "" }
      : null;
  }

  function offeredCardsFor(post) {
    const cards = sanitizeCards(post?.offeredCards);
    if (cards.length) return cards;
    const legacyCard = sanitizeCard(post?.offeredCard);
    return legacyCard ? [legacyCard] : [];
  }

  function timestampMillis(value) {
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (value?.seconds) return Number(value.seconds) * 1000;
    return 0;
  }

  function formatDate(value, includeTime = false) {
    const millis = timestampMillis(value);
    if (!millis) return "방금 전";
    const options = { year: "numeric", month: "2-digit", day: "2-digit" };
    if (includeTime) Object.assign(options, { hour: "2-digit", minute: "2-digit" });
    return new Intl.DateTimeFormat("ko-KR", options).format(new Date(millis));
  }

  function cardImage(card, alt = "") {
    const imageUrl = safeImageUrl(card?.imageUrl);
    return imageUrl
      ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(alt || card?.name)}" loading="lazy" />`
      : '<span class="trade-image-placeholder" aria-hidden="true">CARD</span>';
  }

  function renderTradeDraft() {
    state.draft = readTradeDraft();
    if (!state.draft) return;
    const wanted = state.draft.wantedCard;
    $("trade-wanted-card").innerHTML = `${cardImage(wanted)}<div><span>내가 원하는 미보유 카드</span><strong>${escapeHtml(wanted.name)}</strong><small>${escapeHtml(wanted.detail)}</small></div>`;
    $("trade-offered-cards").innerHTML = state.draft.offeredCards.length
      ? state.draft.offeredCards.map((card, index) => `<article class="trade-proposal-card">${cardImage(card)}<div><strong>${escapeHtml(card.name)}</strong><small>${escapeHtml(card.detail)}</small></div><button type="button" data-remove-trade-card="${index}" aria-label="${escapeHtml(card.name)} 제거">×</button></article>`).join("")
      : '<div class="trade-board-state"><strong>아직 줄 수 있는 카드를 고르지 않았습니다.</strong><p>보유 카드 중 하나 이상을 추가해 주세요.</p></div>';
    $("trade-register-panel").hidden = false;
  }

  function saveTradeDraft() {
    window.sessionStorage.setItem(TRADE_DRAFT_KEY, JSON.stringify(state.draft));
  }

  function renderProposalDraft() {
    state.proposalDraft = readProposalDraft();
    if (!state.proposalDraft) return;
    const post = state.posts.find((item) => item.id === state.proposalDraft.postId);
    const wanted = wantedCardFor(post);
    const label = post ? `${post.authorNickname}님이 구하는 ${wanted?.name || "카드"}` : state.proposalDraft.postLabel || "선택한 교환글";
    $("trade-proposal-target").innerHTML = `<span>제안 대상</span><strong>${escapeHtml(label)}</strong>`;
    $("trade-proposal-cards").innerHTML = state.proposalDraft.cards.length
      ? state.proposalDraft.cards.map((card, index) => `<article class="trade-proposal-card">${cardImage(card)}<div><strong>${escapeHtml(card.name)}</strong><small>${escapeHtml(card.detail)}</small></div><button type="button" data-remove-proposal-card="${index}" aria-label="${escapeHtml(card.name)} 제거">×</button></article>`).join("")
      : '<div class="trade-board-state"><strong>제안할 카드가 없습니다.</strong><p>내 도감에서 보유 카드를 하나 이상 선택해 주세요.</p></div>';
    $("trade-proposal-panel").hidden = false;
  }

  function saveProposalDraft() {
    window.sessionStorage.setItem(PROPOSAL_DRAFT_KEY, JSON.stringify(state.proposalDraft));
  }

  function postMatches(post) {
    const query = clean($("trade-search")?.value, 100).toLocaleLowerCase("ko-KR");
    const status = $("trade-status-filter")?.value || "all";
    const offer = $("trade-offer-filter")?.value || "all";
    if (status !== "all" && post.status !== status) return false;
    if (offer === "yes" && !post.acceptOffers) return false;
    if (offer === "no" && post.acceptOffers) return false;
    const wanted = wantedCardFor(post);
    const offered = offeredCardsFor(post);
    return !query || [post.authorNickname, wanted?.name, wanted?.detail, ...offered.flatMap((card) => [card.name, card.detail])]
      .join(" ").toLocaleLowerCase("ko-KR").includes(query);
  }

  function postOfferedCardsHtml(post) {
    const cards = offeredCardsFor(post);
    if (!cards.length) return '<span class="trade-post-no-offer">제시한 카드 없음</span>';
    return cards.map((card) => `<span class="trade-post-offered-card">${cardImage(card)}<b>${escapeHtml(card.name)}</b></span>`).join("");
  }

  function renderPosts() {
    const posts = state.posts.filter(postMatches);
    $("trade-count").innerHTML = `교환글 <strong>${posts.length}</strong>개`;
    $("trade-grid").hidden = posts.length === 0;
    $("trade-empty").hidden = posts.length !== 0;
    $("trade-grid").innerHTML = posts.map((post) => {
      const completed = post.status === "completed";
      const mine = state.user?.uid === post.authorUid;
      const wanted = wantedCardFor(post);
      const actions = completed ? "" : mine
        ? `<button type="button" data-delete-post="${escapeHtml(post.id)}">글 삭제</button>`
        : `<button class="trade-propose-button" type="button" data-propose-post="${escapeHtml(post.id)}">교환 제안</button>`;
      return `<article class="trade-card"><div class="trade-card-image">${cardImage(wanted)}</div><div class="trade-card-copy"><div class="trade-card-meta"><strong>${escapeHtml(post.authorNickname || "컬렉터")}</strong><time>${escapeHtml(formatDate(post.createdAt))}</time></div><div class="trade-card-status"><span class="${completed ? "is-closed" : ""}">${completed ? "교환완료" : "교환중"}</span>${post.acceptOffers ? "<small>다른 제안도 받아요</small>" : ""}</div><dl><div><dt>원하는 카드</dt><dd><strong>${escapeHtml(wanted?.name || "카드 정보 없음")}</strong><small>${escapeHtml(wanted?.detail)}</small></dd></div><div><dt>내가 줄 수 있는 카드</dt><dd><div class="trade-post-offered-cards">${postOfferedCardsHtml(post)}</div></dd></div></dl><div class="trade-card-actions">${actions}</div></div></article>`;
    }).join("");
  }

  function proposalStatus(status) {
    if (status === "accepted") return ["수락", "is-accepted"];
    if (status === "rejected") return ["거절", "is-rejected"];
    return ["대기", ""];
  }

  function proposalHtml(proposal, received) {
    const [label, className] = proposalStatus(proposal.status);
    const post = state.posts.find((item) => item.id === proposal.postId);
    const wanted = wantedCardFor(post);
    const title = received ? `${proposal.proposerNickname || "컬렉터"}님의 제안` : `${post?.authorNickname || "컬렉터"}님에게 보낸 제안`;
    const cards = (proposal.offeredCards || []).map((card) => `<span>${escapeHtml(card.name)}${card.detail ? ` · ${escapeHtml(card.detail)}` : ""}</span>`).join("");
    let actions = "";
    if (received && proposal.status === "pending" && post?.status === "open") {
      actions = `<button type="button" data-action="accept" data-proposal-id="${escapeHtml(proposal.id)}">수락</button><button type="button" data-action="reject" data-proposal-id="${escapeHtml(proposal.id)}">거절</button>`;
    } else if (proposal.status === "accepted") {
      actions = `<button type="button" data-action="message" data-proposal-id="${escapeHtml(proposal.id)}">쪽지 열기</button>`;
    }
    return `<article class="trade-proposal-item"><div class="trade-proposal-item-head"><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(wanted?.name || "삭제된 교환글")} · ${escapeHtml(formatDate(proposal.createdAt))}</small></div><span class="trade-proposal-status ${className}">${label}</span></div><div class="trade-proposal-mini-cards">${cards}</div>${proposal.message ? `<p class="trade-proposal-message">${escapeHtml(proposal.message)}</p>` : ""}<div class="trade-proposal-actions">${actions}</div></article>`;
  }

  function renderPrivateActivity() {
    $("trade-received-count").textContent = String(state.received.length);
    $("trade-sent-count").textContent = String(state.sent.length);
    $("trade-received-list").innerHTML = state.received.map((item) => proposalHtml(item, true)).join("");
    $("trade-sent-list").innerHTML = state.sent.map((item) => proposalHtml(item, false)).join("");
    $("trade-received-empty").hidden = state.received.length > 0;
    $("trade-sent-empty").hidden = state.sent.length > 0;
    const accepted = new Map();
    [...state.received, ...state.sent].filter((item) => item.status === "accepted").forEach((item) => accepted.set(item.id, item));
    const conversations = [...accepted.values()];
    $("trade-conversation-list").innerHTML = conversations.map((proposal) => {
      const post = state.posts.find((item) => item.id === proposal.postId);
      const wanted = wantedCardFor(post);
      const peerName = state.user?.uid === proposal.postAuthorUid ? proposal.proposerNickname || "교환 상대" : post?.authorNickname || "교환 상대";
      const unread = state.unreadByProposal.get(proposal.id) || 0;
      return `<button class="trade-conversation-item" type="button" data-open-conversation="${escapeHtml(proposal.id)}"><div><strong>${escapeHtml(peerName)}</strong><small>${escapeHtml(wanted?.name || "교환 제안")}</small></div>${unread ? `<b>${unread}</b>` : ""}</button>`;
    }).join("");
    $("trade-messages-empty").hidden = conversations.length > 0;
    $("trade-unread-count").textContent = String([...state.unreadByProposal.values()].reduce((sum, count) => sum + count, 0));
  }

  async function initializeFirebase() {
    if (!configured()) throw new Error("Firebase configuration is unavailable.");
    const [appModule, authModule, firestoreModule] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`),
    ]);
    const app = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(CONFIG.config);
    const auth = authModule.getAuth(app);
    state.firebase = { auth, authModule, db: firestoreModule.getFirestore(app), firestoreModule };
    authModule.onAuthStateChanged(auth, async (user) => {
      state.user = user || null; state.profile = null;
      if (user) await loadProfileAndPrivateData();
      else { state.received = []; state.sent = []; state.unreadByProposal.clear(); renderPrivateActivity(); }
      renderPosts();
    });
  }

  async function loadProfileAndPrivateData() {
    if (!state.user) return;
    const { db, firestoreModule } = state.firebase;
    const profileSnapshot = await firestoreModule.getDoc(firestoreModule.doc(db, "users", state.user.uid, "profile", "main"));
    state.profile = profileSnapshot.exists() ? profileSnapshot.data() : null;
    const proposals = firestoreModule.collection(db, "tradeProposals");
    const [receivedSnapshot, sentSnapshot] = await Promise.all([
      firestoreModule.getDocs(firestoreModule.query(proposals, firestoreModule.where("postAuthorUid", "==", state.user.uid))),
      firestoreModule.getDocs(firestoreModule.query(proposals, firestoreModule.where("proposerUid", "==", state.user.uid))),
    ]);
    const newestFirst = (a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt);
    state.received = receivedSnapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })).sort(newestFirst);
    state.sent = sentSnapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })).sort(newestFirst);
    await loadUnreadCounts(); renderPrivateActivity();
  }

  async function loadUnreadCounts() {
    state.unreadByProposal.clear();
    const ids = [...new Set([...state.received, ...state.sent].filter((item) => item.status === "accepted").map((item) => item.id))];
    const { db, firestoreModule } = state.firebase;
    await Promise.all(ids.map(async (proposalId) => {
      const snapshot = await firestoreModule.getDocs(firestoreModule.query(firestoreModule.collection(db, "tradeMessages"), firestoreModule.where("proposalId", "==", proposalId)));
      const count = snapshot.docs.filter((entry) => entry.data().recipientUid === state.user.uid && !entry.data().readAt).length;
      state.unreadByProposal.set(proposalId, count);
    }));
  }

  async function loadPosts() {
    const { db, firestoreModule } = state.firebase;
    const reference = firestoreModule.query(firestoreModule.collection(db, "tradePosts"), firestoreModule.orderBy("createdAt", "desc"), firestoreModule.limit(100));
    const snapshot = await firestoreModule.getDocs(reference);
    state.posts = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
    $("trade-loading").hidden = true; renderPosts(); renderProposalDraft(); renderPrivateActivity();
  }

  async function signIn() {
    const { auth, authModule } = state.firebase;
    const result = await authModule.signInWithPopup(auth, new authModule.GoogleAuthProvider());
    state.user = result.user || auth.currentUser || null;
    if (state.user) await loadProfileAndPrivateData();
  }

  async function requireUser(messageElement) {
    if (!state.user) { if (messageElement) messageElement.textContent = "Google 로그인이 필요합니다."; await signIn(); }
    if (!state.user) return false;
    if (!state.profile?.profileCompleted || !clean(state.profile.nickname, 20)) {
      if (messageElement) messageElement.innerHTML = '먼저 <a href="./collector-settings.html#collector-profile-title">프로필설정에서 닉네임</a>을 만들어 주세요.';
      return false;
    }
    return true;
  }

  async function submitTrade(event) {
    event.preventDefault();
    const message = $("trade-register-message"); const submit = $("trade-register-submit");
    message.textContent = "";
    if (!state.draft || !(await requireUser(message))) return;
    if (!state.draft.wantedCard || !state.draft.offeredCards.length) {
      message.textContent = "미보유 카드와 줄 수 있는 보유 카드를 모두 선택해 주세요.";
      return;
    }
    try {
      submit.disabled = true;
      const { db, firestoreModule } = state.firebase;
      await firestoreModule.addDoc(firestoreModule.collection(db, "tradePosts"), {
        schemaVersion: 2, authorUid: state.user.uid, authorNickname: clean(state.profile.nickname, 20),
        wantedCard: state.draft.wantedCard, offeredCards: state.draft.offeredCards,
        acceptOffers: $("trade-accept-offers").checked,
        status: "open", createdAt: firestoreModule.serverTimestamp(), updatedAt: firestoreModule.serverTimestamp(),
      });
      window.sessionStorage.removeItem(TRADE_DRAFT_KEY); state.draft = null;
      $("trade-register-form").reset(); $("trade-register-panel").hidden = true; await loadPosts();
    } catch (error) { console.error(error); message.textContent = "교환글을 등록하지 못했습니다."; }
    finally { submit.disabled = false; }
  }

  async function beginProposal(postId) {
    if (!(await requireUser())) return;
    const post = state.posts.find((item) => item.id === postId);
    if (!post || post.status !== "open" || post.authorUid === state.user.uid) return;
    const wanted = wantedCardFor(post);
    state.proposalDraft = { postId, postAuthorUid: post.authorUid, postLabel: `${post.authorNickname}님이 구하는 ${wanted?.name || "카드"}`, cards: [] };
    saveProposalDraft(); window.location.href = "./national.html";
  }

  async function submitProposal(event) {
    event.preventDefault();
    const message = $("trade-proposal-form-message"); const submit = $("trade-proposal-submit");
    message.textContent = "";
    if (!state.proposalDraft || !(await requireUser(message))) return;
    if (!state.proposalDraft.cards.length) { message.textContent = "보유 카드 중 하나 이상을 선택해 주세요."; return; }
    try {
      submit.disabled = true;
      const { db, firestoreModule } = state.firebase;
      await firestoreModule.addDoc(firestoreModule.collection(db, "tradeProposals"), {
        schemaVersion: 1, postId: state.proposalDraft.postId, postAuthorUid: state.proposalDraft.postAuthorUid,
        proposerUid: state.user.uid, proposerNickname: clean(state.profile.nickname, 20), offeredCards: state.proposalDraft.cards,
        message: clean($("trade-proposal-message").value, 300), status: "pending",
        createdAt: firestoreModule.serverTimestamp(), updatedAt: firestoreModule.serverTimestamp(),
      });
      window.sessionStorage.removeItem(PROPOSAL_DRAFT_KEY); state.proposalDraft = null;
      $("trade-proposal-form").reset(); $("trade-proposal-panel").hidden = true;
      await loadProfileAndPrivateData(); switchView("sent");
    } catch (error) { console.error(error); message.textContent = "교환 제안을 보내지 못했습니다."; }
    finally { submit.disabled = false; }
  }

  async function updateProposal(proposalId, nextStatus) {
    const proposal = state.received.find((item) => item.id === proposalId);
    if (!proposal || proposal.status !== "pending") return;
    const { db, firestoreModule } = state.firebase;
    if (nextStatus === "rejected") {
      await firestoreModule.updateDoc(firestoreModule.doc(db, "tradeProposals", proposalId), { status: "rejected", updatedAt: firestoreModule.serverTimestamp() });
    } else {
      const batch = firestoreModule.writeBatch(db);
      batch.update(firestoreModule.doc(db, "tradeProposals", proposalId), { status: "accepted", updatedAt: firestoreModule.serverTimestamp() });
      batch.update(firestoreModule.doc(db, "tradePosts", proposal.postId), { status: "completed", acceptedProposalId: proposalId, updatedAt: firestoreModule.serverTimestamp() });
      batch.set(firestoreModule.doc(db, "tradeConversations", proposalId), {
        schemaVersion: 1, proposalId, postId: proposal.postId,
        participantUids: [proposal.postAuthorUid, proposal.proposerUid],
        createdAt: firestoreModule.serverTimestamp(), updatedAt: firestoreModule.serverTimestamp(),
      });
      await batch.commit();
    }
    await loadPosts(); await loadProfileAndPrivateData();
  }

  async function deletePost(postId) {
    const post = state.posts.find((item) => item.id === postId);
    if (!post || post.authorUid !== state.user?.uid || post.status !== "open" || !window.confirm("이 교환글을 삭제할까요?")) return;
    const { db, firestoreModule } = state.firebase;
    await firestoreModule.deleteDoc(firestoreModule.doc(db, "tradePosts", postId)); await loadPosts();
  }

  function findProposal(proposalId) {
    return [...state.received, ...state.sent].find((item) => item.id === proposalId);
  }

  async function openConversation(proposalId) {
    const proposal = findProposal(proposalId);
    if (!proposal || proposal.status !== "accepted" || !state.user) return;
    const post = state.posts.find((item) => item.id === proposal.postId);
    const peerUid = state.user.uid === proposal.postAuthorUid ? proposal.proposerUid : proposal.postAuthorUid;
    const peerName = state.user.uid === proposal.postAuthorUid ? proposal.proposerNickname || "교환 상대" : post?.authorNickname || "교환 상대";
    state.activeConversation = { proposal, peerUid, peerName };
    $("trade-message-peer").textContent = peerName; $("trade-message-dialog").showModal(); await loadMessages();
  }

  async function loadMessages() {
    const active = state.activeConversation;
    if (!active) return;
    const { db, firestoreModule } = state.firebase;
    const snapshot = await firestoreModule.getDocs(firestoreModule.query(firestoreModule.collection(db, "tradeMessages"), firestoreModule.where("proposalId", "==", active.proposal.id)));
    const messages = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })).sort((a, b) => timestampMillis(a.createdAt) - timestampMillis(b.createdAt));
    $("trade-message-list").innerHTML = messages.length
      ? messages.map((item) => `<div class="trade-message-bubble ${item.senderUid === state.user.uid ? "is-mine" : ""}">${escapeHtml(item.text)}<time>${escapeHtml(formatDate(item.createdAt, true))}</time></div>`).join("")
      : '<div class="trade-board-state"><strong>아직 쪽지가 없습니다.</strong></div>';
    const unread = messages.filter((item) => item.recipientUid === state.user.uid && !item.readAt);
    await Promise.all(unread.map((item) => firestoreModule.updateDoc(firestoreModule.doc(db, "tradeMessages", item.id), { readAt: firestoreModule.serverTimestamp() })));
    state.unreadByProposal.set(active.proposal.id, 0); renderPrivateActivity();
    $("trade-message-list").scrollTop = $("trade-message-list").scrollHeight;
  }

  async function sendMessage(event) {
    event.preventDefault();
    const active = state.activeConversation; const text = clean($("trade-message-text").value, 500);
    if (!active || !text) return;
    const { db, firestoreModule } = state.firebase;
    try {
      await firestoreModule.addDoc(firestoreModule.collection(db, "tradeMessages"), {
        schemaVersion: 1, proposalId: active.proposal.id, senderUid: state.user.uid,
        recipientUid: active.peerUid, text, createdAt: firestoreModule.serverTimestamp(), readAt: null,
      });
      $("trade-message-form").reset(); await loadMessages();
    } catch (error) { console.error(error); $("trade-message-status").textContent = "쪽지를 보낼 수 없습니다. 상대가 차단했거나 권한이 없을 수 있습니다."; }
  }

  async function blockActiveUser() {
    const active = state.activeConversation;
    if (!active || !window.confirm(`${active.peerName} 사용자를 차단할까요? 차단 후 서로 쪽지를 보낼 수 없습니다.`)) return;
    const { db, firestoreModule } = state.firebase; const blockId = `${state.user.uid}__${active.peerUid}`;
    await firestoreModule.setDoc(firestoreModule.doc(db, "tradeBlocks", blockId), {
      blockerUid: state.user.uid, blockedUid: active.peerUid, createdAt: firestoreModule.serverTimestamp(),
    });
    $("trade-message-status").textContent = "사용자를 차단했습니다.";
  }

  async function reportActiveUser() {
    const active = state.activeConversation;
    if (!active) return;
    const reason = clean(window.prompt("신고 사유를 입력해 주세요."), 300);
    if (reason.length < 2) return;
    const { db, firestoreModule } = state.firebase;
    await firestoreModule.addDoc(firestoreModule.collection(db, "tradeReports"), {
      schemaVersion: 1, proposalId: active.proposal.id, reporterUid: state.user.uid,
      targetUid: active.peerUid, reason, status: "new", createdAt: firestoreModule.serverTimestamp(),
    });
    $("trade-message-status").textContent = "신고가 접수되었습니다.";
  }

  async function switchView(view) {
    if (view !== "board" && !state.user) {
      try { await signIn(); } catch { return; }
      if (!state.user) return;
    }
    document.querySelectorAll("[data-trade-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.tradeView === view));
    $("trade-received-panel").hidden = view !== "received";
    $("trade-sent-panel").hidden = view !== "sent";
    $("trade-messages-panel").hidden = view !== "messages";
    $("trade-register-panel").hidden = view !== "board" || !state.draft;
    $("trade-proposal-panel").hidden = view !== "board" || !state.proposalDraft;
    $("trade-grid").closest("section").hidden = view !== "board";
  }

  function bindEvents() {
    ["trade-search", "trade-status-filter", "trade-offer-filter"].forEach((id) => $(id)?.addEventListener("input", renderPosts));
    $("trade-register-form")?.addEventListener("submit", submitTrade);
    $("trade-proposal-form")?.addEventListener("submit", submitProposal);
    $("trade-message-form")?.addEventListener("submit", sendMessage);
    $("trade-register-close")?.addEventListener("click", () => {
      window.sessionStorage.removeItem(TRADE_DRAFT_KEY);
      state.draft = null;
      $("trade-register-panel").hidden = true;
    });
    $("trade-proposal-close")?.addEventListener("click", () => { $("trade-proposal-panel").hidden = true; });
    $("trade-message-close")?.addEventListener("click", () => $("trade-message-dialog").close());
    $("trade-block-user")?.addEventListener("click", blockActiveUser);
    $("trade-report-user")?.addEventListener("click", reportActiveUser);
    document.addEventListener("click", async (event) => {
      const view = event.target.closest("[data-trade-view]")?.dataset.tradeView;
      if (view) return switchView(view);
      const postId = event.target.closest("[data-propose-post]")?.dataset.proposePost;
      if (postId) return beginProposal(postId);
      const deleteId = event.target.closest("[data-delete-post]")?.dataset.deletePost;
      if (deleteId) return deletePost(deleteId);
      const removeTradeIndex = event.target.closest("[data-remove-trade-card]")?.dataset.removeTradeCard;
      if (removeTradeIndex !== undefined && state.draft) {
        state.draft.offeredCards.splice(Number(removeTradeIndex), 1);
        saveTradeDraft(); renderTradeDraft(); return;
      }
      const removeIndex = event.target.closest("[data-remove-proposal-card]")?.dataset.removeProposalCard;
      if (removeIndex !== undefined && state.proposalDraft) {
        state.proposalDraft.cards.splice(Number(removeIndex), 1); saveProposalDraft(); renderProposalDraft(); return;
      }
      const actionButton = event.target.closest("[data-action][data-proposal-id]");
      if (actionButton) {
        if (actionButton.dataset.action === "message") return openConversation(actionButton.dataset.proposalId);
        return updateProposal(actionButton.dataset.proposalId, actionButton.dataset.action === "accept" ? "accepted" : "rejected");
      }
      const conversationId = event.target.closest("[data-open-conversation]")?.dataset.openConversation;
      if (conversationId) return openConversation(conversationId);
    });
  }

  async function start() {
    renderTradeDraft(); renderProposalDraft(); bindEvents();
    try { await initializeFirebase(); await loadPosts(); }
    catch (error) { console.error(error); $("trade-loading").hidden = true; $("trade-error").hidden = false; }
  }

  start();
})();
