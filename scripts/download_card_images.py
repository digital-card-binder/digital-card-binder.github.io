#!/usr/bin/env python3
"""Build Cloudflare Pages-ready card image assets from the migration manifest.

The downloader is deliberately single-threaded and rate-limited. It preserves all
visible source pixels, including watermarks, and records every original source URL.
"""

from __future__ import annotations

import argparse
import io
import json
import os
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageOps, UnidentifiedImageError


REPOSITORY_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MANIFEST = REPOSITORY_ROOT / "tmp" / "card-images" / "manifest.json"
DEFAULT_OUTPUT_ROOT = REPOSITORY_ROOT / "tmp" / "card-images" / "build"
MAX_SOURCE_BYTES = 32 * 1024 * 1024
USER_AGENT = (
    "DigitalCardBinder-Image-Migration/1.0 "
    "(+https://digital-card-binder.github.io/; personal non-commercial archive)"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument("--project", choices=("modern", "legacy", "all"), default="all")
    parser.add_argument("--width", type=int, default=420)
    parser.add_argument("--quality", type=int, default=76)
    parser.add_argument("--min-delay", type=float, default=2.0)
    parser.add_argument("--retries", type=int, default=2)
    parser.add_argument("--timeout", type=float, default=45.0)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--offset", type=int, default=0)
    parser.add_argument("--max-consecutive-failures", type=int, default=8)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--placeholder-on-failure", action="store_true")
    return parser.parse_args()


class RateLimiter:
    def __init__(self, min_delay: float) -> None:
        self.min_delay = max(0.0, min_delay)
        self.last_request_at = 0.0

    def wait(self) -> None:
        remaining = self.min_delay - (time.monotonic() - self.last_request_at)
        if remaining > 0:
            time.sleep(remaining)
        self.last_request_at = time.monotonic()


def existing_image_is_valid(path: Path) -> bool:
    if not path.is_file() or path.stat().st_size == 0:
        return False
    try:
        with Image.open(path) as image:
            image.verify()
        return True
    except (OSError, UnidentifiedImageError):
        return False


def fetch_source(
    url: str,
    limiter: RateLimiter,
    retries: int,
    timeout: float,
) -> bytes:
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        limiter.wait()
        request = urllib.request.Request(
            url,
            headers={
                "Accept": "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
                "User-Agent": USER_AGENT,
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                content_type = response.headers.get_content_type().lower()
                if content_type.startswith(("text/", "application/json", "application/xml")):
                    raise ValueError(f"unexpected content type: {content_type}")
                payload = response.read(MAX_SOURCE_BYTES + 1)
                if len(payload) > MAX_SOURCE_BYTES:
                    raise ValueError("source image exceeds 32 MiB safety limit")
                if not payload:
                    raise ValueError("source image is empty")
                return payload
        except urllib.error.HTTPError as error:
            last_error = error
            if error.code in {400, 401, 403, 404, 410}:
                break
            if attempt < retries:
                retry_after = error.headers.get("Retry-After", "").strip()
                try:
                    retry_delay = float(retry_after)
                except ValueError:
                    retry_delay = 1.5 * (2 ** (attempt - 1))
                time.sleep(min(60.0, max(1.5, retry_delay)))
        except (OSError, ValueError) as error:
            last_error = error
            if isinstance(error, ValueError):
                break
            if attempt < retries:
                time.sleep(min(12.0, 1.5 * (2 ** (attempt - 1))))
    raise RuntimeError(str(last_error or "download failed"))


def webp_metadata(image: Image.Image) -> dict[str, Any]:
    metadata: dict[str, Any] = {}
    for key in ("icc_profile", "exif", "xmp"):
        value = image.info.get(key)
        if value:
            metadata[key] = value
    return metadata


def convert_to_webp(payload: bytes, destination: Path, width: int, quality: int) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(io.BytesIO(payload)) as source:
        source.load()
        metadata = webp_metadata(source)
        image = ImageOps.exif_transpose(source)
        if image.width > width:
            target_height = max(1, round(image.height * width / image.width))
            image = image.resize((width, target_height), Image.Resampling.LANCZOS)
        image = image.convert("RGBA" if "A" in image.getbands() else "RGB")

        temporary_name = ""
        try:
            with tempfile.NamedTemporaryFile(
                prefix=f".{destination.name}.",
                suffix=".tmp",
                dir=destination.parent,
                delete=False,
            ) as temporary:
                temporary_name = temporary.name
            image.save(
                temporary_name,
                format="WEBP",
                quality=quality,
                method=6,
                **metadata,
            )
            os.replace(temporary_name, destination)
        finally:
            if temporary_name and os.path.exists(temporary_name):
                os.unlink(temporary_name)


def create_placeholder(destination: Path, width: int, quality: int) -> None:
    height = round(width * 1.4)
    image = Image.new("RGB", (width, height), "#eceff3")
    draw = ImageDraw.Draw(image)
    margin = max(12, width // 18)
    draw.rounded_rectangle(
        (margin, margin, width - margin, height - margin),
        radius=max(8, width // 28),
        outline="#aeb6c2",
        width=max(2, width // 140),
    )
    label = "IMAGE UNAVAILABLE"
    text_box = draw.textbbox((0, 0), label)
    text_width = text_box[2] - text_box[0]
    draw.text(((width - text_width) / 2, height / 2), label, fill="#687281", anchor="lm")
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, format="WEBP", quality=quality, method=6)


def write_project_files(project_root: Path, project: str, sources: list[dict[str, Any]]) -> None:
    project_root.mkdir(parents=True, exist_ok=True)
    (project_root / "index.html").write_text(
        "<!doctype html><html lang=\"ko\"><meta charset=\"utf-8\">"
        f"<title>Digital Card Binder image assets - {project}</title>"
        "<body><p>Digital Card Binder static card image assets.</p></body></html>\n",
        encoding="utf-8",
    )
    (project_root / "_headers").write_text(
        "/*\n"
        "  Access-Control-Allow-Origin: *\n"
        "  Cache-Control: public, max-age=604800\n"
        "  X-Content-Type-Options: nosniff\n",
        encoding="utf-8",
    )
    (project_root / "asset-sources.json").write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "project": project,
                "watermarkPolicy": "preserve-source-pixels",
                "assets": sources,
            },
            ensure_ascii=False,
            separators=(",", ":"),
        )
        + "\n",
        encoding="utf-8",
    )


def append_log(log_path: Path, event: dict[str, Any]) -> None:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, ensure_ascii=False) + "\n")


