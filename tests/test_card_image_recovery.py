import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import download_card_images as downloader
from verify_card_image_archive import verify


class RecoveryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.output = self.root / "build"
        self.manifest = self.root / "manifest.json"

    def tearDown(self):
        self.temp.cleanup()

    def image(self, relative):
        path = self.output / "modern" / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        Image.new("RGB", (12, 17), "red").save(path, format="WEBP")
        return path

    def run_downloader(self, assets, *args):
        self.manifest.write_text(json.dumps({"assets": assets}))
        with patch.object(sys, "argv", ["download", "--manifest", str(self.manifest),
            "--output-root", str(self.output), "--project", "modern", *args]):
            with contextlib.redirect_stdout(io.StringIO()):
                return downloader.main()

    def asset(self, path, **extra):
        return {"project": "modern", "root": "S", "relativePath": path,
            "official": True, "sourceUrls": ["https://example.test/card.png"], **extra}

    def test_recovery_copies_exact_cached_card_without_network_or_changing_existing_file(self):
        source = self.image("correct/card.webp")
        original = source.read_bytes()
        assets = [self.asset("correct/card.webp"), self.asset("old/card.webp",
            reuse={"project": "modern", "relativePath": "correct/card.webp"})]
        with patch.object(downloader, "fetch_source", side_effect=AssertionError("network used")):
            self.assertEqual(self.run_downloader(assets, "--missing-only", "--max-missing", "2"), 0)
        self.assertEqual(source.read_bytes(), original)
        self.assertEqual((self.output / "modern/old/card.webp").read_bytes(), original)
        records = json.loads((self.output / "modern/asset-sources.json").read_text())["assets"]
        self.assertEqual(records[0]["status"], "reused")

    def test_missing_cache_guard_stops_before_download(self):
        with patch.object(downloader, "fetch_source", side_effect=AssertionError("network used")):
            self.assertEqual(self.run_downloader([self.asset("a.webp"), self.asset("b.webp")],
                "--missing-only", "--max-missing", "1"), 2)

    def test_recovery_downloads_only_missing_asset_and_keeps_provenance(self):
        self.image("existing.webp")
        payload = io.BytesIO()
        Image.new("RGB", (12, 17), "blue").save(payload, format="PNG")
        with patch.object(downloader, "fetch_source", return_value=payload.getvalue()) as fetch:
            result = self.run_downloader([self.asset("existing.webp"), self.asset("missing.webp")], "--missing-only")
        self.assertEqual(result, 0)
        self.assertEqual(fetch.call_count, 1)
        rows = json.loads((self.output / "modern/asset-sources.json").read_text())["assets"]
        self.assertEqual(rows[0]["downloadedFrom"], "https://example.test/card.png")

    def test_full_verification_rejects_corrupt_missing_and_placeholder_files(self):
        self.image("good.webp")
        self.image("placeholder.webp")
        (self.output / "modern/corrupt.webp").write_bytes(b"not an image")
        names = ["good.webp", "placeholder.webp", "corrupt.webp", "missing.webp"]
        self.manifest.write_text(json.dumps({"assets": [self.asset(n) for n in names]}))
        records = [{"path": n, "status": "placeholder" if n.startswith("placeholder") else "downloaded"} for n in names]
        (self.output / "modern/asset-sources.json").write_text(json.dumps({"assets": records}))
        report = verify(self.manifest, self.output)
        self.assertEqual(report["verified"]["modern"], 1)
        self.assertEqual(report["failed"], 3)
        self.assertEqual({f["path"] for f in report["failures"]}, set(names[1:]))


if __name__ == "__main__":
    unittest.main()
