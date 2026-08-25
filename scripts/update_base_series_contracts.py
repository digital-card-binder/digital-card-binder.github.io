from pathlib import Path

path = Path("tests/collector-ui-contract.test.mjs")
text = path.read_text()
old = "collector-nav[.]js\\?v=20260821-3"
new = "collector-nav[.]js\\?v=20260826-1"
if old in text:
    text = text.replace(old, new)
path.write_text(text)
