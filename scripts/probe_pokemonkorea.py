#!/usr/bin/env python3
from __future__ import annotations

import re
import subprocess
import urllib.parse
from pathlib import Path

BASES = [
    "https://pokemoncard.co.kr",
    "http://pokemoncard.co.kr",
]
CHROME_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/150.0.0.0 Safari/537.36"
)


def curl_get(url: str) -> tuple[int, str, str]:
    cmd = [
        "curl",
        "-sS",
        "-L",
        "--http1.1",
        "--compressed",
        "--max-time",
        "60",
        "-A",
        CHROME_UA,
        "-H",
        "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "-H",
        "Accept-Language: ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "-H",
        "Cache-Control: no-cache",
        "-H",
        "Pragma: no-cache",
        "-H",
        "Referer: https://pokemoncard.co.kr/",
        "-w",
        "\n__STATUS__:%{http_code}\n__FINAL__:%{url_effective}\n",
        url,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=75)
    text = proc.stdout
    status_match = re.search(r"\n__STATUS__:(\d+)\n__FINAL__:(.*?)\n?$", text, re.S)
    if status_match:
        status = int(status_match.group(1))
        final = status_match.group(2).strip()
        body = text[: status_match.start()]
    else:
        status = 0
        final = url
        body = text
    if proc.stderr:
        body += "\nCURL_STDERR: " + proc.stderr.strip()
    return status, final, body


def summarize_html(base: str, html: str, out: list[str]) -> None:
    out.append(f"HTML_BYTES {len(html.encode('utf-8'))}")
    out.append("FORMS")
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
        urllib.parse.urljoin(base, src)
        for src in re.findall(r"<script[^>]+src=[\"']([^\"']+)", html, re.I)
    ]
    out.append("SCRIPTS")
    out.extend(scripts)
    out.append("INLINE_INTERESTING")
    for line in html.splitlines():
        low = line.lower()
        if any(k in low for k in ("ajax", "axios", "fetch(", "/cards", "loadmore", "load-more", "search")):
            clean = re.sub(r"\s+", " ", line).strip()
            if clean and len(clean) < 1500:
                out.append(clean)


def main() -> None:
    out: list[str] = []
    working_base = None
    working_html = None

    candidates = []
    for base in BASES:
        candidates.extend(
            [
                base + "/cards",
                base + "/cards?utm_source=chatgpt.com",
                base + "/",
            ]
        )

    for url in candidates:
        status, final, body = curl_get(url)
        title_match = re.search(r"<title[^>]*>(.*?)</title>", body, re.I | re.S)
        title = re.sub(r"\s+", " ", title_match.group(1)).strip() if title_match else ""
        out.append(
            f"PROBE url={url} status={status} final={final} bytes={len(body.encode('utf-8'))} title={title!r}"
        )
        if status == 200 and "/cards" in final and "카드검색" in body:
            working_base = final.split("/cards", 1)[0]
            working_html = body
            break

    if working_base and working_html:
        out.append(f"WORKING_BASE {working_base}")
        summarize_html(working_base, working_html, out)
        for key in ("OKACHEKE", "Narumi Sato"):
            for param in ("s", "keyword", "q", "search", "searchWord", "word"):
                qurl = working_base + "/cards?" + urllib.parse.urlencode({param: key})
                status, final, body = curl_get(qurl)
                details = sorted(set(re.findall(r"/cards/detail/[A-Za-z0-9_-]+", body)))
                out.append(
                    f"QUERY {param}={key!r} status={status} final={final} "
                    f"detail_count={len(details)} sample={details[:5]}"
                )
    else:
        out.append("NO_WORKING_DIRECT_ROUTE")
        out.append("GitHub-hosted runner appears unable to fetch the official site directly.")

    path = Path("tmp/pokemonkorea-probe.txt")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(out) + "\n", encoding="utf-8")
    print("\n".join(out))


if __name__ == "__main__":
    main()
