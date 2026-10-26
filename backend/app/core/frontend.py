"""Checks whether the mounted SPA build can serve its entry assets."""

import re
from pathlib import Path


def frontend_build_ready(dist: Path) -> bool:
    index = dist / "index.html"
    try:
        html = index.read_text(encoding="utf-8")
    except OSError:
        return False

    assets = re.findall(
        r"(?:src|href)\s*=\s*['\"]/?(assets/[^'\"?#]+)", html
    )
    if not assets:
        return False

    dist = dist.resolve()
    for asset in assets:
        path = (dist / asset).resolve()
        if not path.is_relative_to(dist) or not path.is_file():
            return False
    return True
