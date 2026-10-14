#!/usr/bin/env python3
"""Safely import verified Korean M6a 104-135 images into this site's own assets.

Run from the repository root. No card identities, master DB records, or owner
data are changed. Failed/unavailable source images remain untouched.
"""
from __future__ import annotations

import hashlib
import io
import json
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, UnidentifiedImageError

ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "assets/cards/mega/m6a"
OVERRIDES_PATH = ROOT / "data/series-image-overrides.json"
AUDIT_PATH = ROOT / "data/audits/m6a-korean-image-sync.json"
SOURCE_ROOT = "https://cards.image.pokemonkorea.co.kr/data/wmimages/MEGA/M6a"
FIRST_NUMBER, LAST_NUMBER = 104, 135
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; DigitalCardBinder/1.0; Korean card archive)",
    "Accept": "image/avif,image/webp,image/apng,image/png,image/jpeg,image/*;q=0.8",
    "Referer": "https://pokemoncard.co.kr/",
}


def fetch_image(number: int) -> tuple[bytes, str, int, int] | None:
    stem = f"M6a_{number:03d}"
    for extension in ("png", "jpg"):
        url = f"{SOURCE_ROOT}/{stem}.{extension}"
        for attempt in range(3):
            try:
                request = urllib.request.Request(url, headers=HEADERS)
                with urllib.request.urlopen(request, timeout=35) as response:
                    if response.status != 200:
                        raise ValueError(f"HTTP {response.status}")
                    mime = response.headers.get_content_type()
                    if mime not in ("image/png", "image/jpeg", "image/webp", "application/octet-stream"):
                        raise ValueError(f"nonimage MIME {mime}")
                    original = response.read(12 * 1024 * 1024 + 1)
                    if len(original) > 12 * 1024 * 1024:
                        raise ValueError("source image unexpectedly large")
                with Image.open(io.BytesIO(original)) as preview:
                    preview.verify()
                with Image.open(io.BytesIO(original)) as preview:
                    w, h = preview.size
                if w < 200 or h < 260 or h / w < 1.1 or h / w > 1.9:
                    raise ValueError(f"unexpected card dimensions {w}x{h}")
                return original, url, w, h
            except urllib.error.HTTPError as exc:
                if exc.code in (404, 410):
                    break
                if attempt == 2:
                    print(f"WARN {stem}.{extension}: HTTP {exc.code}", flush=True)
            except (urllib.error.URLError, ValueError, UnidentifiedImageError, OSError) as exc:
                if attempt == 2:
                    print(f"WARN {stem}.{extension}: {exc}", flush=True)
            time.sleep(1 + attempt)
    return None


def main() -> None:
    overrides = json.loads(OVERRIDES_PATH.read_text(encoding="utf-8"))
    target = overrides.setdefault("sets", {}).setdefault("m6a", {})
    prior = {}
    if AUDIT_PATH.is_file():
        prior = json.loads(AUDIT_PATH.read_text(encoding="utf-8"))
    existing = {str(item["number"]): item for item in prior.get("imported", []) if "number" in item}
    imported = []
    missing = []
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    for number in range(FIRST_NUMBER, LAST_NUMBER + 1):
        stem = f"M6a_{number:03d}"
        destination = ASSET_DIR / f"{stem}.webp"
        relative = f"./assets/cards/mega/m6a/{stem}.webp"
        key = f"m6a_{number:03d}/103"
        if destination.exists():
            with Image.open(destination) as photo:
                photo.verify()
            target[key] = relative
            item = dict(existing.get(str(number), {"number": number}))
            item["localPath"] = relative
            item["sha256"] = hashlib.sha256(destination.read_bytes()).hexdigest()
            imported.append(item)
            continue
        result = fetch_image(number)
        if result is None:
            print(f"PENDING {stem}: official image unavailable; existing mapping preserved", flush=True)
            missing.append(number)
            continue
        raw, source, width, height = result
        with Image.open(io.BytesIO(raw)) as image:
            rgb = image.convert("RGB")
            rgb.thumbnail((460, 680), Image.Resampling.LANCZOS)
            out = io.BytesIO()
            rgb.save(out, "WEBP", quality=85, method=5)
            content = out.getvalue()
        destination.write_bytes(content)
        target[key] = relative
        imported.append({
            "number": number,
            "localPath": relative,
            "source": source,
            "sourceDimensions": [width, height],
            "sourceSha256": hashlib.sha256(raw).hexdigest(),
            "sha256": hashlib.sha256(content).hexdigest(),
        })
        print(f"IMPORTED {stem} {len(content)} bytes -> {relative}", flush=True)
        time.sleep(0.8)
    OVERRIDES_PATH.write_text(json.dumps(overrides, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    audit = {
        "schemaVersion": 1,
        "setCode": "M6a",
        "source": SOURCE_ROOT,
        "range": [FIRST_NUMBER, LAST_NUMBER],
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "selfHosted": True,
        "imported": sorted(imported, key=lambda item: item["number"]),
        "pendingNumbers": missing,
        "policy": "Only downloaded and image-validated Korean official sources are mapped to local assets.",
    }
    AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
    AUDIT_PATH.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Import complete: {len(imported)} self-hosted, {len(missing)} pending", flush=True)
    if missing:
        raise SystemExit(f"Not all Korean images are locally available: {missing}")


if __name__ == "__main__":
    main()
