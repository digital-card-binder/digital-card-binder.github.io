import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

    if (reusableCache) {
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
