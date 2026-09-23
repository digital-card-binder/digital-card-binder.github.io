#!/usr/bin/env python3
"""Decode every expected image and reject missing, corrupt or placeholder assets."""
import argparse
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def verify(manifest_path: Path, output_root: Path) -> dict:
    manifest = json.loads(manifest_path.read_text())
    failures = []
    counts = {"modern": 0, "legacy": 0}
    records = {}
    for project in counts:
        source_file = output_root / project / "asset-sources.json"
        if source_file.is_file():
            records[project] = {r["path"]: r for r in json.loads(source_file.read_text()).get("assets", [])}
        else:
            records[project] = {}
    for asset in manifest["assets"]:
        project, relative = asset["project"], asset["relativePath"]
        try:
            path = (output_root / project / relative).resolve()
            if not path.is_relative_to((output_root / project).resolve()):
                raise ValueError("unsafe image path")
            record = records[project].get(relative)
            if not record or record.get("status") not in {"downloaded", "existing", "reused"}:
                raise ValueError("missing successful source record or placeholder")
            with Image.open(path) as image:
                if image.format != "WEBP":
                    raise ValueError("image is not WebP")
                image.load()
                if min(image.size) <= 0:
                    raise ValueError("empty image")
            counts[project] += 1
        except (OSError, ValueError) as error:
            failures.append({"project": project, "path": relative, "error": str(error)})
    return {"verified": counts, "failed": len(failures), "failures": failures}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=ROOT / "tmp/card-images/manifest.json")
    parser.add_argument("--output-root", type=Path, default=ROOT / "tmp/card-images/build")
    args = parser.parse_args()
    report = verify(args.manifest, args.output_root)
    report_path = args.manifest.parent / "archive-verification.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    raise SystemExit(1 if report["failed"] else 0)
