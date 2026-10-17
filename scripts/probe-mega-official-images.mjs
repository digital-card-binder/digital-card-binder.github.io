import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidencePath = path.join(root, "data", "audits", "mega-gap-evidence.json");
const outputPath = path.join(root, "data", "audits", "mega-official-image-probe.json");
const OFFICIAL_HOST = "cards.image.pokemonkorea.co.kr";

const setCase = Object.freeze({
  "m1s": "M1S",
  "m1l": "M1L",
  "m2": "M2",
  "m2a": "M2a",
  "m3": "M3",
  "m4": "M4",
  "m5": "M5",
  "m6": "M6",
  "m6a": "M6a",
  "mc": "MC",
  "mbd": "MBD",
  "mbg": "MBG",
  "ma": "MA",
  "m-p": "M-P",
});

const clean = (value) => String(value ?? "").trim();
const norm = (value) => clean(value).toLowerCase();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function officialImage(value) {
  try {
    return new URL(clean(value)).hostname === OFFICIAL_HOST;
  } catch {
    return false;
  }
}

function candidateUrl(actualSetCode, printedNumber) {
  const printed = clean(printedNumber);
  if (!/^\d+$/.test(printed)) return "";
  const folder = setCase[norm(actualSetCode)];
  if (!folder) return "";
  const token = printed.padStart(3, "0");
  return `https://${OFFICIAL_HOST}/data/wmimages/MEGA/${folder}/${folder}_${token}.png`;
}

function deferredOfficialIndex(actualSetCode, printedNumber) {
  const setCode = norm(actualSetCode);
  const printed = norm(printedNumber);

  // 30th CELEBRATION's Korean high-number cards are known Korean releases,
  // but Pokemon Korea has not fully exposed/indexed these slots on the
  // official card search/image host yet. Do not repeatedly probe them on
  // routine pushes; retain them as official-index-pending instead.
  if (setCode === "m6a") {
    if (/^\d+$/.test(printed)) {
      const number = Number(printed);
      if (number >= 104 && number <= 165) return true;
    }
    if (["b/rgb", "g/rgb", "r/rgb"].includes(printed)) return true;
  }

  return false;
}

async function readPrevious() {
  try {
    return JSON.parse(await readFile(outputPath, "utf8"));
  } catch {
    return { slots: {} };
  }
}

async function requestImage(url, method, extraHeaders = {}) {
  try {
    const response = await fetch(url, {
      method,
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; DigitalCardBinderDataAudit/1.0; +https://digital-card-binder.github.io/)",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.6",
        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        ...extraHeaders,
      },
    });
    const contentType = response.headers.get("content-type") || "";
    const exists =
      (response.status === 200 || response.status === 206) &&
      /^image\//i.test(contentType);
    try {
      await response.body?.cancel();
    } catch {}
    return {
      checked: true,
      exists,
      status: response.status,
      contentType,
      method,
    };
  } catch (error) {
    return {
      checked: false,
      exists: false,
      status: 0,
      method,
      error: String(error?.message || error),
    };
  }
}

async function probeExists(url) {
  const head = await requestImage(url, "HEAD");
  if (head.exists || head.status === 404) return head;

  const ranged = await requestImage(url, "GET", { Range: "bytes=0-0" });
  if (ranged.exists || ranged.status === 404) return ranged;

  // Pokemon Korea's image server can reject Range requests with 415 even
  // when the image exists. A plain GET lets us validate response headers,
  // then the body is immediately cancelled to keep traffic minimal.
  return requestImage(url, "GET");
}

const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
const previous = await readPrevious();
const previousSlots = previous?.slots && typeof previous.slots === "object"
  ? previous.slots
  : {};

const verifiedImportedM6a = new Map();
const originalImport = JSON.parse(
  await readFile(path.join(root, "data", "audits", "m6a-korean-image-sync.json"), "utf8"),
);
if (originalImport.setCode !== "M6a" || originalImport.selfHosted !== true
    || originalImport.imported?.length !== 32) {
  throw new Error("M6a Korean official 104-135 asset baseline changed");
}
for (const card of originalImport.imported) {
  const n = card.number, code = String(n).padStart(3, "0");
  const original = `https://${OFFICIAL_HOST}/data/wmimages/MEGA/M6a/M6a_${code}.png`;
  const local = `./assets/cards/mega/m6a/M6a_${code}.webp`;
  if (!Number.isInteger(n) || n < 104 || n > 135 || card.source !== original
      || card.localPath !== local || !/^[a-f0-9]{64}$/.test(card.sha256)
      || !/^[a-f0-9]{64}$/.test(card.sourceSha256)
      || card.sourceDimensions?.length !== 2
      || verifiedImportedM6a.has(String(n))) {
    throw new Error("M6a self-hosted Korean official source mismatch " + n);
  }
  const binary = await readFile(path.join(root, local));
  const digest = createHash("sha256").update(binary).digest("hex");
  if (digest !== card.sha256 || binary.length < 1000) {
    throw new Error("M6a local WebP hash mismatch " + n);
  }
  verifiedImportedM6a.set(String(n), { source: original, local, sha256: digest });
}
if (verifiedImportedM6a.size !== 32) throw new Error("Missing M6a 104-135 image provenance");

