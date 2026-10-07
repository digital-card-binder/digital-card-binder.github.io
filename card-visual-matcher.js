"use strict";

(function () {
  const root = (window.DigitalCardBinder = window.DigitalCardBinder || {});
  const INDEX_URL = "./data/card-visual-fingerprints.json";
  let indexPromise = null;
  let preparedCatalog = null;
  let preparedIndex = null;

  const clean = (value) => String(value ?? "").trim();
  const keyFor = (setCode, rawCode) =>
    clean(setCode).toLowerCase() + "|" + clean(rawCode).toLowerCase();

  function cropCanvas(source, crop, width = 252, height = 352) {
    const sourceWidth = source.naturalWidth || source.width;
    const sourceHeight = source.naturalHeight || source.height;
    const sx = Math.max(0, Math.round(sourceWidth * crop.x));
    const sy = Math.max(0, Math.round(sourceHeight * crop.y));
    const sw = Math.max(1, Math.round(sourceWidth * crop.width));
    const sh = Math.max(1, Math.round(sourceHeight * crop.height));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("이미지 비교를 시작하지 못했습니다.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, sx, sy, sw, sh, 0, 0, width, height);
    return canvas;
  }

  function regionPixels(canvas, region, width, height) {
    const work = document.createElement("canvas");
    work.width = width;
    work.height = height;
    const context = work.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("이미지 특징을 읽지 못했습니다.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      canvas,
      Math.round(canvas.width * region.x),
      Math.round(canvas.height * region.y),
      Math.max(1, Math.round(canvas.width * region.width)),
      Math.max(1, Math.round(canvas.height * region.height)),
      0,
      0,
      width,
      height,
    );
    return context.getImageData(0, 0, width, height).data;
  }

  const luminance = (r, g, b) => r * 0.299 + g * 0.587 + b * 0.114;

  function differenceHash(canvas, region) {
    const pixels = regionPixels(canvas, region, 9, 8);
    let value = 0n;
    let bit = 0n;
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        const leftIndex = (row * 9 + col) * 4;
        const rightIndex = (row * 9 + col + 1) * 4;
        const left = luminance(pixels[leftIndex], pixels[leftIndex + 1], pixels[leftIndex + 2]);
        const right = luminance(pixels[rightIndex], pixels[rightIndex + 1], pixels[rightIndex + 2]);
        if (left > right) value |= 1n << bit;
        bit += 1n;
      }
    }
    return value;
  }

  function averageHash(canvas, region) {
    const pixels = regionPixels(canvas, region, 8, 8);
    const values = [];
    let total = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const value = luminance(pixels[index], pixels[index + 1], pixels[index + 2]);
      values.push(value);
      total += value;
    }
    const average = total / Math.max(1, values.length);
    let hash = 0n;
    values.forEach((value, index) => {
      if (value >= average) hash |= 1n << BigInt(index);
    });
    return hash;
  }

  function colorGrid(canvas, region) {
    const pixels = regionPixels(canvas, region, 4, 4);
    let output = "";
    for (let index = 0; index < pixels.length; index += 4) {
      output += Math.round(pixels[index] / 17).toString(16);
      output += Math.round(pixels[index + 1] / 17).toString(16);
      output += Math.round(pixels[index + 2] / 17).toString(16);
    }
    return output;
  }

  function signature(canvas) {
    const fullRegion = { x: 0.03, y: 0.03, width: 0.94, height: 0.94 };
    const artRegion = { x: 0.07, y: 0.08, width: 0.86, height: 0.43 };
    return {
      fullD: differenceHash(canvas, fullRegion),
      artD: differenceHash(canvas, artRegion),
      artA: averageHash(canvas, artRegion),
      colors: colorGrid(canvas, artRegion),
    };
  }

  function hammingDistance(left, right) {
    let value = left ^ right;
    let count = 0;
    while (value) {
      value &= value - 1n;
      count += 1;
    }
    return count;
  }

  function colorDistance(left, right) {
    if (!left || !right || left.length !== right.length) return 1;
    let total = 0;
    for (let index = 0; index < left.length; index += 1) {
      const a = parseInt(left[index], 16);
      const b = parseInt(right[index], 16);
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      total += Math.abs(a - b);
    }
    return total / (left.length * 15);
  }

  function distanceBreakdown(query, reference) {
    const fullDistance = hammingDistance(query.fullD, reference.fullD);
    const artDistance = hammingDistance(query.artD, reference.artD);
    const averageDistance = hammingDistance(query.artA, reference.artA);
    const normalizedColorDistance = colorDistance(query.colors, reference.colors);
    return {
      fullDistance,
      artDistance,
      averageDistance,
      colorDistance: normalizedColorDistance,
      total:
        fullDistance * 0.22 +
        artDistance * 0.36 +
        averageDistance * 0.27 +
        normalizedColorDistance * 64 * 0.15,
    };
  }

  function distance(query, reference) {
    return distanceBreakdown(query, reference).total;
  }

  async function rawIndex() {
    if (!indexPromise) {
      indexPromise = fetch(INDEX_URL + "?v=2", { cache: "no-store" })
        .then((response) => {
          if (!response.ok) throw new Error("카드 시각 인덱스를 불러오지 못했습니다.");
          return response.json();
        })
        .then((payload) => Array.isArray(payload?.entries) ? payload.entries : []);
    }
    return indexPromise;
  }

  async function prepare(catalog) {
    if (preparedCatalog === catalog && preparedIndex?.length) return preparedIndex;
    const cardMap = new Map(
      (catalog || [])
        .filter((card) => clean(card.setCode) && clean(card.rawCode))
        .map((card) => [keyFor(card.setCode, card.rawCode), card]),
    );
    const entries = await rawIndex();
    const parsed = [];
    for (const entry of entries) {
      if (!Array.isArray(entry) || entry.length < 6) continue;
      const [setCode, rawCode, fullD, artD, artA, colors] = entry;
      const card = cardMap.get(keyFor(setCode, rawCode));
      if (!card) continue;
      try {
        parsed.push({
          card,
          fullD: BigInt("0x" + fullD),
          artD: BigInt("0x" + artD),
          artA: BigInt("0x" + artA),
          colors: clean(colors),
        });
      } catch {
        // Generated malformed fingerprints are ignored.
      }
    }
    if (!parsed.length) throw new Error("비교 가능한 카드 시각 인덱스가 없습니다.");
    preparedCatalog = catalog;
    preparedIndex = parsed;
    return parsed;
  }

  function insetCrop(crop, inset, offsetX = 0, offsetY = 0) {
    const baseWidth = Math.max(0.01, Number(crop?.width) || 0.01);
    const baseHeight = Math.max(0.01, Number(crop?.height) || 0.01);
    const dx = baseWidth * inset;
    const dy = baseHeight * inset;
    const width = Math.max(0.01, baseWidth - dx * 2);
    const height = Math.max(0.01, baseHeight - dy * 2);
    const shiftedX = (Number(crop?.x) || 0) + dx + baseWidth * offsetX;
    const shiftedY = (Number(crop?.y) || 0) + dy + baseHeight * offsetY;
    return {
      x: Math.max(0, Math.min(1 - width, shiftedX)),
      y: Math.max(0, Math.min(1 - height, shiftedY)),
      width,
      height,
    };
  }

  function photoCropVariants(crop) {
    const variants = [
      [0, 0, 0],
      [0.018, 0, 0],
      [0.04, 0, 0],
      [0.018, -0.018, 0],
      [0.018, 0.018, 0],
      [0.018, 0, -0.018],
      [0.018, 0, 0.018],
      [0.035, -0.012, -0.012],
      [0.035, 0.012, 0.012],
    ].map(([inset, offsetX, offsetY]) => insetCrop(crop, inset, offsetX, offsetY));

    const seen = new Set();
    return variants.filter((item) => {
      const key = [item.x, item.y, item.width, item.height]
        .map((value) => Number(value).toFixed(5))
        .join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async function rankImageCrop(source, crop, catalog, limit = 3) {
    const index = await prepare(catalog);
    const signatures = photoCropVariants(crop).map((variant) =>
      signature(cropCanvas(source, variant))
    );
    const ranked = [];
    for (let position = 0; position < index.length; position += 1) {
      const reference = index[position];
      let best = Number.POSITIVE_INFINITY;
      let bestDetails = null;
      for (const query of signatures) {
        const details = distanceBreakdown(query, reference);
        if (details.total < best) {
          best = details.total;
          bestDetails = details;
        }
      }
      ranked.push({
        card: reference.card,
        distance: best,
        fullDistance: bestDetails?.fullDistance ?? 64,
        artDistance: bestDetails?.artDistance ?? 64,
        averageDistance: bestDetails?.averageDistance ?? 64,
        colorDistance: bestDetails?.colorDistance ?? 1,
      });
      if (position && position % 4000 === 0) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    }
    ranked.sort((left, right) => left.distance - right.distance);
    return ranked.slice(0, Math.max(1, limit));
  }

  function confident(matches) {
    if (!matches?.length) return null;
    const top = matches[0];
    const second = matches[1];
    const gap = second ? second.distance - top.distance : Number.POSITIVE_INFINITY;
    if (
      (top.distance <= 7.5 && gap >= 4.25) ||
      (top.distance <= 9.0 && gap >= 6.0)
    ) {
      return { card: top.card, distance: top.distance, gap };
    }
    return null;
  }

  // Binder-page photos contain glare, sleeve texture and mild crop error that
  // clean catalog images do not. Keep the normal scanner strict, but allow a
  // slightly wider page-scan window only when the whole-card structure is also
  // close. Expanded-art background cells can resemble a card's illustration,
  // so fullDistance is required before automatic replacement.
  function confidentScan(matches) {
    if (!matches?.length) return null;
    const top = matches[0];
    const second = matches[1];
    const gap = second ? second.distance - top.distance : Number.POSITIVE_INFINITY;
    const fullDistance = Number(top.fullDistance);
    if (!Number.isFinite(fullDistance)) return confident(matches);
    if (
      (top.distance <= 10.75 && gap >= 3.25 && fullDistance <= 20) ||
      (top.distance <= 12.75 && gap >= 5.0 && fullDistance <= 18)
    ) {
      return { card: top.card, distance: top.distance, gap, fullDistance };
    }
    return null;
  }

  function reviewableScan(matches) {
    if (!matches?.length) return false;
    const top = matches[0];
    const fullDistance = Number(top.fullDistance);
    return (
      top.distance <= 22 &&
      (!Number.isFinite(fullDistance) || fullDistance <= 28)
    );
  }

  root.visualMatcher = Object.freeze({
    rankImageCrop,
    confident,
    confidentScan,
    reviewableScan,
    photoCropVariants,
  });
})();
