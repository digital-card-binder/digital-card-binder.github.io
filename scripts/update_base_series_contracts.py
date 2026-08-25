from pathlib import Path

path = Path("tests/collector-ui-contract.test.mjs")
text = path.read_text()
for old in ("20260821-3", "20260814-1"):
    text = text.replace(old, "20260826-1")
path.write_text(text)
