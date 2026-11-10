import contextlib
from io import BytesIO, StringIO
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import restore_card_images_from_cloudflare as recovery
from verify_card_image_archive import verify


class CloudflareArchiveRecoveryTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.manifest = self.root / "manifest.json"
        self.output = self.root / "build"

    def tearDown(self):
        self.tmp.cleanup()

    def asset(self, name, root="SV"):
        return {
            "project": "modern", "root": root,
            "relativePath": "data/wmimages/" + name,
            "official": True,
            "sourceUrls": ["https://cards.image.pokemonkorea.co.kr/data/wmimages/" + name.replace(".webp", ".png")],
        }

    @staticmethod
    def valid_image():
        buffer = BytesIO()
        Image.new("RGB", (20, 28), "#aaffcc").save(buffer, format="WEBP")
        return buffer.getvalue()

    def run_script(self, assets, *args):
        self.manifest.write_text(json.dumps({"assets": assets}))
        argv = ["restore", "--manifest", str(self.manifest), "--output-root", str(self.output),
                "--project", "modern", "--report", str(self.root / "report.json"),
                "--workers", "2", "--sample", "5", *args]
        with patch.object(sys, "argv", argv), contextlib.redirect_stdout(StringIO()):
            return recovery.main()

    def test_probe_reads_public_images_and_never_creates_build(self):
        image = self.valid_image()
        manifest = [self.asset("SV/SV1V/SV1V_001.webp")]
        with patch.object(recovery, "fetch_checked", return_value=(image, "")) as remote:
            self.assertEqual(self.run_script(manifest, "--probe-only"), 0)
        self.assertEqual(remote.call_count, 1)
        self.assertFalse(self.output.exists())
        report = json.loads((self.root / "report.json").read_text())
        self.assertEqual(report["mode"], "probe")
        self.assertEqual(report["results"]["verified"], 1)

    def test_complete_restore_can_pass_full_archive_validator(self):
        image = self.valid_image()
        files = [self.asset("SV/SV1V/SV1V_001.webp"), self.asset("MEGA/M1L/M1L_001.webp", "MEGA")]
        with patch.object(recovery, "fetch_checked", return_value=(image, "")):
            self.assertEqual(self.run_script(files), 0)
        self.assertTrue((self.output / "modern" / files[0]["relativePath"]).exists())
        records = json.loads((self.output / "modern/asset-sources.json").read_text())
        self.assertEqual(len(records["assets"]), 2)
        self.assertTrue(all(x["status"] == "downloaded" for x in records["assets"]))
        outcome = verify(self.manifest, self.output)
        self.assertEqual(outcome["failed"], 0)
        self.assertEqual(outcome["verified"]["modern"], 2)

    def test_cache_files_are_not_overwritten_and_unavailable_sources_do_not_create_placeholders(self):
        existing = self.asset("SV/SV1V/SV1V_001.webp")
        missing = self.asset("SV/SV1V/SV1V_002.webp")
        destination = self.output / "modern" / existing["relativePath"]
        destination.parent.mkdir(parents=True, exist_ok=True)
        original = self.valid_image()
        destination.write_bytes(original)
        with patch.object(recovery, "fetch_checked", return_value=(None, "http-404")) as remote:
            self.assertEqual(self.run_script([existing, missing], "--max-unavailable", "0"), 2)
        self.assertEqual(remote.call_count, 1)
        self.assertEqual(destination.read_bytes(), original)
        self.assertFalse((self.output / "modern" / missing["relativePath"]).exists())
        report = json.loads((self.root / "report.json").read_text())
        self.assertEqual(report["unavailableCount"], 1)
        self.assertEqual(report["results"]["existing"], 1)

    def test_rejects_html_responses_invalid_images_and_unsafe_paths(self):
        self.assertFalse(recovery.verified_webp(b"<html>no image</html>"))
        self.assertTrue(recovery.verified_webp(self.valid_image()))
        with self.assertRaises(ValueError):
            recovery.safe_path(self.output, "../elsewhere.webp")
        with self.assertRaises(ValueError):
            recovery.safe_path(self.output, "card.png")

    def test_probe_samples_multiple_roots(self):
        assets = [self.asset(f"SV/SV1V/SV1V_{i:03}.webp") for i in range(1, 10)]
        assets += [self.asset(f"MEGA/M1L/M1L_{i:03}.webp", "MEGA") for i in range(1, 10)]
        sample = recovery.select_sample(assets, 6)
        self.assertEqual(len(sample), 6)
        self.assertEqual({item["root"] for item in sample}, {"SV", "MEGA"})


if __name__ == "__main__":
    unittest.main()
