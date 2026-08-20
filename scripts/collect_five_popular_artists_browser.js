"use strict";

(async () => {
  const BASE = location.origin;
  if (!/pokemoncard\.co\.kr$/i.test(location.hostname)) {
    alert("포켓몬코리아 카드 검색 페이지(https://pokemoncard.co.kr/cards)에서 실행해주세요.");
    return;
  }

  const TARGETS = [
    "Mitsuhiro Arita",
    "Kagemaru Himeno",
    "Kouki Saitou",
    "Naoki Saito",
    "kawayoo",
  ];
  const CACHE_KEY = "digital-card-binder:five-popular-artists:v1";
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const norm = (v) => String(v ?? "").replace(/\s+/g, " ").trim().toLowerCase();

  function loadCache() {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }

  function saveCache(cache) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.warn("cache save warning", error);
    }
  }

  function getSetCode(featureImage) {
    const path = String(featureImage || "").split("?")[0].replace(/^\/+|\/+$/g, "");
    const parts = path.split("/").filter(Boolean);
    if (parts.length >= 2) return parts[parts.length - 2];
    const file = parts.at(-1) || path;
    return (file.match(/^([^_]+)_/) || [])[1] || "";
  }

  function imageUrl(featureImage) {
    const v = String(featureImage || "").trim();
    return /^https?:\/\//i.test(v) ? v : `https://cards.image.pokemonkorea.co.kr/data/${v}`;
  }

  function textLines(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("script,style").forEach((el) => el.remove());
    return (doc.body?.innerText || "")
      .split(/\r?\n/)
      .map((v) => v.replace(/\s+/g, " ").trim())
      .filter(Boolean);
  }

  function parseDetail(html, internalCardNum, featureImage, sourceId) {
    const lines = textLines(html);
    let illustrator = "";
    let artistIndex = -1;

    for (let i = 0; i < lines.length; i += 1) {
      if (/^일러스트\s*$/.test(lines[i])) {
        for (let j = i + 1; j < Math.min(lines.length, i + 6); j += 1) {
          if (lines[j]) {
            illustrator = lines[j].trim();
            artistIndex = j;
            break;
          }
        }
        if (illustrator) break;
      }
    }

    let name = "";
    if (artistIndex >= 0) {
      for (let j = artistIndex + 1; j < Math.min(lines.length, artistIndex + 14); j += 1) {
        const c = lines[j].trim();
        if (!c) continue;
        if (/^HP\s*\d+/.test(c)) continue;
        if (/^카드 종류\s*:/.test(c)) continue;
        if (/^Image(?:Image)*/.test(c)) continue;
        if (/^\d{1,4}\//.test(c)) continue;
        if (["관련카드", "특성", "약점", "저항력", "후퇴"].includes(c)) continue;
        name = c;
        break;
      }
    }

    let printedNumber = "";
    let rarity = "";
    for (const line of lines) {
      const m = line.match(/(?<!\d)(\d{1,4}\/(?:\d{1,4}|[A-Za-z][A-Za-z0-9-]*))(?:\s+([A-Z][A-Z0-9]*))?/);
      if (m) {
        printedNumber = m[1];
        rarity = m[2] || "";
        break;
      }
    }

    return {
      internalCardNum: String(internalCardNum || "").replace(/\s+/g, "").trim(),
      illustrator,
      name,
      set: getSetCode(featureImage),
      rarity,
      printedNumber,
      cardNumber: rarity ? `${printedNumber} ${rarity}` : printedNumber,
      image: imageUrl(featureImage),
      source: `${BASE}/cards/detail/${sourceId}`,
    };
  }

  async function fetchText(url, options = {}, retries = 4) {
    let lastError;
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        const response = await fetch(url, {
          credentials: "include",
          cache: "no-store",
          ...options,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.text();
      } catch (error) {
        lastError = error;
        await sleep(250 * attempt);
      }
    }
    throw lastError;
  }

  async function searchArtist(artist) {
    const rows = [];
    let limit = 0;
    const seen = new Set();

    while (true) {
      if (seen.has(limit)) throw new Error(`Pagination loop: ${artist} / ${limit}`);
      seen.add(limit);

      const form = new FormData();
      form.append("action", "search_text_cards");
      form.append("search_text", artist);
      form.append("search_params", "all");
      form.append("limit", String(limit));

      const raw = await fetchText(`${BASE}/v2/ajax2_dev2`, {
        method: "POST",
        headers: { "X-Requested-With": "XMLHttpRequest" },
        body: form,
      });
      const start = raw.indexOf("{");
      if (start < 0) throw new Error(`No JSON: ${artist} / ${limit}`);
      const obj = JSON.parse(raw.slice(start));
      const count = Number(obj.count || 0);
      if (count <= 0) break;

      const result = Array.isArray(obj.result) ? obj.result : Object.values(obj.result || {});
      if (result.length !== count) {
        throw new Error(`Search row mismatch: ${artist} server=${count} parsed=${result.length}`);
      }

      for (const value of result) {
        rows.push({
          artist,
          internalCardNum: String(value.CardNum || "").trim(),
          featureImage: String(value.feature_image || ""),
          searchLimit: limit,
        });
      }

      const next = Number(obj.limit);
      if (next === limit) throw new Error(`Pagination did not advance: ${artist} / ${limit}`);
      limit = next;
    }
    return rows;
  }

  async function fetchDetail(candidate, cache) {
    const rawId = String(candidate.internalCardNum || "").trim();
    const id = rawId.replace(/\s+/g, "");
    const key = `${id}|${candidate.featureImage}`;
    if (cache[key]) return cache[key];

    const ids = [id];
    const mirror = id.match(/^(.*\d)m$/);
    if (mirror && !ids.includes(mirror[1])) ids.push(mirror[1]);

    let last = "";
    for (const detailId of ids) {
      try {
        const html = await fetchText(`${BASE}/cards/detail/${detailId}`);
        const parsed = parseDetail(html, id, candidate.featureImage, detailId);
        if (parsed.illustrator && parsed.name && parsed.printedNumber) {
          cache[key] = parsed;
          saveCache(cache);
          return parsed;
        }
        last = `parse incomplete: ${detailId}`;
      } catch (error) {
        last = String(error?.message || error);
      }
    }
    throw new Error(`Could not parse detail ${rawId}: ${last}`);
  }

  function dedupe(rows) {
    const seen = new Map();
    let duplicateCount = 0;
    for (const row of rows) {
      const key = [row.artist, row.set, row.cardNumber, row.name].map(norm).join("|");
      if (!seen.has(key)) {
        seen.set(key, row);
        continue;
      }
      duplicateCount += 1;
      const existing = seen.get(key);
      const existingMirror = /_m\./i.test(existing.image || "");
      const newMirror = /_m\./i.test(row.image || "");
      if (existingMirror && !newMirror) seen.set(key, row);
    }
    return { rows: [...seen.values()], duplicateCount };
  }

  function downloadJson(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "five-artists-korea.json";
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  console.clear();
  console.log("=== Digital Card Binder: 5 artist Korean collector ===");
  console.log("Target:", TARGETS.join(", "));
  console.log("중간 캐시는 이 브라우저의 localStorage에 저장됩니다.");

  const cache = loadCache();
  const allCandidates = [];
  const searchCounts = {};

  console.log("[1/3] 공식 한글판 검색 결과 수집...");
  for (const artist of TARGETS) {
    const rows = await searchArtist(artist);
    searchCounts[artist] = rows.length;
    allCandidates.push(...rows);
    console.log(`  ${artist}: ${rows.length} search rows`);
  }

  console.log(`[2/3] 상세페이지 작가명 확인... total=${allCandidates.length}`);
  const exact = [];
  const partial = [];
  const unprocessed = [];
  let processed = 0;

  for (const candidate of allCandidates) {
    processed += 1;
    try {
      const detail = await fetchDetail(candidate, cache);
      if (norm(detail.illustrator) === norm(candidate.artist)) {
        exact.push({
          artist: candidate.artist,
          internalCardNum: detail.internalCardNum,
          name: detail.name,
          set: detail.set,
          rarity: detail.rarity,
          printedNumber: detail.printedNumber,
          cardNumber: detail.cardNumber,
          image: detail.image,
          source: detail.source,
        });
      } else {
        partial.push({
          artist: candidate.artist,
          internalCardNum: detail.internalCardNum,
          actualIllustrator: detail.illustrator,
          name: detail.name,
          cardNumber: detail.cardNumber,
        });
      }
    } catch (error) {
      unprocessed.push({
        artist: candidate.artist,
        internalCardNum: candidate.internalCardNum,
        featureImage: candidate.featureImage,
        reason: String(error?.message || error),
      });
    }

    if (processed % 50 === 0 || processed === allCandidates.length) {
      console.log(`  verified ${processed} / ${allCandidates.length}`);
    }
  }

  console.log("[3/3] 중복 제거 및 결과 생성...");
  const artists = [];
  let duplicatesRemoved = 0;
  const finalCounts = {};

  for (const artist of TARGETS) {
    const { rows, duplicateCount } = dedupe(exact.filter((row) => norm(row.artist) === norm(artist)));
    duplicatesRemoved += duplicateCount;
    finalCounts[artist] = rows.length;
    artists.push({
      name: artist,
      cards: rows.map((row, index) => ({
        order: index + 1,
        name: row.name,
        owned: false,
        set: row.set,
        rarity: row.rarity,
        image: row.image,
        imageBw: "",
        source: row.source,
        cardNumber: row.cardNumber,
      })),
    });
  }

  const output = {
    generatedAt: new Date().toISOString(),
    source: "Pokemon Korea official card search",
    sourceUrl: `${BASE}/cards`,
    targets: TARGETS,
    searchCounts,
    searchTotal: allCandidates.length,
    exactMatches: exact.length,
    partialExcluded: partial.length,
    unprocessedCount: unprocessed.length,
    duplicatesRemoved,
    finalCounts,
    cardsToAdd: artists.reduce((sum, artist) => sum + artist.cards.length, 0),
    artists,
    partialSamples: partial.slice(0, 50),
    unprocessed,
  };

  console.table(finalCounts);
  console.log("Search total:", output.searchTotal);
  console.log("Exact:", output.exactMatches);
  console.log("Partial excluded:", output.partialExcluded);
  console.log("Unprocessed:", output.unprocessedCount);
  console.log("Duplicates removed:", output.duplicatesRemoved);
  console.log("Cards to add:", output.cardsToAdd);

  downloadJson(output);

  if (unprocessed.length) {
    console.warn("완료되었지만 미처리 카드가 있습니다. 다운로드된 JSON을 ChatGPT에 올려주세요. artists.json은 아직 변경되지 않습니다.");
  } else {
    console.log("SUCCESS: five-artists-korea.json 다운로드 완료. 이 파일을 ChatGPT에 올려주세요.");
  }
})();