const verifiedAdditionalM6a = new Map();
const additionalImport = JSON.parse(
  await readFile(path.join(root, "data", "audits", "m6a-136-165-korean-image-sync.json"), "utf8"),
);
if (additionalImport.setCode !== "M6a" || additionalImport.selfHosted !== true
    || additionalImport.imported?.length !== 29
    || additionalImport.stillHeld?.length !== 1
    || additionalImport.stillHeld[0].number !== 157) {
  throw new Error("M6a official Korean 136-165 additional import baseline changed");
}
for (const card of additionalImport.imported) {
  const n = card.number, number = String(n).padStart(3, "0");
  const original = `https://${OFFICIAL_HOST}/data/wmimages/MEGA/M6a/M6a_${number}.png`;
  const local = `./assets/cards/mega/m6a/M6a_${number}.webp`;
  if (!Number.isInteger(n) || n < 136 || n > 165 || n === 157
      || card.source !== original || card.localPath !== local
      || card.printedKoreanTextVisible !== true
      || !/^[a-f0-9]{64}$/.test(card.sha256)
      || !/^[a-f0-9]{64}$/.test(card.sourceSha256)
      || verifiedAdditionalM6a.has(String(n))) {
    throw new Error("M6a second official image provenance mismatch " + n);
  }
  const binary = await readFile(path.join(root, local));
  const digest = createHash("sha256").update(binary).digest("hex");
  if (digest !== card.sha256 || binary.length < 1000) {
    throw new Error("M6a 136-165 local WebP hash mismatch " + n);
  }
  verifiedAdditionalM6a.set(String(n), { source: original, local, sha256: digest });
}
if (verifiedAdditionalM6a.size !== 29) throw new Error("Missing verified M6a 136-165 assets");


const slots = {};
const sets = [];
let networkChecks = 0;

