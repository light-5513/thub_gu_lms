import re
import os

with open('app/services/email_service.py', 'r', encoding='utf-8') as f:
    content = f.read()

import_statement = "import aiosmtplib\nimport httpx\nimport os"
content = content.replace("import aiosmtplib", import_statement)

resend_method = """
    async def _send_via_resend(self, recipient: str, subject: str, html: str, text: str, template: str, api_key: str) -> bool:
        \"\"\"Send email using Resend HTTP API to bypass Render SMTP blocks.\"\"\"
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={
                        "from": settings.SMTP_FROM or "Acme <onboarding@resend.dev>",
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
                    import logging
                    logging.getLogger(__name__).warning(error_msg)
                    await self._log(recipient, subject, template, EmailStatus.FAILED, error_msg)
                    return False
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning(f"Resend exception: {exc}")
            await self._log(recipient, subject, template, EmailStatus.FAILED, str(exc))
            return False

    async def send"""

content = content.replace("    async def send", resend_method)

send_start = """    async def send(self, recipient: str, subject: str, html: str, text: str, template: str = "custom") -> bool:
        \"\"\"Send immediately via SMTP or Resend API.\"\"\"
        resend_key = os.environ.get("RESEND_API_KEY")
        if resend_key:
            return await self._send_via_resend(recipient, subject, html, text, template, resend_key)
"""

# Replace the beginning of send
old_send_start = """    async def send(self, recipient: str, subject: str, html: str, text: str, template: str = "custom") -> bool:
        \"\"\"Send immediately via SMTP with retries. Returns success.\"\"\""""

content = content.replace(old_send_start, send_start)

with open('app/services/email_service.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated email_service.py")
