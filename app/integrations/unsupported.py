"""HackerRank / HackerEarth adapters.

Neither platform offers an official public profile API suitable for
third-party sync. These adapters implement the standard interface but raise
AdapterNotConfigured with a clear message so the sync engine skips them
gracefully. See CODING_INTEGRATIONS.md for what would be required to enable
them (official partnership/API access or credential-based auth).
"""

from typing import Any

from app.integrations.base import AdapterNotConfigured, CodingPlatformAdapter


class HackerRankAdapter(CodingPlatformAdapter):
    name = "hackerrank"
    display_name = "HackerRank"

    async def fetch_profile(self, username: str) -> dict[str, Any]:
        raise AdapterNotConfigured(
            "HackerRank does not provide a public profile API. "
            "Configure an official API key to enable this integration."
        )

    async def normalize(self, data: dict[str, Any]) -> dict[str, Any]:
        return {}

    def profile_url(self, username: str) -> str:
        return f"https://www.hackerrank.com/profile/{username}"


class HackerEarthAdapter(CodingPlatformAdapter):
    name = "hackerearth"
    display_name = "HackerEarth"

    async def fetch_profile(self, username: str) -> dict[str, Any]:
        raise AdapterNotConfigured(
            "HackerEarth does not provide a public profile API. "
            "Configure an official API key to enable this integration."
        )

    async def normalize(self, data: dict[str, Any]) -> dict[str, Any]:
        return {}

    def profile_url(self, username: str) -> str:
        return f"https://www.hackerearth.com/@{username}"