for (const set of evidence.sets || []) {
  let verifiedMissingSlotCount = 0;
  let unresolvedMissingSlotCount = 0;
  let officialLocalImageCount = 0;
  let officialProbeImageCount = 0;

  for (const missing of set.missing || []) {
    const key = [
      norm(set.code),
      norm(missing.actualSetCode),
      norm(missing.printedNumber),
    ].join("::");
    const localOfficial = (missing.localRecords || []).find((record) =>
      officialImage(record.image),
    );

    if (localOfficial) {
      slots[key] = {
        setCode: set.code,
        actualSetCode: missing.actualSetCode,
        printedNumber: missing.printedNumber,
        verified: true,
        evidence: "official-image-in-master",
        url: localOfficial.image,
        httpStatus: null,
      };
      verifiedMissingSlotCount += 1;
      officialLocalImageCount += 1;
      continue;
    }

    const archived = norm(missing.actualSetCode) === "m6a"
      ? verifiedImportedM6a.get(String(missing.printedNumber))
      : null;
    if (archived) {
      slots[key] = {
        setCode: set.code,
        actualSetCode: missing.actualSetCode,
        printedNumber: missing.printedNumber,
        verified: true,
        evidence: "official-pokemonkorea-Korean-image-owned-sha256",
        url: archived.source,
        localPath: archived.local,
        sha256: archived.sha256,
        httpStatus: 200,
        validation: "Previously downloaded from Pokemon Korea; local binary SHA-256 reverified",
      };
      verifiedMissingSlotCount += 1;
      officialLocalImageCount += 1;
      continue;
    }

    const additionalArchived = norm(missing.actualSetCode) === "m6a"
      ? verifiedAdditionalM6a.get(String(missing.printedNumber))
      : null;
    if (additionalArchived) {
      slots[key] = {
        setCode: set.code, actualSetCode: missing.actualSetCode,
        printedNumber: missing.printedNumber, verified: true,
        evidence: "official-pokemonkorea-Korean-reprint-own-sha256",
        url: additionalArchived.source,
        localPath: additionalArchived.local,
        sha256: additionalArchived.sha256,
        httpStatus: 200,
        validation: "Official Korean art, visual printed-language review, revalidated own SHA-256",
      };
      verifiedMissingSlotCount += 1;
      officialLocalImageCount += 1;
      continue;
    }
    if (deferredOfficialIndex(
      missing.actualSetCode,
      missing.printedNumber,
    )) {
      slots[key] = {
        setCode: set.code,
        actualSetCode: missing.actualSetCode,
        printedNumber: missing.printedNumber,
        verified: false,
        evidence: "official-index-pending",
        url: "",
        httpStatus: null,
      };
      unresolvedMissingSlotCount += 1;
      continue;
    }

    const candidate = candidateUrl(
      missing.actualSetCode,
      missing.printedNumber,
    );
    if (!candidate) {
      slots[key] = {
        setCode: set.code,
        actualSetCode: missing.actualSetCode,
        printedNumber: missing.printedNumber,
        verified: false,
        evidence: "no-deterministic-official-image-path",
        url: "",
        httpStatus: null,
      };
      unresolvedMissingSlotCount += 1;
      continue;
    }

    const cached = previousSlots[key];
    const automationBlocked =
      cached &&
      cached.url === candidate &&
      Number(cached.httpStatus) === 415;
    const reusableCache =
      cached &&
      cached.url === candidate &&
      typeof cached.verified === "boolean" &&
      Number.isInteger(cached.httpStatus) &&
      (
        cached.verified === true ||
        cached.evidence === "official-image-range-get" ||
        cached.evidence === "official-image-get" ||
        cached.evidence === "official-image-head" ||
        cached.httpStatus === 404
      );

    if (automationBlocked) {
      slots[key] = {
        ...cached,
        verified: false,
        evidence: "official-probe-blocked",
      };
    } else if (reusableCache) {
      slots[key] = cached;
    } else {
      const result = await probeExists(candidate);
      networkChecks += 1;
      slots[key] = {
        setCode: set.code,
        actualSetCode: missing.actualSetCode,
        printedNumber: missing.printedNumber,
        verified: Boolean(result.exists),
        evidence: result.exists
          ? result.method === "HEAD"
            ? "official-image-head"
            : result.method === "GET"
              ? "official-image-get"
              : "official-image-probe"
          : result.checked
            ? "official-image-not-found"
            : "official-image-check-error",
        url: candidate,
        httpStatus: result.status,
        ...(result.contentType ? { contentType: result.contentType } : {}),
        ...(result.method ? { method: result.method } : {}),
        ...(result.error ? { error: result.error } : {}),
      };
      await sleep(80);
    }

    if (slots[key].verified) {
      verifiedMissingSlotCount += 1;
      officialProbeImageCount += 1;
    } else {
      unresolvedMissingSlotCount += 1;
    }
  }

  sets.push({
    code: set.code,
    title: set.title,
    expectedSlotCount: set.expectedSlotCount,
    officialSearchSlotCount: set.officialParsedSlotCount,
    missingExpectedSlotCount: set.missingExpectedSlotCount,
    unexpectedOfficialSlotCount: set.unexpectedOfficialSlotCount,
    verifiedMissingSlotCount,
    unresolvedMissingSlotCount,
    officialLocalImageCount,
    officialProbeImageCount,
    allExpectedSlotsHaveFirstPartyEvidence:
      set.unexpectedOfficialSlotCount === 0 &&
      verifiedMissingSlotCount === set.missingExpectedSlotCount,
  });
}

const output = {
  schemaVersion: 1,
  sourcePolicy:
    "Pokemon Korea product-search results first; Pokemon Korea official image host is accepted as first-party fallback evidence for catalog membership only.",
  networkChecks,
  summary: {
    setCount: sets.length,
    fullyFirstPartyBackedSetCount: sets.filter(
      (set) => set.allExpectedSlotsHaveFirstPartyEvidence,
    ).length,
    partialSetCount: sets.filter(
      (set) => !set.allExpectedSlotsHaveFirstPartyEvidence,
    ).length,
    missingExpectedSlotCount: sets.reduce(
      (sum, set) => sum + set.missingExpectedSlotCount,
      0,
    ),
    verifiedMissingSlotCount: sets.reduce(
      (sum, set) => sum + set.verifiedMissingSlotCount,
      0,
    ),
    unresolvedMissingSlotCount: sets.reduce(
      (sum, set) => sum + set.unresolvedMissingSlotCount,
      0,
    ),
  },
  sets,
  slots,
};

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(
  `MEGA official-image evidence: ${output.summary.fullyFirstPartyBackedSetCount}/${output.summary.setCount} sets fully backed; ${output.summary.verifiedMissingSlotCount}/${output.summary.missingExpectedSlotCount} search gaps verified; ${networkChecks} new network checks.`,
);