def main() -> int:
    args = parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    selected = [
        asset
        for asset in manifest["assets"]
        if args.project == "all" or asset["project"] == args.project
    ]
    selected = selected[args.offset :]
    if args.limit > 0:
        selected = selected[: args.limit]

    limiter = RateLimiter(args.min_delay)
    results = {"downloaded": 0, "skipped": 0, "placeholder": 0, "failed": 0}
    source_indexes: dict[str, list[dict[str, Any]]] = {"modern": [], "legacy": []}
    failures: dict[str, list[dict[str, Any]]] = {"modern": [], "legacy": []}
    log_path = args.output_root.parent / "migration-log.jsonl"
    consecutive_failures = 0
    aborted = False

    for index, asset in enumerate(selected, start=1):
        project = asset["project"]
        destination = args.output_root / project / asset["relativePath"]
        public_record = {
            "path": asset["relativePath"],
            "sources": asset["sourceUrls"],
            "official": asset["official"],
        }
        source_indexes[project].append(public_record)

        if not args.force and existing_image_is_valid(destination):
            results["skipped"] += 1
            public_record["status"] = "existing"
            print(f"[{index}/{len(selected)}] skip {asset['relativePath']}", flush=True)
            continue

        error_messages: list[str] = []
        completed = False
        for source_url in asset["sourceUrls"]:
            try:
                payload = fetch_source(
                    source_url,
                    limiter=limiter,
                    retries=max(1, args.retries),
                    timeout=args.timeout,
                )
                convert_to_webp(payload, destination, args.width, args.quality)
                results["downloaded"] += 1
                public_record["status"] = "downloaded"
                append_log(
                    log_path,
                    {"status": "downloaded", "source": source_url, "path": asset["relativePath"]},
                )
                print(f"[{index}/{len(selected)}] ok   {asset['relativePath']}", flush=True)
                consecutive_failures = 0
                completed = True
                break
            except Exception as error:  # Continue through declared source alternatives.
                error_messages.append(f"{source_url}: {error}")

        if completed:
            continue
        failure = {
            "path": asset["relativePath"],
            "sources": asset["sourceUrls"],
            "errors": error_messages,
        }
        failures[project].append(failure)
        append_log(log_path, {"status": "failed", **failure})
        if args.placeholder_on_failure:
            create_placeholder(destination, args.width, args.quality)
            public_record["status"] = "placeholder"
            results["placeholder"] += 1
            print(f"[{index}/{len(selected)}] HOLD {asset['relativePath']}", flush=True)
        else:
            public_record["status"] = "failed"
            results["failed"] += 1
            print(f"[{index}/{len(selected)}] FAIL {asset['relativePath']}", flush=True)

        consecutive_failures += 1
        if consecutive_failures >= max(1, args.max_consecutive_failures):
            aborted = True
            append_log(
                log_path,
                {
                    "status": "aborted",
                    "reason": "consecutive failure safety limit",
                    "count": consecutive_failures,
                },
            )
            print(
                "ABORT: consecutive failure safety limit reached; no more source requests will be sent.",
                flush=True,
            )
            break

    projects = ("modern", "legacy") if args.project == "all" else (args.project,)
    for project in projects:
        write_project_files(args.output_root / project, project, source_indexes[project])
        failure_path = args.output_root.parent / f"failures-{project}.json"
        failure_path.write_text(
            json.dumps(failures[project], ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    print(json.dumps(results, ensure_ascii=False, indent=2), flush=True)
    return 2 if aborted else (1 if results["failed"] else 0)


if __name__ == "__main__":
    raise SystemExit(main())
