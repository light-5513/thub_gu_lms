"""Read-only smoke checks for a running LMS monolith.

Usage: python scripts/system_smoke.py [--base-url http://127.0.0.1:8000]
"""

from __future__ import annotations

import argparse
import json
import sys
from html.parser import HTMLParser
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit
from urllib.request import Request, urlopen


class AssetParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.assets: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag not in {"script", "link"}:
            return
        for name, value in attrs:
            if name in {"src", "href"} and value and "assets/" in value:
                self.assets.add(value)


def fetch(base_url: str, path: str, timeout: float) -> tuple[int, bytes, str]:
    url = urljoin(base_url + "/", path.lstrip("/"))
    request = Request(url, headers={"User-Agent": "lms-system-smoke/1.0"})
    try:
        with urlopen(request, timeout=timeout) as response:
            return response.status, response.read(), response.headers.get_content_type()
    except HTTPError as error:
        return error.code, error.read(), error.headers.get_content_type()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--timeout", type=float, default=10)
    args = parser.parse_args()

    parsed_url = urlsplit(args.base_url)
    if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
        parser.error("--base-url must be an HTTP(S) origin")
    base_url = args.base_url.rstrip("/")
    failures: list[str] = []

    def check(name: str, path: str, expected_status: int, validate=None) -> bytes:
        try:
            status, body, content_type = fetch(base_url, path, args.timeout)
            good = status == expected_status and (validate(body, content_type) if validate else True)
            print(f"{'PASS' if good else 'FAIL'} {name}: HTTP {status}")
            if not good:
                failures.append(name)
            return body
        except (URLError, TimeoutError, OSError) as error:
            print(f"FAIL {name}: {error}")
            failures.append(name)
            return b""

    def json_field(body: bytes, key: str, expected: object) -> bool:
        try:
            return json.loads(body).get(key) == expected
        except (json.JSONDecodeError, UnicodeDecodeError, AttributeError):
            return False

    check("database readiness", "/api/ready", 200, lambda body, _: json_field(body, "ready", True))
    check("database health", "/api/health", 200, lambda body, _: json_field(body, "database", "healthy"))

    def is_html(body: bytes, content_type: str) -> bool:
        return content_type == "text/html" and b"<html" in body.lower()

    index = check("frontend", "/", 200, is_html)
    check("admin SPA route", "/admin/attendance", 200, is_html)
    check("student SPA route", "/student/dashboard", 200, is_html)

    asset_parser = AssetParser()
    asset_parser.feed(index.decode("utf-8", errors="replace"))
    if not asset_parser.assets:
        print("FAIL frontend assets: index.html references no built assets")
        failures.append("frontend assets")
    local_assets = 0
    for asset in sorted(asset_parser.assets):
        # Only request assets from the app under test.
        asset_url = urljoin(base_url + "/", asset)
        if urlsplit(asset_url).netloc != parsed_url.netloc:
            continue
        local_assets += 1
        asset_path = urlsplit(asset_url).path
        extension = asset_path.rsplit(".", 1)[-1].lower()

        def is_asset(body: bytes, content_type: str) -> bool:
            if not body or content_type == "text/html":
                return False
            if extension in {"js", "mjs"}:
                return "javascript" in content_type
            if extension == "css":
                return content_type == "text/css"
            return True

        check(f"asset {asset_path}", asset_path, 200, is_asset)
    if asset_parser.assets and not local_assets:
        print("FAIL frontend assets: no local built assets were referenced")
        failures.append("frontend assets")

    check("anonymous auth guard", "/api/auth/me", 401)
    check("anonymous admin guard", "/api/admin/students", 401)

    print(f"\n{'System smoke passed' if not failures else 'System smoke failed'}"
          f" ({len(failures)} failed checks).")
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
