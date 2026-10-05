"use strict";

(function () {
  const root = (window.DigitalCardBinder = window.DigitalCardBinder || {});

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function analysisCanvas(image, maxDimension = 760) {
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true, alpha: false });
    if (!context) throw new Error("사진 스캔 분석을 시작하지 못했습니다.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { canvas, context, scale };
  }

  function grayscaleAndEdges(context, width, height) {
    const pixels = context.getImageData(0, 0, width, height).data;
    const gray = new Float32Array(width * height);
    for (let index = 0, offset = 0; index < gray.length; index += 1, offset += 4) {
      gray[index] =
        pixels[offset] * 0.299 +
        pixels[offset + 1] * 0.587 +
        pixels[offset + 2] * 0.114;
    }

    const edge = new Float32Array(width * height);
    const samples = [];
    for (let y = 1; y < height - 1; y += 1) {
      const row = y * width;
      for (let x = 1; x < width - 1; x += 1) {
        const i = row + x;
        const gx =
          -gray[i - width - 1] + gray[i - width + 1] +
          -2 * gray[i - 1] + 2 * gray[i + 1] +
          -gray[i + width - 1] + gray[i + width + 1];
        const gy =
          -gray[i - width - 1] - 2 * gray[i - width] - gray[i - width + 1] +
          gray[i + width - 1] + 2 * gray[i + width] + gray[i + width + 1];
        const magnitude = Math.min(1020, Math.hypot(gx, gy));
        edge[i] = magnitude;
        if (x % 5 === 0 && y % 5 === 0) samples.push(magnitude);
      }
    }

    samples.sort((a, b) => a - b);
    const percentile = samples[Math.floor(samples.length * 0.82)] || 90;
    const threshold = Math.max(55, percentile);
    const binary = new Uint8Array(width * height);
    for (let i = 0; i < edge.length; i += 1) {
      binary[i] = edge[i] >= threshold ? 1 : 0;
    }
    return { binary, threshold };
  }

  function lineHit(binary, width, height, x, y, vertical) {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 1 || yi < 1 || xi >= width - 1 || yi >= height - 1) return 0;
    for (let offset = -2; offset <= 2; offset += 1) {
      const sx = vertical ? xi + offset : xi;
      const sy = vertical ? yi : yi + offset;
      if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
      if (binary[sy * width + sx]) return 1;
    }
    return 0;
  }

  function searchVertical(binary, width, height, side) {
    const minB = width * (side === "left" ? 0.025 : 0.68);
    const maxB = width * (side === "left" ? 0.32 : 0.975);
    const centerY = height / 2;
    let best = null;
    const stepB = Math.max(2, Math.round(width / 220));
    for (let slope = -0.42; slope <= 0.4201; slope += 0.035) {
      for (let b = minB; b <= maxB; b += stepB) {
        let hits = 0;
        let count = 0;
        for (let y = 6; y < height - 6; y += 3) {
          const x = b + slope * (y - centerY);
          hits += lineHit(binary, width, height, x, y, true);
          count += 1;
        }
        const score = count ? hits / count : 0;
        const progress = side === "left"
          ? (b - minB) / Math.max(1, maxB - minB)
          : (maxB - b) / Math.max(1, maxB - minB);
        const rank = score * (1 - 0.5 * clamp(progress, 0, 1));
        if (!best || rank > best.rank) best = { b, slope, score, rank };
      }
    }
    return best;
  }

  function searchHorizontal(binary, width, height, side) {
    const minB = height * (side === "top" ? 0.025 : 0.68);
    const maxB = height * (side === "top" ? 0.32 : 0.975);
    const centerX = width / 2;
    let best = null;
    const stepB = Math.max(2, Math.round(height / 220));
    for (let slope = -0.42; slope <= 0.4201; slope += 0.035) {
      for (let b = minB; b <= maxB; b += stepB) {
        let hits = 0;
        let count = 0;
        for (let x = 6; x < width - 6; x += 3) {
          const y = b + slope * (x - centerX);
          hits += lineHit(binary, width, height, x, y, false);
          count += 1;
        }
        const score = count ? hits / count : 0;
        const progress = side === "top"
          ? (b - minB) / Math.max(1, maxB - minB)
          : (maxB - b) / Math.max(1, maxB - minB);
        const rank = score * (1 - 0.5 * clamp(progress, 0, 1));
        if (!best || rank > best.rank) best = { b, slope, score, rank };
      }
    }
    return best;
  }

  function intersect(vertical, horizontal, width, height) {
    const cv = vertical.b - vertical.slope * height / 2;
    const ch = horizontal.b - horizontal.slope * width / 2;
    const denominator = 1 - vertical.slope * horizontal.slope;
    if (Math.abs(denominator) < 0.08) return null;
    const x = (cv + vertical.slope * ch) / denominator;
    const y = horizontal.slope * x + ch;
    return { x, y };
  }

  function polygonArea(points) {
    let sum = 0;
    for (let i = 0; i < points.length; i += 1) {
      const next = points[(i + 1) % points.length];
      sum += points[i].x * next.y - next.x * points[i].y;
    }
    return Math.abs(sum) / 2;
  }

  function detectPage(image) {
    const { canvas, context, scale } = analysisCanvas(image);
    const width = canvas.width;
    const height = canvas.height;
    const { binary } = grayscaleAndEdges(context, width, height);

    const left = searchVertical(binary, width, height, "left");
    const right = searchVertical(binary, width, height, "right");
    const top = searchHorizontal(binary, width, height, "top");
    const bottom = searchHorizontal(binary, width, height, "bottom");
    if (!left || !right || !top || !bottom) return null;

    const points = [
      intersect(left, top, width, height),
      intersect(right, top, width, height),
      intersect(right, bottom, width, height),
      intersect(left, bottom, width, height),
    ];
    if (points.some((point) => !point)) return null;

    const marginX = width * 0.08;
    const marginY = height * 0.08;
    if (points.some((point) =>
      point.x < -marginX ||
      point.x > width + marginX ||
      point.y < -marginY ||
      point.y > height + marginY
    )) return null;

    const areaRatio = polygonArea(points) / (width * height);
    const minScore = Math.min(left.score, right.score, top.score, bottom.score);
    const averageScore = (left.score + right.score + top.score + bottom.score) / 4;

    const topWidth = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
    const bottomWidth = Math.hypot(points[2].x - points[3].x, points[2].y - points[3].y);
    const leftHeight = Math.hypot(points[3].x - points[0].x, points[3].y - points[0].y);
    const rightHeight = Math.hypot(points[2].x - points[1].x, points[2].y - points[1].y);
    const validShape =
      Math.min(topWidth, bottomWidth) > width * 0.38 &&
      Math.min(leftHeight, rightHeight) > height * 0.38;

    if (!validShape || areaRatio < 0.28 || areaRatio > 1.06 || minScore < 0.09 || averageScore < 0.14) {
      return null;
    }

    const originalScale = 1 / scale;
    return {
      corners: points.map((point) => ({
        x: clamp(point.x * originalScale, 0, (image.naturalWidth || image.width) - 1),
        y: clamp(point.y * originalScale, 0, (image.naturalHeight || image.height) - 1),
      })),
      confidence: clamp((averageScore - 0.1) / 0.38, 0, 1),
      areaRatio,
    };
  }

  function unitSquareToQuad([p0, p1, p2, p3]) {
    const dx1 = p1.x - p2.x;
    const dx2 = p3.x - p2.x;
    const dx3 = p0.x - p1.x + p2.x - p3.x;
    const dy1 = p1.y - p2.y;
    const dy2 = p3.y - p2.y;
    const dy3 = p0.y - p1.y + p2.y - p3.y;
    let g = 0;
    let h = 0;
    const determinant = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(dx3) > 1e-6 || Math.abs(dy3) > 1e-6) {
      if (Math.abs(determinant) < 1e-6) return null;
      g = (dx3 * dy2 - dx2 * dy3) / determinant;
      h = (dx1 * dy3 - dx3 * dy1) / determinant;
    }
    const a = p1.x - p0.x + g * p1.x;
    const b = p3.x - p0.x + h * p3.x;
    const c = p0.x;
    const d = p1.y - p0.y + g * p1.y;
    const e = p3.y - p0.y + h * p3.y;
    const f = p0.y;
    return (u, v) => {
      const denominator = g * u + h * v + 1;
      return {
        x: (a * u + b * v + c) / denominator,
        y: (d * u + e * v + f) / denominator,
      };
    };
  }

  // Corner order stays TL, TR, BR, BL throughout the editor and warp.
  function validCorners(points, width, height) {
    if (!Array.isArray(points) || points.length !== 4) return false;
    if (points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y) ||
      p.x < 0 || p.y < 0 || p.x > width - 1 || p.y > height - 1)) return false;
    for (let i = 0; i < 4; i += 1) {
      const a = points[i], b = points[(i + 1) % 4], c = points[(i + 2) % 4];
      if ((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) <= 1) return false;
      if (Math.hypot(b.x - a.x, b.y - a.y) < 8) return false;
    }
    return polygonArea(points) >= width * height * 0.01;
  }

  function originalCorners(image, inset = 0) {
    const w = (image.naturalWidth || image.width) - 1;
    const h = (image.naturalHeight || image.height) - 1;
    return [{ x: w * inset, y: h * inset }, { x: w * (1 - inset), y: h * inset },
      { x: w * (1 - inset), y: h * (1 - inset) }, { x: w * inset, y: h * (1 - inset) }];
  }

  // Look for repeated dark pocket gutters in page coordinates, rather than
  // guessing the number of pockets from a photograph's aspect ratio.
  function fitAxisBounds(dividers, count) {
    if (!Array.isArray(dividers) || dividers.length !== count - 1 || count < 3) {
      return { start: 0, end: 1, confidence: 0 };
    }
    const points = dividers.map((item, index) => ({
      k: index + 1,
      p: Number(item?.position),
    })).filter((item) => Number.isFinite(item.p));
    if (points.length !== count - 1) return { start: 0, end: 1, confidence: 0 };

    const meanK = points.reduce((sum, item) => sum + item.k, 0) / points.length;
    const meanP = points.reduce((sum, item) => sum + item.p, 0) / points.length;
    const denominator = points.reduce((sum, item) => sum + (item.k - meanK) ** 2, 0);
    if (denominator <= 0) return { start: 0, end: 1, confidence: 0 };

    const pitch = points.reduce(
      (sum, item) => sum + (item.k - meanK) * (item.p - meanP),
      0,
    ) / denominator;
    const start = meanP - pitch * meanK;
    const end = start + pitch * count;
    const expectedPitch = 1 / count;
    const residual = points.reduce(
      (sum, item) => sum + Math.abs(item.p - (start + pitch * item.k)),
      0,
    ) / points.length;

    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      pitch < expectedPitch * 0.68 ||
      pitch > expectedPitch * 1.18 ||
      residual > expectedPitch * 0.08 ||
      start < -0.08 ||
      start > 0.18 ||
      end < 0.82 ||
      end > 1.08
    ) {
      return { start: 0, end: 1, confidence: 0 };
    }

    return {
      start: clamp(start, 0, 1),
      end: clamp(end, 0, 1),
      confidence: clamp(1 - residual / Math.max(0.001, expectedPitch * 0.08), 0, 1),
    };
  }

  function detectPocketGrid(image, corners) {
    if (!validCorners(corners, image.width, image.height)) return null;
    const source = analysisCanvas(image);
    const map = unitSquareToQuad(corners.map((p) => ({ x: p.x * source.scale, y: p.y * source.scale })));
    if (!map) return null;
    const pixels = source.context.getImageData(0, 0, source.canvas.width, source.canvas.height).data;
    const samples = 240;

    function axisCount(vertical) {
      const profile = Array.from({ length: samples }, (_, i) => {
        const values = [];
        for (let j = 0; j < 80; j++) {
          const across = 0.06 + 0.88 * j / 79;
          const p = map(vertical ? i / (samples - 1) : across, vertical ? across : i / (samples - 1));
          const x = clamp(Math.round(p.x), 0, source.canvas.width - 1);
          const y = clamp(Math.round(p.y), 0, source.canvas.height - 1);
          const offset = (y * source.canvas.width + x) * 4;
          values.push(pixels[offset] * 0.299 + pixels[offset + 1] * 0.587 + pixels[offset + 2] * 0.114);
        }
        values.sort((a, b) => a - b);
        return values[56];
      });

      function contrastAt(i) {
        if (i < 20 || i >= samples - 20 || profile[i] > 180) return 0;
        const neighbors = [-18, -14, -10, 10, 14, 18]
          .map((d) => profile[i + d])
          .sort((a, b) => a - b);
        return Math.max(0, ((neighbors[2] + neighbors[3]) / 2 - profile[i]) / 255);
      }

      function dividerNear(position, count) {
        const searchRadius = Math.min(0.075, 0.22 / count);
        const from = clamp(Math.round((position - searchRadius) * (samples - 1)), 20, samples - 21);
        const to = clamp(Math.round((position + searchRadius) * (samples - 1)), 20, samples - 21);
        let bestIndex = from;
        let bestContrast = 0;
        for (let i = from; i <= to; i += 1) {
          const value = contrastAt(i);
          if (value > bestContrast) {
            bestContrast = value;
            bestIndex = i;
          }
        }

        const threshold = Math.max(0.035, bestContrast * 0.42);
        const limit = Math.max(2, Math.round(samples / count * 0.08));
        let left = bestIndex;
        let right = bestIndex;
        while (left > from && bestIndex - left < limit && contrastAt(left - 1) >= threshold) left -= 1;
        while (right < to && right - bestIndex < limit && contrastAt(right + 1) >= threshold) right += 1;

        return {
          position: bestIndex / (samples - 1),
          halfWidth: clamp((right - left + 1) / (samples - 1) / 2, 0.002, 0.025),
          contrast: bestContrast,
        };
      }

      const candidates = [2, 3, 4, 5].map((count) => {
        const dividers = Array.from({ length: count - 1 }, (_, k) =>
          dividerNear((k + 1) / count, count)
        );
        const contrasts = dividers.map((divider) => divider.contrast);
        const min = Math.min(...contrasts);
        const average = contrasts.reduce((sum, value) => sum + value, 0) / contrasts.length;

        let unexplained = 0;
        for (let i = 24; i < samples - 24; i += 1) {
          const position = i / (samples - 1);
          const nearDivider = dividers.some(
            (divider) => Math.abs(position - divider.position) < Math.min(0.07, 0.2 / count),
          );
          if (!nearDivider) unexplained = Math.max(unexplained, contrastAt(i));
        }
        return {
          count,
          min,
          average,
          dividers,
          score: min * 0.4 + average * 0.6 - unexplained * 0.3,
        };
      }).sort((a, b) => b.score - a.score);

      const [best, second] = candidates;
      const gap = best.score - second.score;
      if (best.min < 0.085 || best.average < 0.17 || gap < 0.03) return null;
      return {
        count: best.count,
        confidence: clamp(Math.min(best.average / 0.34, gap / 0.075), 0, 1),
        dividers: best.dividers,
        bounds: fitAxisBounds(best.dividers, best.count),
      };
    }

    const cols = axisCount(true);
    const rows = axisCount(false);
    if (!cols || !rows) return null;
    return {
      cols: cols.count,
      rows: rows.count,
      confidence: Math.min(cols.confidence, rows.confidence),
      xDividers: cols.dividers,
      yDividers: rows.dividers,
      xBounds: cols.bounds,
      yBounds: rows.bounds,
    };
  }

  function refineCornersToPocket(corners, layout, width, height) {
    if (!layout || !validCorners(corners, width, height)) return corners;
    const x0 = Number(layout.xBounds?.start);
    const x1 = Number(layout.xBounds?.end);
    const y0 = Number(layout.yBounds?.start);
    const y1 = Number(layout.yBounds?.end);
    if (![x0, x1, y0, y1].every(Number.isFinite)) return corners;
    const spanX = x1 - x0;
    const spanY = y1 - y0;
    if (spanX < 0.72 || spanY < 0.72 || spanX > 1 || spanY > 1) return corners;

    const trim = x0 + (1 - x1) + y0 + (1 - y1);
    const trustworthy = Number(layout.confidence) >= 0.5 &&
      Number(layout.xBounds?.confidence) >= 0.42 &&
      Number(layout.yBounds?.confidence) >= 0.42;
    if (!trustworthy || trim < 0.025 || trim > 0.34) return corners;

    const map = unitSquareToQuad(corners);
    if (!map) return corners;
    const refined = [
      map(x0, y0),
      map(x1, y0),
      map(x1, y1),
      map(x0, y1),
    ];
    return validCorners(refined, width, height) ? refined : corners;
  }

  function buildSlotCrops(grid, layout, canvasWidth, canvasHeight, cardAspect = 63 / 88) {
    const cols = Math.max(1, Number(grid?.cols) || 3);
    const rows = Math.max(1, Number(grid?.rows) || 4);
    const safeLayout = layout && layout.cols === cols && layout.rows === rows ? layout : null;

    function axisCells(count, dividers, defaultPadRatio = 0.012) {
      const validDividers = Array.isArray(dividers) && dividers.length === count - 1
        ? dividers
        : Array.from({ length: count - 1 }, (_, index) => ({
            position: (index + 1) / count,
            halfWidth: 0,
          }));

      return Array.from({ length: count }, (_, index) => {
        const nominalStart = index === 0 ? 0 : Number(validDividers[index - 1]?.position);
        const nominalEnd = index === count - 1 ? 1 : Number(validDividers[index]?.position);
        const leftGap = index === 0 ? 0 : Number(validDividers[index - 1]?.halfWidth) || 0;
        const rightGap = index === count - 1 ? 0 : Number(validDividers[index]?.halfWidth) || 0;
        const start = clamp(nominalStart + leftGap * 0.9, 0, 1);
        const end = clamp(nominalEnd - rightGap * 0.9, 0, 1);
        const span = Math.max(0.0001, end - start);
        const pad = span * defaultPadRatio;
        return {
          start: clamp(start + pad, 0, 1),
          end: clamp(end - pad, 0, 1),
        };
      });
    }

    const xCells = axisCells(cols, safeLayout?.xDividers);
    const yCells = axisCells(rows, safeLayout?.yDividers);
    const result = [];

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        let x0 = xCells[col].start;
        let x1 = xCells[col].end;
        let y0 = yCells[row].start;
        let y1 = yCells[row].end;

        const pixelWidth = Math.max(1, (x1 - x0) * canvasWidth);
        const pixelHeight = Math.max(1, (y1 - y0) * canvasHeight);
        const currentAspect = pixelWidth / pixelHeight;

        if (currentAspect > cardAspect) {
          const targetWidth = (y1 - y0) * canvasHeight * cardAspect / canvasWidth;
          const center = (x0 + x1) / 2;
          x0 = center - targetWidth / 2;
          x1 = center + targetWidth / 2;
        } else if (currentAspect < cardAspect) {
          const targetHeight = (x1 - x0) * canvasWidth / cardAspect / canvasHeight;
          const center = (y0 + y1) / 2;
          y0 = center - targetHeight / 2;
          y1 = center + targetHeight / 2;
        }

        x0 = clamp(x0, 0, 1);
        x1 = clamp(x1, 0, 1);
        y0 = clamp(y0, 0, 1);
        y1 = clamp(y1, 0, 1);
        result.push({
          x: Number(x0.toFixed(6)),
          y: Number(y0.toFixed(6)),
          width: Number(Math.max(0.0001, x1 - x0).toFixed(6)),
          height: Number(Math.max(0.0001, y1 - y0).toFixed(6)),
        });
      }
    }
    return result;
  }

  // Browser decoders apply EXIF exactly once; drawing removes orientation metadata.
  async function decodePhoto(file) {
    if (!file || (!String(file.type).startsWith("image/") &&
      !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name || ""))) {
      throw new Error("이미지 파일을 선택해 주세요.");
    }
    let image, url;
    try {
      if (typeof createImageBitmap === "function") {
        try { image = await createImageBitmap(file, { imageOrientation: "from-image" }); } catch { /* Use native image decoder. */ }
      }
      if (!image) {
        url = URL.createObjectURL(file);
        image = new Image();
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = () => reject(new Error("사진을 읽지 못했습니다. JPG, PNG 또는 WEBP 사진으로 다시 시도해 주세요."));
          image.src = url;
        });
      }
      return analysisCanvas(image, 4200).canvas;
    } finally {
      image?.close?.();
      if (url) URL.revokeObjectURL(url);
    }
  }

  // Inverse homography with bilinear sampling avoids triangle seams and samples
  // only inside the selected quadrilateral. Yield between bands on mobile.
  async function warpPerspective(image, corners, targetAspect, maxDimension = 2800) {
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!validCorners(corners, width, height) || !Number.isFinite(targetAspect) || targetAspect <= 0) {
      throw new Error("네 모서리가 겹치지 않도록 페이지 외곽을 맞춰 주세요.");
    }
    const sourceMap = unitSquareToQuad(corners);
    if (!sourceMap) throw new Error("바인더 페이지 원근을 계산하지 못했습니다.");
    const source = analysisCanvas(image, Math.max(width, height));
    const pixels = source.context.getImageData(0, 0, width, height).data;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(2, Math.round(targetAspect >= 1 ? maxDimension : maxDimension * targetAspect));
    canvas.height = Math.max(2, Math.round(targetAspect >= 1 ? maxDimension / targetAspect : maxDimension));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("바인더 스캔 이미지를 만들지 못했습니다.");
    const output = context.createImageData(canvas.width, canvas.height);
    const data = output.data;
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const p = sourceMap(x / (canvas.width - 1), y / (canvas.height - 1));
        const sx = clamp(p.x, 0, width - 1), sy = clamp(p.y, 0, height - 1);
        const x0 = Math.floor(sx), y0 = Math.floor(sy);
        const x1 = Math.min(x0 + 1, width - 1), y1 = Math.min(y0 + 1, height - 1);
        const dx = sx - x0, dy = sy - y0;
        const offsets = [(y0 * width + x0) * 4, (y0 * width + x1) * 4,
          (y1 * width + x0) * 4, (y1 * width + x1) * 4];
        const i = (y * canvas.width + x) * 4;
        for (let channel = 0; channel < 3; channel += 1) {
          data[i + channel] = (pixels[offsets[0] + channel] * (1 - dx) + pixels[offsets[1] + channel] * dx) * (1 - dy) +
            (pixels[offsets[2] + channel] * (1 - dx) + pixels[offsets[3] + channel] * dx) * dy;
        }
        data[i + 3] = 255;
      }
      if (y % 64 === 63) await new Promise((resolve) => setTimeout(resolve, 0));
    }
    context.putImageData(output, 0, 0);
    return canvas;
  }

  // No automatic fallback crop: every import must pass through the 4-point editor.
  async function edit(file, options = {}) {
    const dialog = document.querySelector("#studio-scan-dialog");
    if (!dialog || dialog.open) throw new Error("스캔 화면을 준비하지 못했습니다. 다시 시도해 주세요.");
    const image = await decodePhoto(file);
    const viewport = dialog.querySelector(".studio-scan-viewport");
    const stage = dialog.querySelector(".studio-scan-stage");
    const canvas = dialog.querySelector("canvas");
    const outline = dialog.querySelector("polygon");
    const gridLines = dialog.querySelector("[data-scan-grid-lines]");
    const gridSelect = dialog.querySelector("[data-scan-grid]");
    const gridNote = dialog.querySelector("[data-scan-grid-note]");
    const svg = dialog.querySelector("svg");
    const handles = [...dialog.querySelectorAll("[data-scan-corner]")];
    const status = dialog.querySelector("[data-scan-status]");
    const zoom = dialog.querySelector("[data-scan-zoom]");
    const apply = dialog.querySelector('[data-scan-action="apply"]');
    const controls = [...dialog.querySelectorAll("button, input, select")];
    let points = originalCorners(image, 0.025), confidence = 0, busy = false, drag = null;
    let manualGrid = false;
    let pocketLayout = null;
    gridSelect.value = `${options.cols || 3}x${options.rows || 4}`;
    function scanGrid() {
      const [cols, rows] = gridSelect.value.split("x").map(Number);
      return { cols, rows };
    }
    function checkGrid() {
      let detected = null;
      try { detected = detectPocketGrid(image, points); } catch { /* Manual selection stays available. */ }

      if (!manualGrid) {
        const value = detected && `${detected.cols}x${detected.rows}`;
        if (value && [...gridSelect.options].some((option) => option.value === value)) {
          gridSelect.value = value;
        } else {
          detected = null;
        }
      }

      const { cols, rows } = scanGrid();
      pocketLayout = detected?.cols === cols && detected?.rows === rows ? detected : null;
      const cropText = pocketLayout?.confidence >= 0.4
        ? "포켓 구분선과 카드 영역까지 자동으로 맞춥니다"
        : "분할선이 실제 포켓 사이에 맞는지 확인하세요";
      gridNote.textContent =
        `${pocketLayout ? "포켓 구분선 자동 감지" : "사진 속 배열 확인"} · ${cols} × ${rows}, ${cols * rows}칸 · ${cropText}.`;
      drawPoints();
    }
    let resolveEdit;
    const done = new Promise((resolve) => { resolveEdit = resolve; });
    const listeners = new AbortController();
    const signal = listeners.signal;
    let previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    zoom.value = "1";

    function paint() {
      canvas.width = image.width;
      canvas.height = image.height;
      canvas.getContext("2d").drawImage(image, 0, 0);
      svg.setAttribute("viewBox", `0 0 ${image.width} ${image.height}`);
      layout();
    }
    function layout() {
      const available = Math.max(120, viewport.clientWidth - 64);
      const fit = Math.min(available / image.width, Math.max(160, viewport.clientHeight - 64) / image.height);
      stage.style.width = `${image.width * fit * Number(zoom.value)}px`;
      stage.style.height = `${image.height * fit * Number(zoom.value)}px`;
      drawPoints();
    }
    function drawPoints() {
      outline.setAttribute("points", points.map((p) => `${p.x},${p.y}`).join(" "));
      const map = validCorners(points, image.width, image.height) && unitSquareToQuad(points);
      const { cols, rows } = scanGrid();
      const segments = [];
      if (map) {
        for (let col = 1; col < cols; col++) segments.push([map(col / cols, 0), map(col / cols, 1)]);
        for (let row = 1; row < rows; row++) segments.push([map(0, row / rows), map(1, row / rows)]);
      }
      gridLines.setAttribute("d", segments.map(([a, b]) => `M${a.x},${a.y}L${b.x},${b.y}`).join(" "));
      handles.forEach((handle, i) => {
        handle.style.left = `${points[i].x / image.width * 100}%`;
        handle.style.top = `${points[i].y / image.height * 100}%`;
      });
      apply.disabled = busy || !validCorners(points, image.width, image.height);
    }
    function setBusy(value) {
      busy = value;
      controls.forEach((control) => { control.disabled = value; });
      dialog.setAttribute("aria-busy", String(value));
      drawPoints();
    }
    async function detect() {
      setBusy(true);
      status.textContent = "페이지와 카드 포켓 영역을 찾는 중입니다…";
      await new Promise((resolve) => setTimeout(resolve, 0));
      let detected = null;
      try { detected = detectPage(image); } catch { /* Safe initial corners below. */ }
      if (detected?.confidence >= 0.4 && validCorners(detected.corners, image.width, image.height)) {
        points = detected.corners;
        confidence = detected.confidence;
        let initialLayout = null;
        try { initialLayout = detectPocketGrid(image, points); } catch { /* Keep page corners. */ }
        const refined = refineCornersToPocket(points, initialLayout, image.width, image.height);
        const refinedEnough = refined.some((point, index) =>
          Math.hypot(point.x - points[index].x, point.y - points[index].y) > 2
        );
        if (refinedEnough) {
          points = refined;
          status.textContent = "포켓 바깥 여백까지 자동 정리했습니다. 네 점과 분할선만 확인해 주세요.";
        } else {
          status.textContent = "페이지 영역을 찾았습니다. 네 점과 포켓 분할선만 확인해 주세요.";
        }
      } else {
        points = originalCorners(image, 0.025);
        confidence = 0;
        status.textContent = "자동 감지가 불확실합니다. 네 점을 카드 포켓 영역의 바깥 모서리에 맞춰 주세요.";
      }
      checkGrid();
      setBusy(false);
    }
    function finish(result) {
      listeners.abort();
      observer.disconnect();
      document.body.style.overflow = previousOverflow;
      dialog.close();
      canvas.width = canvas.height = 1;
      image.width = image.height = 1;
      resolveEdit(result);
    }
    handles.forEach((handle, i) => {
      handle.addEventListener("pointerdown", (event) => {
        if (busy) return;
        event.preventDefault();
        const rect = stage.getBoundingClientRect();
        drag = { id: event.pointerId, i, x: event.clientX, y: event.clientY,
          point: { ...points[i] }, scaleX: image.width / rect.width, scaleY: image.height / rect.height };
        handle.setPointerCapture(event.pointerId);
      }, { signal });
      handle.addEventListener("pointermove", (event) => {
        if (!drag || drag.id !== event.pointerId || drag.i !== i) return;
        points[i] = { x: clamp(drag.point.x + (event.clientX - drag.x) * drag.scaleX, 0, image.width - 1),
          y: clamp(drag.point.y + (event.clientY - drag.y) * drag.scaleY, 0, image.height - 1) };
        confidence = 0;
        pocketLayout = null;
        status.textContent = validCorners(points, image.width, image.height)
          ? "선 안쪽만 스캔됩니다. 확대해서 모서리를 더 정확하게 맞출 수 있습니다."
          : "모서리가 겹쳤습니다. 네 점을 페이지 외곽 순서에 맞춰 주세요.";
        drawPoints();
      }, { signal });
      for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
        handle.addEventListener(type, () => { if (drag) { drag = null; checkGrid(); } }, { signal });
      }
      handle.addEventListener("keydown", (event) => {
        const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        if (!directions[event.key] || busy) return;
        event.preventDefault();
        const [dx, dy] = directions[event.key], step = event.shiftKey ? 10 : 1;
        points[i].x = clamp(points[i].x + dx * step, 0, image.width - 1);
        points[i].y = clamp(points[i].y + dy * step, 0, image.height - 1);
        confidence = 0;
        pocketLayout = null;
        drawPoints();
      }, { signal });
    });
    zoom.addEventListener("input", layout, { signal });
    gridSelect.addEventListener("change", () => { manualGrid = true; checkGrid(); }, { signal });
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); if (!busy) finish(null); }, { signal });
    dialog.addEventListener("click", async (event) => {
      const action = event.target.closest("[data-scan-action]")?.dataset.scanAction;
      if (!action || busy) return;
      if (action === "cancel") finish(null);
      if (action === "detect") await detect();
      if (action === "reset") {
        points = originalCorners(image);
        confidence = 0;
        pocketLayout = null;
        status.textContent = "사진 전체 영역으로 초기화했습니다. 네 점을 카드 포켓 영역에 맞춰 주세요.";
        checkGrid();
      }
      if (action === "rotate") {
        const rotated = document.createElement("canvas");
        rotated.width = image.height;
        rotated.height = image.width;
        const ctx = rotated.getContext("2d");
        ctx.translate(rotated.width, 0);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(image, 0, 0);
        image.width = rotated.width;
        image.height = rotated.height;
        image.getContext("2d").drawImage(rotated, 0, 0);
        points = originalCorners(image, 0.025);
        pocketLayout = null;
        zoom.value = "1";
        paint();
        await detect();
      }
      if (action === "apply") {
        setBusy(true);
        status.textContent = "원근을 보정하고 슬롯을 준비하는 중입니다…";
        try {
          const grid = scanGrid();
          const cardAspect = (options.cardWidth || 63) / (options.cardHeight || 88);
          const aspect = (grid.cols * (options.cardWidth || 63)) / (grid.rows * (options.cardHeight || 88));
          const corrected = await warpPerspective(image, points, aspect);
          const latestLayout = pocketLayout?.cols === grid.cols && pocketLayout?.rows === grid.rows
            ? pocketLayout
            : null;
          const slotCrops = buildSlotCrops(
            grid,
            latestLayout,
            corrected.width,
            corrected.height,
            cardAspect,
          );
          finish({
            canvas: corrected,
            mode: "perspective",
            confidence, grid,
            slotCrops,
            cropMode: latestLayout ? "pocket-adaptive" : "card-safe",
          });
        } catch (error) {
          status.textContent = error.message || "스캔하지 못했습니다. 모서리를 다시 확인해 주세요.";
          setBusy(false);
        }
      }
    }, { signal });
    const observer = new ResizeObserver(layout);
    observer.observe(viewport);
    dialog.showModal();
    paint();
    await detect();
    return done;
  }

  root.photoScanner = Object.freeze({
    edit,
    decodePhoto,
    detectPage,
    detectPocketGrid,
    warpPerspective,
    validCorners,
    originalCorners,
    unitSquareToQuad,
    refineCornersToPocket,
    buildSlotCrops,
  });
})();
