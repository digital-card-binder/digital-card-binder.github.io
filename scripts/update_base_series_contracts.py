from pathlib import Path

path = Path("tests/collector-ui-contract.test.mjs")
text = path.read_text()
replacements = {
    "collector-nav[.]js\\?v=20260821-3": "collector-nav[.]js\\?v=20260826-1",
    "collector-nav[.]js[?]v=20260821-3": "collector-nav[.]js[?]v=20260826-1",
    "collector-nav[.]js\\?v=20260814-1": "collector-nav[.]js\\?v=20260826-1",
    "collector-nav[.]js[?]v=20260814-1": "collector-nav[.]js[?]v=20260826-1",
}
for old, new in replacements.items():
    text = text.replace(old, new)
path.write_text(text)
