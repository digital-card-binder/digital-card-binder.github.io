#!/usr/bin/env python3
"""Read-only CDN health check or fail-closed restoration of the existing Pages archive.

Never modifies a public deployment. Restore only copies verified WebP bytes from the
current public archive to a temporary local build; the existing build validator
must pass before a separate deploy step is allowed to run.
"""
from __future__ import annotations

import argparse
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO
import json
import os
from pathlib import Path, PurePosixPath
import tempfile
import urllib.error
import urllib.request

from PIL import Image, UnidentifiedImageError

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = ROOT / "tmp/card-images/manifest.json"
DEFAULT_OUTPUT = ROOT / "tmp/card-images/build"
CDN_BASES = {
    "modern": "https://dcb-card-images-modern-2026.pages.dev",
    "legacy": "https://dcb-card-images-legacy-2026.pages.dev",
}
MAX_BYTES = 25 * 1024 * 1024


def safe_path(project_root: Path, relative: str) -> Path:
    parts = PurePosixPath(relative).parts
    if not parts or any(p in ("", ".", "..") for p in parts) or not relative.endswith(".webp"):
        raise ValueError("unsafe or non-WebP archive path")
    dest = project_root.joinpath(*parts)
    if not dest.resolve().is_relative_to(project_root.resolve()):
        raise ValueError("archive path escapes target directory")
    return dest


def verified_webp(payload: bytes) -> bool:
    if not payload or len(payload) > MAX_BYTES:
        return False
    try:
        with Image.open(BytesIO(payload)) as image:
            if image.format != "WEBP":
                return False
            image.load()
            return image.width > 0 and image.height > 0
    except (OSError, UnidentifiedImageError, ValueError):
        return False


def valid_existing(dest: Path) -> bool:
    if not dest.is_file() or not (0 < dest.stat().st_size <= MAX_BYTES):
        return False
    try:
        with Image.open(dest) as image:
            if image.format != "WEBP":
                return False
            image.load()
            return image.width > 0 and image.height > 0
    except (OSError, UnidentifiedImageError, ValueError):
        return False


