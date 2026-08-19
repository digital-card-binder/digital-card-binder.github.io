#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""Add five illustrator collections from the Pokemon Korea card database.

This is intentionally a plain, static Python script: no PowerShell, no eval,
no self-modifying code, and no shell=True subprocesses.
"""

from __future__ import annotations

import base64
import html as html_module
import http.cookiejar
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any
from urllib import request

REPO = "digital-card-binder/digital-card-binder.github.io"
BRANCH = "agent/add-five-popular-artists-ko-20260819"
BASE = "https://pokemoncard.co.kr"
TARGETS = [
    "Mitsuhiro Arita",
    "Kagemaru Himeno",
    "Kouki Saitou",
    "Naoki Saito",
    "kawayoo",
]

WORKDIR = Path(tempfile.gettempdir()) / "pokemoncard-add-five-popular-artists-py"
CACHE_PATH = WORKDIR / "detail-cache.json"
AUDIT_PATH = WORKDIR / "add-five-popular-artists-audit.json"
OUTPUT_PATH = WORKDIR / "artists.json"
WORKDIR.mkdir(parents=True, exist_ok=True)

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/150.0.0.0 Safari/537.36"
)


def norm(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip().casefold()


def normalize_internal_id(value: Any) -> str:
    return re.sub(r"\s+", "", str(value or "")).strip()


def run_gh(args: list[str], *, input_text: str | None = None, check: bool = True) -> subprocess.CompletedProcess[str]:
    command = ["gh", *args]
    proc = subprocess.run(
        command,
        input=input_text,
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=True,
        shell=False,
    )
    if check and proc.returncode != 0:
        raise RuntimeError(f"gh command failed ({proc.returncode}): {' '.join(command)}\n{proc.stderr.strip()}")
    return proc


def gh_get_file_text(remote_path: str) -> str:
    proc = run_gh([
        "api",
        "--method",
        "GET",
        f"repos/{REPO}/contents/{remote_path}",
        "-f",
        f"ref={BRANCH}",
        "--jq",
        ".content",
    ])
    encoded = re.sub(r"\s+", "", proc.stdout)
    if not encoded:
        raise RuntimeError(f"GitHub returned empty content for {remote_path}")
    return base64.b64decode(encoded).decode("utf-8")


def gh_file_sha(remote_path: str) -> str | None:
    proc = run_gh([
        "api",
        "--method",
        "GET",
        f"repos/{REPO}/contents/{remote_path}",
        "-f",
        f"ref={BRANCH}",
        "--jq",
        ".sha",
    ], check=False)
    if proc.returncode != 0:
        return None
    sha = proc.stdout.strip()
    return sha or None


def gh_upload(local_path: Path, remote_path: str, message: str) -> None:
    payload: dict[str, Any] = {
        "message": message,
        "branch": BRANCH,
        "content": base64.b64encode(local_path.read_bytes()).decode("ascii"),
    }
    sha = gh_file_sha(remote_path)
    if sha:
        payload["sha"] = sha

    payload_path = WORKDIR / f"gh-upload-{uuid.uuid4().hex}.json"
    payload_path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    try:
        run_gh([
            "api",
            "--method",
            "PUT",
            f"repos/{REPO}/contents/{remote_path}",
            "--input",
            str(payload_path),
        ])
    finally:
        try:
            payload_path.unlink()
        except FileNotFoundError:
            pass


COOKIE_JAR = http.cookiejar.CookieJar()
OPENER = request.build_opener(request.HTTPCookieProcessor(COOKIE_JAR))


def http_get(url: str, *, referer: str | None = None, attempts: int = 4) -> str:
    headers = {
        "User-Agent": USER_AGENT,
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    if referer:
        headers["Referer"] = referer
    last: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            req = request.Request(url, headers=headers, method="GET")
            with OPENER.open(req, timeout=45) as response:
                return response.read().decode("utf-8", errors="replace")
        except Exception as exc:  # noqa: BLE001 - retry wrapper
            last = exc
            time.sleep(0.35 * attempt)
    raise RuntimeError(f"GET failed: {url}: {last}")


def multipart_body(fields: dict[str, str]) -> tuple[bytes, str]:
    boundary = f"----DigitalCardBinder{uuid.uuid4().hex}"
    chunks: list[bytes] = []
    for name, value in fields.items():
        chunks.append(f"--{boundary}\r\n".encode("ascii"))
        chunks.append(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("ascii"))
        chunks.append(value.encode("utf-8"))
        chunks.append(b"\r\n")
    chunks.append(f"--{boundary}--\r\n".encode("ascii"))
    return b"".join(chunks), boundary


def ajax_post(fields: dict[str, str], attempts: int = 4) -> str:
    body, boundary = multipart_body(fields)
    headers = {
        "User-Agent": USER_AGENT,
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": f"{BASE}/cards",
        "Origin": BASE,
        "Content-Type": f"multipart/form-data; boundary={boundary}",
    }
    last: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            req = request.Request(f"{BASE}/v2/ajax2_dev2", data=body, headers=headers, method="POST")
            with OPENER.open(req, timeout=45) as response:
                return response.read().decode("utf-8", errors="replace")
        except Exception as exc:  # noqa: BLE001
            last = exc
            time.sleep(0.35 * attempt)
    raise RuntimeError(f"AJAX POST failed: {last}")


def ensure_session() -> None:
    http_get(f"{BASE}/cards")


def search_artist(artist: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    limit = 0
    seen_limits: set[int] = set()
    while True:
        if limit in seen_limits:
            raise RuntimeError(f"Pagination loop for {artist} at limit={limit}")
        seen_limits.add(limit)

        raw = ajax_post({
            "action": "search_text_cards",
            "search_text": artist,
            "search_params": "all",
            "limit": str(limit),
        })
        start = raw.find("{")
        if start < 0:
            raise RuntimeError(f"No JSON returned for {artist} at limit={limit}")
        obj = json.loads(raw[start:])
        count = int(obj.get("count", 0) or 0)
        if count <= 0:
            break

        result = obj.get("result") or []
        if isinstance(result, dict):
            page = list(result.values())
        elif isinstance(result, list):
            page = result
        else:
            raise RuntimeError(f"Unexpected result type for {artist}: {type(result).__name__}")
        if len(page) != count:
            raise RuntimeError(f"Parsed row mismatch for {artist}: server={count}, parsed={len(page)}")

        for item in page:
            card_num = str(item.get("CardNum", "")).strip()
            feature_image = str(item.get("feature_image", ""))
            if not card_num or not feature_image:
                raise RuntimeError(f"Incomplete search row for {artist}: {item!r}")
            rows.append({
                "artist": artist,
                "internalCardNum": card_num,
                "featureImage": feature_image,
                "searchLimit": limit,
            })

        next_limit = int(obj.get("limit", limit) or limit)
        if next_limit == limit:
            raise RuntimeError(f"Pagination did not advance for {artist} at {limit}")
        limit = next_limit
    return rows


BLOCK_CLOSE_RE = re.compile(r"</(?:div|p|li|dt|dd|h1|h2|h3|h4|h5|span|strong|a|td|tr|section|article)>", re.I)
TAG_RE = re.compile(r"<[^>]+>")
SCRIPT_RE = re.compile(r"<script\b[\s\S]*?</script>", re.I)
STYLE_RE = re.compile(r"<style\b[\s\S]*?</style>", re.I)
BR_RE = re.compile(r"<br\s*/?>", re.I)
NUMBER_RE = re.compile(r"(?<!\d)(\d{1,4}/(?:\d{1,4}|[A-Za-z][A-Za-z0-9-]*))(?:\s+([A-Z][A-Z0-9]*))?")


def html_to_lines(text: str) -> list[str]:
    text = SCRIPT_RE.sub(" ", text)
    text = STYLE_RE.sub(" ", text)
    text = BR_RE.sub("\n", text)
    text = BLOCK_CLOSE_RE.sub("\n", text)
    text = TAG_RE.sub(" ", text)
    text = html_module.unescape(text)
    lines: list[str] = []
    for raw in text.splitlines():
        clean = re.sub(r"\s+", " ", raw).strip()
        if clean:
            lines.append(clean)
    return lines


def set_code(feature_image: str) -> str:
    path = feature_image.split("?", 1)[0].strip("/")
    parts = path.split("/") if path else []
    if len(parts) >= 2:
        return parts[-2]
    filename = parts[-1] if parts else path
    match = re.match(r"^([^_]+)_", filename)
    return match.group(1) if match else ""


def image_url(feature_image: str) -> str:
    value = feature_image.strip()
    return value if re.match(r"^https?://", value, re.I) else f"https://cards.image.pokemonkorea.co.kr/data/{value}"


def parse_detail(text: str, internal_id: str, feature_image: str, source_id: str) -> dict[str, Any]:
    lines = html_to_lines(text)
    illustrator = ""
    artist_index = -1
    for idx, line in enumerate(lines):
        if line == "일러스트" or re.match(r"^일러스트\s*$", line):
            for j in range(idx + 1, min(len(lines), idx + 6)):
                if lines[j]:
                    illustrator = lines[j].strip()
                    artist_index = j
                    break
            if illustrator:
                break

    card_name = ""
    if artist_index >= 0:
        skip_exact = {"관련카드", "특성", "약점", "저항력", "후퇴"}
        for candidate in lines[artist_index + 1 : min(len(lines), artist_index + 14)]:
            candidate = candidate.strip()
            if not candidate:
                continue
            if re.match(r"^HP\s*\d+", candidate):
                continue
            if re.match(r"^카드 종류\s*:", candidate):
                continue
            if re.match(r"^Image(?:Image)*", candidate):
                continue
            if re.match(r"^\d{1,4}/", candidate):
                continue
            if candidate in skip_exact:
                continue
            card_name = candidate
            break

    printed = ""
    rarity = ""
    for line in lines:
        match = NUMBER_RE.search(line)
        if match:
            printed = match.group(1)
            rarity = match.group(2) or ""
            break

    card_number = f"{printed} {rarity}".strip()
    return {
        "internalCardNum": internal_id,
        "detailSourceId": source_id,
        "illustrator": illustrator,
        "name": card_name,
        "set": set_code(feature_image),
        "rarity": rarity,
        "printedNumber": printed,
        "cardNumber": card_number,
        "image": image_url(feature_image),
        "source": f"{BASE}/cards/detail/{source_id}",
    }


def load_cache() -> dict[str, Any]:
    if not CACHE_PATH.exists():
        return {}
    try:
        return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    except Exception:
        print("[cache] Existing cache is unreadable; starting clean.")
        return {}


def save_cache(cache: dict[str, Any]) -> None:
    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def fetch_detail(candidate: dict[str, Any], cache: dict[str, Any]) -> dict[str, Any]:
    raw_id = str(candidate["internalCardNum"]).strip()
    normalized_id = normalize_internal_id(raw_id)
    feature_image = str(candidate["featureImage"])
    cache_key = f"{normalized_id}|{feature_image}"
    if cache_key in cache:
        return cache[cache_key]

    attempt_ids = [normalized_id]
    match = re.match(r"^(.*\d)m$", normalized_id)
    if match and match.group(1) not in attempt_ids:
        attempt_ids.append(match.group(1))

    errors: list[str] = []
    for detail_id in attempt_ids:
        try:
            text = http_get(f"{BASE}/cards/detail/{detail_id}", referer=f"{BASE}/cards")
            detail = parse_detail(text, normalized_id, feature_image, detail_id)
            if detail["illustrator"] and detail["name"] and detail["printedNumber"]:
                cache[cache_key] = detail
                return detail
            errors.append(f"parse incomplete for {detail_id}")
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{detail_id}: {exc}")
    raise RuntimeError("; ".join(errors) or f"No usable detail for {raw_id}")


def card_identity(row: dict[str, Any]) -> str:
    return "|".join([
        norm(row.get("artist")),
        norm(row.get("set")),
        norm(row.get("cardNumber")),
        norm(row.get("name")),
    ])


def write_audit(audit: dict[str, Any]) -> None:
    AUDIT_PATH.write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding="utf-8")
    try:
        gh_upload(AUDIT_PATH, "tmp/add-five-popular-artists-audit.json", "Upload five-artist Korean crawl audit")
    except Exception as exc:  # noqa: BLE001
        print(f"  Audit upload warning: {exc}")


def already_complete(current: dict[str, Any]) -> bool:
    names = {norm(item.get("name")) for item in current.get("artists", [])}
    return int(current.get("artistCount", 0)) == 34 and all(norm(target) in names for target in TARGETS)


def main() -> int:
    print("=== Add 5 popular artists from Pokemon Korea (static Python) ===")
    print("[1/6] Loading current official artist dex from work branch...")
    current = json.loads(gh_get_file_text("data/artists.json"))

    if already_complete(current):
        ordered_names = [str(a.get("name", "")) for a in current.get("artists", [])]
        expected = sorted(ordered_names, key=lambda value: value.casefold())
        print(f"  Already complete: 34 artists / {int(current.get('cardCount', 0))} cards")
        print(f"  Alphabetical order: {'OK' if ordered_names == expected else 'NEEDS REVIEW'}")
        print("Nothing was changed. Return to ChatGPT and say: five artists already complete")
        return 0

    if int(current.get("artistCount", 0)) != 29:
        raise RuntimeError(f"Expected current artistCount=29, got {current.get('artistCount')}")

    existing_names = {norm(item.get("name")) for item in current.get("artists", [])}
    for target in TARGETS:
        if norm(target) in existing_names:
            raise RuntimeError(f"Target artist already exists unexpectedly: {target}")

    old_card_count = int(current.get("cardCount", 0))
    print(f"  Current: 29 artists / {old_card_count} cards")

    print("[2/6] Collecting official Korean search results for 5 artists...")
    ensure_session()
    all_candidates: list[dict[str, Any]] = []
    search_counts: dict[str, int] = {}
    for artist in TARGETS:
        items = search_artist(artist)
        search_counts[artist] = len(items)
        all_candidates.extend(items)
        print(f"  {artist:<18} {len(items):4d} search rows")
    search_total = len(all_candidates)
    if search_total <= 0:
        raise RuntimeError("Official search returned zero rows")
    print(f"  Search total: {search_total}")

    print("[3/6] Verifying exact illustrator names on official detail pages...")
    cache = load_cache()
    exact: list[dict[str, Any]] = []
    partial: list[dict[str, Any]] = []
    unprocessed: list[dict[str, Any]] = []
    new_cache_entries = 0

    for index, candidate in enumerate(all_candidates, start=1):
        before = len(cache)
        try:
            detail = fetch_detail(candidate, cache)
            if len(cache) > before:
                new_cache_entries += 1
            if norm(detail.get("illustrator")) == norm(candidate.get("artist")):
                exact.append({
                    "artist": candidate["artist"],
                    "internalCardNum": normalize_internal_id(candidate["internalCardNum"]),
                    "name": str(detail["name"]),
                    "set": str(detail["set"]),
                    "rarity": str(detail["rarity"]),
                    "printedNumber": str(detail["printedNumber"]),
                    "cardNumber": str(detail["cardNumber"]),
                    "image": str(detail["image"]),
                    "source": str(detail["source"]),
                })
            else:
                partial.append({
                    "artist": candidate["artist"],
                    "internalCardNum": normalize_internal_id(candidate["internalCardNum"]),
                    "actualIllustrator": str(detail.get("illustrator", "")),
                    "name": str(detail.get("name", "")),
                    "cardNumber": str(detail.get("cardNumber", "")),
                })
        except Exception as exc:  # noqa: BLE001
            unprocessed.append({
                "artist": candidate["artist"],
                "internalCardNum": str(candidate.get("internalCardNum", "")),
                "featureImage": str(candidate.get("featureImage", "")),
                "reason": str(exc),
            })

        if new_cache_entries and new_cache_entries % 50 == 0:
            save_cache(cache)
        if index % 100 == 0 or index == search_total:
            print(f"  Verified {index} / {search_total}")
    save_cache(cache)

    print("[4/6] Applying same-card dedupe rule...")
    final_by_artist: dict[str, list[dict[str, Any]]] = {}
    duplicate_count = 0
    for artist in TARGETS:
        seen: dict[str, dict[str, Any]] = {}
        for row in exact:
            if norm(row["artist"]) != norm(artist):
                continue
            key = card_identity(row)
            if key in seen:
                duplicate_count += 1
                existing = seen[key]
                existing_mirror = bool(re.search(r"_m\.", existing["image"], re.I))
                new_mirror = bool(re.search(r"_m\.", row["image"], re.I))
                if existing_mirror and not new_mirror:
                    seen[key] = row
            else:
                seen[key] = row
        final_by_artist[artist] = list(seen.values())

    final_counts = {artist: len(final_by_artist[artist]) for artist in TARGETS}
    added_count = sum(final_counts.values())
    audit = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "source": "Pokemon Korea official card search",
        "sourceUrl": f"{BASE}/cards",
        "targets": TARGETS,
        "currentArtistCount": int(current.get("artistCount", 0)),
        "currentCardCount": old_card_count,
        "searchCounts": search_counts,
        "searchTotal": search_total,
        "exactMatches": len(exact),
        "partialExcluded": len(partial),
        "unprocessed": len(unprocessed),
        "duplicatesRemoved": duplicate_count,
        "finalCounts": final_counts,
        "cardsToAdd": added_count,
        "expectedNewArtistCount": 34,
        "expectedNewCardCount": old_card_count + added_count,
        "partialSamples": partial[:40],
        "unprocessedRows": unprocessed,
    }

    print("[5/6] Uploading audit to work branch...")
    write_audit(audit)
    print()
    print(f"  Search rows     : {search_total}")
    print(f"  Exact matches   : {len(exact)}")
    print(f"  Partial excluded: {len(partial)}")
    print(f"  Unprocessed     : {len(unprocessed)}")
    print(f"  Duplicates      : {duplicate_count}")
    print(f"  Cards to add    : {added_count}")
    for artist in TARGETS:
        print(f"    {artist:<18} {final_counts[artist]:4d}")

    if unprocessed:
        print()
        print("STOP - Some official rows could not be processed. artists.json was NOT changed.")
        print("Return to ChatGPT and say: five artists audit uploaded")
        return 2

    if len(exact) + len(partial) != search_total:
        raise RuntimeError("Classification total mismatch. artists.json was NOT changed.")
    for artist in TARGETS:
        if final_counts[artist] <= 0:
            raise RuntimeError(f"No exact Korean cards found for {artist}. artists.json was NOT changed.")

    print("[6/6] Building and uploading updated artists.json...")
    new_artist_objects: list[dict[str, Any]] = []
    for artist in TARGETS:
        cards: list[dict[str, Any]] = []
        for order, row in enumerate(final_by_artist[artist], start=1):
            if not row["name"] or not row["set"] or not row["cardNumber"] or not row["image"]:
                raise RuntimeError(f"Required field missing for {artist} / {row['internalCardNum']}")
            if not row["image"].startswith("https://cards.image.pokemonkorea.co.kr/"):
                raise RuntimeError(f"Non-official image URL for {artist} / {row['internalCardNum']}")
            cards.append({
                "order": order,
                "name": row["name"],
                "owned": False,
                "set": row["set"],
                "rarity": row["rarity"],
                "image": row["image"],
                "imageBw": "",
                "source": row["source"],
                "cardNumber": row["cardNumber"],
            })
        new_artist_objects.append({"name": artist, "cards": cards})

    combined = list(current.get("artists", [])) + new_artist_objects
    combined.sort(key=lambda item: str(item.get("name", "")).casefold())

    new_card_count = sum(len(item.get("cards", [])) for item in combined)
    new_owned_count = sum(
        1
        for item in combined
        for card in item.get("cards", [])
        if bool(card.get("owned"))
    )
    if len(combined) != 34:
        raise RuntimeError(f"Final artist count is {len(combined)}, expected 34")
    if new_card_count != old_card_count + added_count:
        raise RuntimeError(f"Final card count is {new_card_count}, expected {old_card_count + added_count}")
    ordered_names = [str(item.get("name", "")) for item in combined]
    if ordered_names != sorted(ordered_names, key=lambda value: value.casefold()):
        raise RuntimeError("Alphabetical artist ordering validation failed")

    output = {
        "source": "Pokemon Korea official card search",
        "sourceUrl": f"{BASE}/cards",
        "artistCount": 34,
        "cardCount": new_card_count,
        "ownedCount": new_owned_count,
        "artists": combined,
    }
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    gh_upload(OUTPUT_PATH, "data/artists.json", "Add five popular artists from Korean official cards")

    print()
    print("SUCCESS - 5 artists added to the WORK BRANCH only.")
    print(f"New total: 34 artists / {new_card_count} cards")
    print("Artist list: A-Z alphabetical order")
    print("Nothing has been merged to main.")
    print("Return to ChatGPT and say: five artists complete")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nInterrupted. Cached detail results were kept; you can run the same command again.")
        raise SystemExit(130)
    except Exception as exc:  # noqa: BLE001
        print(f"\nERROR: {exc}", file=sys.stderr)
        print("artists.json was not intentionally changed after a validation failure.", file=sys.stderr)
        raise SystemExit(1)
