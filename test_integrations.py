import asyncio
from httpx import AsyncClient
from app.integrations import get_adapter

async def test_adapters():
    # Provide known usernames for testing
    tests = {
        "leetcode": "neetcode",
        "codechef": "gennady.korotkevich",
        "codeforces": "tourist",
        "github": "torvalds"
    }

    async with AsyncClient(timeout=10.0) as client:
        for platform, username in tests.items():
            adapter = get_adapter(platform)
            print(f"\nTesting {platform} for user {username}...")
            try:
                result = await adapter.fetch_profile(client, username)
                print(f"SUCCESS: {result}")
            except Exception as e:
                print(f"FAILED: {e}")

if __name__ == "__main__":
    asyncio.run(test_adapters())
