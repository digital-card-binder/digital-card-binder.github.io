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
        x: clamp(point.x * originalScale, 0, image.naturalWidth || image.width),
        y: clamp(point.y * originalScale, 0, image.naturalHeight || image.height),
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

  function affineForTriangle(source, destination) {
    const [s0, s1, s2] = source;
    const [d0, d1, d2] = destination;
    const denominator =
      s0.x * (s1.y - s2.y) +
      s1.x * (s2.y - s0.y) +
      s2.x * (s0.y - s1.y);
    if (Math.abs(denominator) < 1e-6) return null;

    const a =
      (d0.x * (s1.y - s2.y) +
       d1.x * (s2.y - s0.y) +
       d2.x * (s0.y - s1.y)) / denominator;
    const c =
      (d0.x * (s2.x - s1.x) +
       d1.x * (s0.x - s2.x) +
       d2.x * (s1.x - s0.x)) / denominator;
    const e =
      (d0.x * (s1.x * s2.y - s2.x * s1.y) +
       d1.x * (s2.x * s0.y - s0.x * s2.y) +
       d2.x * (s0.x * s1.y - s1.x * s0.y)) / denominator;

    const b =
      (d0.y * (s1.y - s2.y) +
       d1.y * (s2.y - s0.y) +
       d2.y * (s0.y - s1.y)) / denominator;
    const d =
      (d0.y * (s2.x - s1.x) +
       d1.y * (s0.x - s2.x) +
       d2.y * (s1.x - s0.x)) / denominator;
    const f =
      (d0.y * (s1.x * s2.y - s2.x * s1.y) +
       d1.y * (s2.x * s0.y - s0.x * s2.y) +
       d2.y * (s0.x * s1.y - s1.x * s0.y)) / denominator;

    return { a, b, c, d, e, f };
  }

  function drawTriangle(context, image, source, destination) {
    const transform = affineForTriangle(source, destination);
    if (!transform) return;
    context.save();
    context.beginPath();
    context.moveTo(destination[0].x, destination[0].y);
    context.lineTo(destination[1].x, destination[1].y);
    context.lineTo(destination[2].x, destination[2].y);
    context.closePath();
    context.clip();
    context.setTransform(
      transform.a,
      transform.b,
      transform.c,
      transform.d,
      transform.e,
      transform.f,
    );
    context.drawImage(image, 0, 0);
    context.restore();
  }

  function warpPerspective(image, corners, targetAspect) {
    const sourceMap = unitSquareToQuad(corners);
    if (!sourceMap) throw new Error("바인더 페이지 원근을 계산하지 못했습니다.");

    const longSide = 2800;
    let outWidth;
    let outHeight;
    if (targetAspect >= 1) {
      outWidth = longSide;
      outHeight = Math.max(1, Math.round(longSide / targetAspect));
    } else {
      outHeight = longSide;
      outWidth = Math.max(1, Math.round(longSide * targetAspect));
    }

    const canvas = document.createElement("canvas");
    canvas.width = outWidth;
    canvas.height = outHeight;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("바인더 스캔 이미지를 만들지 못했습니다.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, outWidth, outHeight);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    const cols = targetAspect < 0.8 ? 14 : 18;
    const rows = targetAspect < 0.8 ? 22 : 16;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const u0 = col / cols;
        const u1 = (col + 1) / cols;
        const v0 = row / rows;
        const v1 = (row + 1) / rows;
        const s00 = sourceMap(u0, v0);
        const s10 = sourceMap(u1, v0);
        const s11 = sourceMap(u1, v1);
        const s01 = sourceMap(u0, v1);
        const d00 = { x: u0 * outWidth, y: v0 * outHeight };
        const d10 = { x: u1 * outWidth, y: v0 * outHeight };
        const d11 = { x: u1 * outWidth, y: v1 * outHeight };
        const d01 = { x: u0 * outWidth, y: v1 * outHeight };
        drawTriangle(context, image, [s00, s10, s11], [d00, d10, d11]);
        drawTriangle(context, image, [s00, s11, s01], [d00, d11, d01]);
      }
    }
    return canvas;
  }

  function centerCrop(image, targetAspect) {
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const sourceAspect = sourceWidth / sourceHeight;
    let sx = 0;
    let sy = 0;
    let sw = sourceWidth;
    let sh = sourceHeight;
    if (sourceAspect > targetAspect) {
      sw = sourceHeight * targetAspect;
      sx = (sourceWidth - sw) / 2;
    } else {
      sh = sourceWidth / targetAspect;
      sy = (sourceHeight - sh) / 2;
    }
    const longSide = 2800;
    const width = targetAspect >= 1 ? longSide : Math.max(1, Math.round(longSide * targetAspect));
    const height = targetAspect >= 1 ? Math.max(1, Math.round(longSide / targetAspect)) : longSide;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("사진 비율 보정을 처리하지 못했습니다.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
    return canvas;
  }

  async function scan(image, options = {}) {
    const cols = Math.max(1, Number(options.cols) || 3);
    const rows = Math.max(1, Number(options.rows) || 4);
    const cardWidth = Math.max(1, Number(options.cardWidth) || 63);
    const cardHeight = Math.max(1, Number(options.cardHeight) || 88);
    const targetAspect = (cols * cardWidth) / (rows * cardHeight);

    let detection = null;
    try {
      detection = detectPage(image);
    } catch (error) {
      console.warn("바인더 페이지 자동 경계 인식 실패", error);
    }

    if (detection?.corners) {
      return {
        canvas: warpPerspective(image, detection.corners, targetAspect),
        mode: "perspective",
        confidence: detection.confidence,
        corners: detection.corners,
      };
    }

    return {
      canvas: centerCrop(image, targetAspect),
      mode: "crop",
      confidence: 0,
      corners: null,
    };
  }

  root.photoScanner = Object.freeze({
    scan,
    detectPage,
  });
})();
