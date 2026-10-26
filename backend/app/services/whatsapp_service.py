import httpx

from app.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def _service_url() -> str | None:
    base_url = settings.WHATSAPP_API_URL
    if not base_url:
        return None
    url = base_url.strip().rstrip("/")
    return url if url.startswith(("http://", "https://")) else f"http://{url}"


def _headers() -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if settings.WHATSAPP_API_TOKEN:
        headers["Authorization"] = f"Bearer {settings.WHATSAPP_API_TOKEN}"
    return headers


class WhatsAppService:
    @staticmethod
    async def _queue_message(
        phone: str,
        text: str,
        *,
        invitation_id: str | None = None,
        expires_at=None,
    ) -> dict | None:
        url = _service_url()
        if not url:
            logger.warning("WhatsApp message not sent; WHATSAPP_API_URL is not configured.")
            return None
        if not phone:
            logger.warning("WhatsApp message not sent; phone number is missing.")
            return None

        clean_phone = "".join(char for char in phone if char.isdigit())
        if not 8 <= len(clean_phone) <= 15:
            logger.warning("WhatsApp message not sent; phone number is not in international format.")
            return None

        payload = {"phone": clean_phone, "text": text}
        if invitation_id:
            payload["invitation_id"] = invitation_id
        if expires_at:
            payload["expires_at"] = expires_at.isoformat()

        try:
            # A Free Render WhatsApp service may need about a minute to wake.
            async with httpx.AsyncClient(timeout=90.0) as client:
                response = await client.post(
                    f"{url}/send",
                    json=payload,
                    headers=_headers(),
                )
            if response.status_code in (200, 202):
                result = response.json()
                logger.info("Queued WhatsApp message for %s", clean_phone)
                return result
            logger.error(
                "WhatsApp queue failed for %s: HTTP %s %s",
                clean_phone,
                response.status_code,
                response.text[:300],
            )
            return None
        except Exception as exc:
            logger.exception("Exception queueing WhatsApp message for %s: %s", clean_phone, exc)
            return None

    @staticmethod
    async def send_message(phone: str, text: str) -> bool:
        """Queue a WhatsApp message through the whatsapp-web.js service."""
        return await WhatsAppService._queue_message(phone, text) is not None

    @staticmethod
    async def queue_invitation(
        phone: str, text: str, invitation_id: str, expires_at
    ) -> str | None:
        """Queue an invitation and associate delivery status with its database record."""
        result = await WhatsAppService._queue_message(
            phone,
            text,
            invitation_id=invitation_id,
            expires_at=expires_at,
        )
        return result.get("job_id") if result else None

    @staticmethod
    async def connection_status() -> dict:
        url = _service_url()
        if not url:
            return {"configured": False, "state": "unconfigured", "qr_data_url": None}
        try:
            # Status requests also wake a sleeping Free Render service. Keep
            # this short so the UI can poll again while Render is starting it.
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.get(f"{url}/status", headers=_headers())
            response.raise_for_status()
            return {"configured": True, **response.json()}
        except Exception as exc:
            logger.warning("Could not read WhatsApp connection status: %s", exc)
            return {
                "configured": True,
                "state": "unavailable",
                "qr_data_url": None,
                "error": "Could not reach the WhatsApp service. It may be waking up; wait a moment and try again.",
            }
