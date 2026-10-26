"""GeeksForGeeks adapter.

GeeksForGeeks does not provide an official public profile API suitable for
third-party sync. The adapter implements the standard interface but raises
AdapterNotConfigured with a clear message so the sync engine logs a clear
failure rather than silently recording a successful empty sync.
See CODING_INTEGRATIONS.md for what would be required to enable this
(unofficial scraping is fragile and may violate the platform's TOS).
"""

from typing import Any

from app.integrations.base import AdapterNotConfigured, CodingPlatformAdapter


class GeeksForGeeksAdapter(CodingPlatformAdapter):
    name = "geeksforgeeks"
    display_name = "GeeksForGeeks"

    async def fetch_profile(self, username: str) -> dict[str, Any]:
        raise AdapterNotConfigured(
            "GeeksForGeeks does not provide a public profile API. "
            "The profile URL is still stored but stats cannot be synced."
        )

    async def normalize(self, data: dict[str, Any]) -> dict[str, Any]:
        return {}

    def profile_url(self, username: str) -> str:
        return f"https://auth.geeksforgeeks.org/user/{username}/"
