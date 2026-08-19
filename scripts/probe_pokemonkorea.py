#!/usr/bin/env python3
from __future__ import annotations

import re
import urllib.parse
import urllib.request
from pathlib import Path

BASE = "https://pokemoncard.co.kr"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (GitHub Actions artist-dex probe)",
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
}


def get(url: str) -> tuple[str, str]:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=60) as response:
        return response.geturl(), response.read().decode("utf-8", "replace")


def main() -> None:
    out: list[str] = []
    url, html = get(BASE + "/cards")
    out += [f"URL {url}", f"HTML_BYTES {len(html.encode('utf-8'))}", "FORMS"]

    for match in re.finditer(r"<form\b[\s\S]*?</form>", html, re.I):
        form = match.group(0)
        action = re.search(r"action=[\"']([^\"']*)", form, re.I)
        method = re.search(r"method=[\"']([^\"']*)", form, re.I)
        names = re.findall(r"name=[\"']([^\"']+)", form, re.I)
        out.append(
            f" action={action.group(1) if action else ''} "
            f"method={method.group(1) if method else ''} names={names}"
        )

    scripts = [
        urllib.parse.urljoin(BASE, src)
        for src in re.findall(r"<script[^>]+src=[\"']([^\"']+)", html, re.I)
    ]
    out.append("SCRIPTS")
    out.extend(scripts)
    out.append("INLINE_INTERESTING")

    for line in html.splitlines():
        low = line.lower()
        if any(k in low for k in ("ajax", "axios", "fetch(", "/cards", "loadmore", "load-more", "search")):
            clean = re.sub(r"\s+", " ", line).strip()
            if len(clean) < 1000:
                out.append(clean)

    for jsurl in scripts:
        if not jsurl.startswith(BASE):
            continue
        try:
            _, js = get(jsurl)
        except Exception as exc:  # pragma: no cover - diagnostics only
            out.append(f"JSERR {jsurl} {exc!r}")
            continue
        hits: list[str] = []
        for line in js.splitlines():
            low = line.lower()
            if any(k in low for k in ("ajax", "axios", "fetch(", "/cards", "loadmore", "load-more", "cardlist", "card-list")):
                clean = re.sub(r"\s+", " ", line).strip()
                if clean and len(clean) < 1500:
                    hits.append(clean)
        if hits:
            out.append(f"JS {jsurl}")
            out.extend(hits[:120])

    for key in ("OKACHEKE", "Narumi Sato"):
        for param in ("s", "keyword", "q", "search", "searchWord", "word"):
            qurl = BASE + "/cards?" + urllib.parse.urlencode({param: key})
            try:
                final, body = get(qurl)
                details = sorted(set(re.findall(r"/cards/detail/[A-Za-z0-9_-]+", body)))
                out.append(
                    f"QUERY {param}={key!r} final={final} "
                    f"detail_count={len(details)} sample={details[:5]}"
                )
            except Exception as exc:  # pragma: no cover - diagnostics only
                out.append(f"QUERYERR {param}={key!r} {exc!r}")

    path = Path("tmp/pokemonkorea-probe.txt")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(out) + "\n", encoding="utf-8")
    print("\n".join(out))


if __name__ == "__main__":
    main()