def select_sample(assets: list[dict], count: int) -> list[dict]:
    by_root: dict[str, list[dict]] = defaultdict(list)
    for asset in assets:
        by_root[str(asset.get("root", "other")).upper()].append(asset)
    # Give each data era a chance, including externally sourced vintage images.
    roots = sorted(by_root)
    selections: list[dict] = []
    for root in roots:
        items = sorted(by_root[root], key=lambda a: a["relativePath"])
        for index in {0, len(items) // 2, len(items) - 1}:
            candidate = items[index]
            if candidate not in selections:
                selections.append(candidate)
    if len(selections) < count:
        ordered = sorted(assets, key=lambda a: a["relativePath"])
        for i in range(count):
            candidate = ordered[min(len(ordered) - 1, i * len(ordered) // count)]
            if candidate not in selections:
                selections.append(candidate)
    # Max sample applies after root prioritization to keep probe inexpensive.
    return selections[:count]


def fetch_checked(url: str, timeout: float) -> tuple[bytes | None, str]:
    request = urllib.request.Request(url, headers={
        "Accept": "image/webp",
        "User-Agent": "DigitalCardBinder-ArchiveHealth/1.0",
    })
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            content_type = str(response.headers.get("Content-Type", "")).lower()
            if "text/html" in content_type or "application/json" in content_type:
                return None, "unexpected-content-type"
            content = response.read(MAX_BYTES + 1)
        if not verified_webp(content):
            return None, "invalid-webp-or-empty"
        return content, ""
    except urllib.error.HTTPError as error:
        return None, f"http-{error.code}"
    except (OSError, TimeoutError, ValueError) as error:
        return None, f"network-{type(error).__name__}"


def restore_one(asset: dict, project: str, target: Path, base: str, timeout: float, probe: bool) -> dict:
    relative = asset["relativePath"]
    dest = safe_path(target, relative)
    if not probe and valid_existing(dest):
        return {"path": relative, "status": "existing"}
    url = base.rstrip("/") + "/" + relative
    content, error = fetch_checked(url, timeout)
    if content is None:
        return {"path": relative, "status": "unavailable", "reason": error}
    if not probe:
        dest.parent.mkdir(parents=True, exist_ok=True)
        temporary = ""
        try:
            with tempfile.NamedTemporaryFile(prefix=".cdn-", suffix=".tmp",
                                             dir=dest.parent, delete=False) as handle:
                temporary = handle.name
                handle.write(content)
            os.replace(temporary, dest)
        finally:
            if temporary and os.path.exists(temporary):
                os.unlink(temporary)
    return {"path": relative, "status": "verified" if probe else "restored"}


def update_metadata(target: Path, project: str, assets: list[dict], results: dict[str, dict]) -> None:
    # Restore original source links for auditability. No placeholders or
    # unverified file is marked successful.
    from download_card_images import write_project_files, existing_source_records

    old_records = {
        record["path"]: record
        for record in existing_source_records(target)
        if isinstance(record, dict) and isinstance(record.get("path"), str)
    }
    records = []
    for asset in assets:
        relative = asset["relativePath"]
        result = results.get(relative)
        if not result or result["status"] not in ("restored", "existing"):
            continue
        previous = old_records.get(relative, {})
        record = {
            "path": relative,
            "sources": asset["sourceUrls"],
            "official": asset["official"],
            "status": previous.get("status", "existing") if result["status"] == "existing" else "downloaded",
        }
        if record["status"] not in ("downloaded", "existing", "reused"):
            record["status"] = "existing"
        if asset.get("originalSourceUrls"):
            record["originalSources"] = asset["originalSourceUrls"]
        if result["status"] == "restored":
            record["downloadedFrom"] = CDN_BASES[project] + "/" + relative
        elif previous.get("downloadedFrom"):
            record["downloadedFrom"] = previous["downloadedFrom"]
        records.append(record)
    write_project_files(target, project, records)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--project", choices=("modern", "legacy"), required=True)
    parser.add_argument("--probe-only", action="store_true")
    parser.add_argument("--sample", type=int, default=18)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--timeout", type=float, default=12.0)
    parser.add_argument("--report", type=Path)
    parser.add_argument("--max-unavailable", type=int, default=600)
    args = parser.parse_args()
    if not 1 <= args.workers <= 16 or not 1 <= args.sample <= 100 or args.timeout <= 0:
        parser.error("workers must be 1-16, sample must be 1-100, timeout positive")
    manifest = json.loads(args.manifest.read_text(encoding="utf8"))
    assets = [a for a in manifest["assets"] if a["project"] == args.project]
    if not assets:
        raise ValueError("No assets in selected project")
    target = args.output_root / args.project
    chosen = select_sample(assets, args.sample) if args.probe_only else assets
    results: dict[str, dict] = {}
    # Disk and asset identity data must never be modified during probe-only.
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = [executor.submit(restore_one, asset, args.project, target,
                     CDN_BASES[args.project], args.timeout, args.probe_only) for asset in chosen]
        for future in as_completed(futures):
            item = future.result()
            results[item["path"]] = item
    statuses = defaultdict(int)
    for value in results.values():
        statuses[value["status"]] += 1
    missing = [item for item in results.values() if item["status"] == "unavailable"]
    report = {
        "schemaVersion": 1,
        "project": args.project,
        "mode": "probe" if args.probe_only else "restore",
        "expected": len(assets),
        "checked": len(chosen),
        "results": dict(statuses),
        "unavailableCount": len(missing),
        "unavailableSample": missing[:30],
        "remoteArchiveVerified": len(missing) == 0 and len(chosen) == len(assets),
    }
    report_path = args.report or (args.manifest.parent / f"cdn-health-{args.project}.json")
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    print(json.dumps(report, ensure_ascii=False))
    if not args.probe_only:
        update_metadata(target, args.project, assets, results)
    # Probes are evidence of sampled availability only; no full-archive claim.
    # A partial restore lets the original source repairer try <= max-unavailable.
    if args.probe_only:
        return 0 if not missing else 1
    return 0 if len(missing) <= args.max_unavailable else 2


if __name__ == "__main__":
    raise SystemExit(main())
