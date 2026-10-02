#!/usr/bin/env python3
"""Build compact visual fingerprints for the mobile card scanner.

The index is generated from the already archived Cloudflare card images.  It does
not change catalog identities or ownership data.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import urllib.request
from urllib.parse import quote, urlsplit, urlunsplit
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from PIL import Image, ImageOps, UnidentifiedImageError

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INDEX = ROOT / "data" / "pokemon-search-index.json"
DEFAULT_ARCHIVE = ROOT / "tmp" / "card-images" / "build"
DEFAULT_OUTPUT = ROOT / "data" / "card-visual-fingerprints.json"

OFFICIAL_HOST = "cards.image.pokemonkorea.co.kr"
MODERN_ROOTS = {"MEGA", "S", "SV"}
MODERN_BASE = "https://dcb-card-images-modern-2026.pages.dev"
LEGACY_BASE = "https://dcb-card-images-legacy-2026.pages.dev"
SUPPORTED_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif")
USER_AGENT = "DigitalCardBinder-VisualFingerprint/1.1"
BROWSER_USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/141.0 Safari/537.36"
)

FULL_REGION = (0.03, 0.03, 0.94, 0.94)
ART_REGION = (0.07, 0.08, 0.86, 0.43)


def fnv1a64(value: str) -> str:
    value_hash = 0xCBF29CE484222325
    for char in value:
        value_hash ^= ord(char)
        value_hash = (value_hash * 0x100000001B3) & 0xFFFFFFFFFFFFFFFF
    return f"{value_hash:016x}"


def clean_url(value: str, image_base: str) -> str:
    value = str(value or "").strip()
    if not value:
        return ""
    if value.startswith("@/"):
        return image_base.rstrip("/") + value[1:]
    return value.split("?", 1)[0]


def route_image(url: str) -> tuple[str, str] | None:
    from urllib.parse import urlsplit

    try:
        parsed = urlsplit(url)
    except ValueError:
        return None
    path = parsed.path
    lower = path.lower()
    if not any(lower.endswith(ext) for ext in SUPPORTED_EXTENSIONS):
        return None

    if parsed.hostname == OFFICIAL_HOST:
        parts = path.strip("/").split("/")
        if len(parts) < 4 or parts[0:2] != ["data", "wmimages"]:
            return None
        root = parts[2].upper()
        project = "modern" if root in MODERN_ROOTS else "legacy"
        base, _ext = os.path.splitext(path.lstrip("/"))
        return project, base + ".webp"

    canonical = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
    return "legacy", f"external/{parsed.hostname}/{fnv1a64(canonical)}.webp"


def public_url(project: str, relative_path: str) -> str:
    base = MODERN_BASE if project == "modern" else LEGACY_BASE
    return f"{base}/{relative_path}"


def normalized_crop(image: Image.Image, region: tuple[float, float, float, float]) -> Image.Image:
    x, y, width, height = region
    left = max(0, round(image.width * x))
    top = max(0, round(image.height * y))
    right = min(image.width, round(image.width * (x + width)))
    bottom = min(image.height, round(image.height * (y + height)))
    return image.crop((left, top, max(left + 1, right), max(top + 1, bottom)))


def dhash(image: Image.Image, region: tuple[float, float, float, float]) -> str:
    sample = normalized_crop(image, region).convert("L").resize((9, 8), Image.Resampling.LANCZOS)
    pixels = list(sample.getdata())
    value = 0
    bit = 0
    for row in range(8):
        offset = row * 9
        for col in range(8):
            if pixels[offset + col] > pixels[offset + col + 1]:
                value |= 1 << bit
            bit += 1
    return f"{value:016x}"


def ahash(image: Image.Image, region: tuple[float, float, float, float]) -> str:
    sample = normalized_crop(image, region).convert("L").resize((8, 8), Image.Resampling.LANCZOS)
    pixels = list(sample.getdata())
    average = sum(pixels) / len(pixels)
    value = 0
    for bit, pixel in enumerate(pixels):
        if pixel >= average:
            value |= 1 << bit
    return f"{value:016x}"


def color_grid(image: Image.Image, region: tuple[float, float, float, float]) -> str:
    sample = normalized_crop(image, region).convert("RGB").resize((4, 4), Image.Resampling.BOX)
    digits: list[str] = []
    for red, green, blue in sample.getdata():
        digits.extend((f"{round(red / 17):x}", f"{round(green / 17):x}", f"{round(blue / 17):x}"))
    return "".join(digits)


def fingerprint(payload: bytes) -> tuple[str, str, str, str]:
    with Image.open(io.BytesIO(payload)) as source:
        source.load()
        image = ImageOps.exif_transpose(source).convert("RGB")
        return (
            dhash(image, FULL_REGION),
            dhash(image, ART_REGION),
            ahash(image, ART_REGION),
            color_grid(image, ART_REGION),
        )


def normalized_request_url(value: str) -> str:
    parsed = urlsplit(str(value or "").strip())
    if not parsed.scheme or not parsed.netloc:
        return str(value or "").strip()
    path = quote(parsed.path, safe="/%:@!$&()*+,;=-._~")
    query = quote(parsed.query, safe="=&%:@!$()*+,;/?-._~")
    return urlunsplit((parsed.scheme, parsed.netloc, path, query, parsed.fragment))


def read_remote_payload(url: str, *, browser_headers: bool = False) -> bytes:
    normalized = normalized_request_url(url)
    parsed = urlsplit(normalized)
    headers = {
        "User-Agent": BROWSER_USER_AGENT if browser_headers else USER_AGENT,
        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    }
    if browser_headers and parsed.scheme and parsed.netloc:
        headers["Referer"] = f"{parsed.scheme}://{parsed.netloc}/"
    request = urllib.request.Request(normalized, headers=headers)
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read(8 * 1024 * 1024)


def payload_candidates(
    project: str,
    relative_path: str,
    source_url: str,
    archive_root: Path,
    remote_fallback: bool,
):
    local_path = archive_root / project / relative_path
    if local_path.is_file() and local_path.stat().st_size:
        yield "local-archive", local_path.read_bytes()

    if not remote_fallback:
        return

    errors: list[str] = []
    for label, url, browser_headers in (
        ("cloudflare-archive", public_url(project, relative_path), False),
        ("source", source_url, True),
    ):
        if not url:
            continue
        try:
            yield label, read_remote_payload(url, browser_headers=browser_headers)
        except (OSError, ValueError, urllib.error.URLError) as error:
            errors.append(f"{label}: {error}")

    if errors:
        raise OSError("; ".join(errors))


def collect_cards(index_path: Path) -> list[dict[str, str]]:
    payload = json.loads(index_path.read_text(encoding="utf-8"))
    image_base = str(payload.get("imageBase") or "").strip()
    cards: list[dict[str, str]] = []
    seen: set[str] = set()
    for group in payload.get("groups", []):
        if not isinstance(group, list) or len(group) < 5:
            continue
        set_code = str(group[0] or "").strip()
        for entry in group[4] or []:
            if not isinstance(entry, list) or len(entry) < 4:
                continue
            raw_code = str(entry[0] or "").strip()
            image = clean_url(entry[3] or (entry[8] if len(entry) > 8 else ""), image_base)
            key = f"{set_code.lower()}|{raw_code.lower()}"
            if not set_code or not raw_code or not image or key in seen:
                continue
            route = route_image(image)
            if not route:
                continue
            seen.add(key)
            project, relative_path = route
            cards.append({
                "setCode": set_code,
                "rawCode": raw_code,
                "project": project,
                "path": relative_path,
                "source": image,
            })
    return cards


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--index", type=Path, default=DEFAULT_INDEX)
    parser.add_argument("--archive-root", type=Path, default=DEFAULT_ARCHIVE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--workers", type=int, default=16)
    parser.add_argument("--no-remote-fallback", action="store_true")
    args = parser.parse_args()

    cards = collect_cards(args.index)
    results: list[list[str] | None] = [None] * len(cards)
    failures: list[dict[str, str]] = []

    def process(index_card: tuple[int, dict[str, str]]) -> tuple[int, list[str]]:
        index, card = index_card
        attempts: list[str] = []
        for label, payload in payload_candidates(
            card["project"],
            card["path"],
            card["source"],
            args.archive_root,
            not args.no_remote_fallback,
        ):
            try:
                full_d, art_d, art_a, colors = fingerprint(payload)
                return index, [
                    card["setCode"],
                    card["rawCode"],
                    full_d,
                    art_d,
                    art_a,
                    colors,
                ]
            except (OSError, ValueError, UnidentifiedImageError) as error:
                attempts.append(f"{label}: {error}")
        raise UnidentifiedImageError(
            "; ".join(attempts) or f"no usable image payload for {card['source']}"
        )

    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
        futures = {executor.submit(process, pair): pair for pair in enumerate(cards)}
        for completed, future in enumerate(as_completed(futures), start=1):
            index, card = futures[future]
            try:
                result_index, record = future.result()
                results[result_index] = record
            except (OSError, ValueError, UnidentifiedImageError, urllib.error.URLError) as error:
                failures.append({
                    "setCode": card["setCode"],
                    "rawCode": card["rawCode"],
                    "error": str(error)[:240],
                })
            if completed % 1000 == 0:
                print(f"fingerprinted {completed}/{len(cards)}", flush=True)

    entries = [record for record in results if record]
    output = {
        "version": 1,
        "algorithm": "dhash64+ahash64+art-color4x4",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "catalogCount": len(cards),
        "count": len(entries),
        "failed": len(failures),
        "sourceDigest": hashlib.sha256(args.index.read_bytes()).hexdigest()[:16],
        "entries": entries,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    failure_path = args.output.with_name("card-visual-fingerprints-failures.json")
    failure_path.write_text(
        json.dumps(failures, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({key: output[key] for key in ("catalogCount", "count", "failed")}, indent=2))
    return 0 if entries else 1


if __name__ == "__main__":
    raise SystemExit(main())
()*+,;/?-._~")
    return urlunsplit((parsed.scheme, parsed.netloc, path, query, parsed.fragment))


def read_remote_payload(url: str, *, browser_headers: bool = False) -> bytes:
    normalized = normalized_request_url(url)
    parsed = urlsplit(normalized)
    headers = {
        "User-Agent": BROWSER_USER_AGENT if browser_headers else USER_AGENT,
        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    }
    if browser_headers and parsed.scheme and parsed.netloc:
        headers["Referer"] = f"{parsed.scheme}://{parsed.netloc}/"
    request = urllib.request.Request(normalized, headers=headers)
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read(8 * 1024 * 1024)


def payload_candidates(
    project: str,
    relative_path: str,
    source_url: str,
    archive_root: Path,
    remote_fallback: bool,
):
    local_path = archive_root / project / relative_path
    if local_path.is_file() and local_path.stat().st_size:
        yield "local-archive", local_path.read_bytes()

    if not remote_fallback:
        return

    errors: list[str] = []
    for label, url, browser_headers in (
        ("cloudflare-archive", public_url(project, relative_path), False),
        ("source", source_url, True),
    ):
        if not url:
            continue
        try:
            yield label, read_remote_payload(url, browser_headers=browser_headers)
        except (OSError, ValueError, urllib.error.URLError) as error:
            errors.append(f"{label}: {error}")

    if errors:
        raise OSError("; ".join(errors))


def collect_cards(index_path: Path) -> list[dict[str, str]]:
    payload = json.loads(index_path.read_text(encoding="utf-8"))
    image_base = str(payload.get("imageBase") or "").strip()
    cards: list[dict[str, str]] = []
    seen: set[str] = set()
    for group in payload.get("groups", []):
        if not isinstance(group, list) or len(group) < 5:
            continue
        set_code = str(group[0] or "").strip()
        for entry in group[4] or []:
            if not isinstance(entry, list) or len(entry) < 4:
                continue
            raw_code = str(entry[0] or "").strip()
            image = clean_url(entry[3] or (entry[8] if len(entry) > 8 else ""), image_base)
            key = f"{set_code.lower()}|{raw_code.lower()}"
            if not set_code or not raw_code or not image or key in seen:
                continue
            route = route_image(image)
            if not route:
                continue
            seen.add(key)
            project, relative_path = route
            cards.append({
                "setCode": set_code,
                "rawCode": raw_code,
                "project": project,
                "path": relative_path,
            })
    return cards


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--index", type=Path, default=DEFAULT_INDEX)
    parser.add_argument("--archive-root", type=Path, default=DEFAULT_ARCHIVE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--workers", type=int, default=16)
    parser.add_argument("--no-remote-fallback", action="store_true")
    args = parser.parse_args()

    cards = collect_cards(args.index)
    results: list[list[str] | None] = [None] * len(cards)
    failures: list[dict[str, str]] = []

    def process(index_card: tuple[int, dict[str, str]]) -> tuple[int, list[str]]:
        index, card = index_card
        payload = read_payload(
            card["project"],
            card["path"],
            args.archive_root,
            not args.no_remote_fallback,
        )
        full_d, art_d, art_a, colors = fingerprint(payload)
        return index, [
            card["setCode"],
            card["rawCode"],
            full_d,
            art_d,
            art_a,
            colors,
        ]

    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
        futures = {executor.submit(process, pair): pair for pair in enumerate(cards)}
        for completed, future in enumerate(as_completed(futures), start=1):
            index, card = futures[future]
            try:
                result_index, record = future.result()
                results[result_index] = record
            except (OSError, ValueError, UnidentifiedImageError, urllib.error.URLError) as error:
                failures.append({
                    "setCode": card["setCode"],
                    "rawCode": card["rawCode"],
                    "error": str(error)[:240],
                })
            if completed % 1000 == 0:
                print(f"fingerprinted {completed}/{len(cards)}", flush=True)

    entries = [record for record in results if record]
    output = {
        "version": 1,
        "algorithm": "dhash64+ahash64+art-color4x4",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "catalogCount": len(cards),
        "count": len(entries),
        "failed": len(failures),
        "sourceDigest": hashlib.sha256(args.index.read_bytes()).hexdigest()[:16],
        "entries": entries,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    failure_path = args.output.with_name("card-visual-fingerprints-failures.json")
    failure_path.write_text(
        json.dumps(failures, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({key: output[key] for key in ("catalogCount", "count", "failed")}, indent=2))
    return 0 if entries else 1


if __name__ == "__main__":
    raise SystemExit(main())
