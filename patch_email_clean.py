import os

with open('app/services/email_service.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add imports
content = content.replace("import aiosmtplib\n", "import aiosmtplib\nimport httpx\nimport os\n")

# 2. Add Resend function right before `async def send(`
resend_code = """
    async def _send_via_resend(self, recipient: str, subject: str, html: str, text: str, template: str, api_key: str) -> bool:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={
                        "from": "LMS <onboarding@resend.dev>",
                        "to": recipient,
                        "subject": subject,
                        "html": html,
                        "text": text
                    }
                )
                if response.status_code in (200, 201):
                    await self._log(recipient, subject, template, EmailStatus.SENT)
                    return True
                else:
                    error_msg = f"Resend API error: {response.status_code} {response.text}"
                    logger.warning(error_msg)
                    await self._log(recipient, subject, template, EmailStatus.FAILED, error_msg)
                    return False
        except Exception as exc:
            logger.warning(f"Resend exception: {exc}")
            await self._log(recipient, subject, template, EmailStatus.FAILED, str(exc))
            return False

    async def send(self, recipient: str, subject: str, html: str, text: str, template: str = "custom") -> bool:
        resend_key = os.environ.get("RESEND_API_KEY")
        if resend_key:
            return await self._send_via_resend(recipient, subject, html, text, template, resend_key)
"""

content = content.replace(
    '    async def send(self, recipient: str, subject: str, html: str, text: str, template: str = "custom") -> bool:',
    resend_code,
    1  # ONLY REPLACE THE FIRST OCCURRENCE
)

with open('app/services/email_service.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Cleanly patched!")
