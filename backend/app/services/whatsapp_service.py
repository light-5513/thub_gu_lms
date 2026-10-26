import httpx
from app.core.logging import get_logger
from app.config import settings

logger = get_logger(__name__)

class WhatsAppService:
    @staticmethod
    async def send_message(phone: str, text: str) -> bool:
        """
        Sends a WhatsApp message via the OpenWA API.
        Automatically formats the phone number with the `@c.us` suffix if missing.
        """
        if not settings.OPENWA_URL:
            logger.warning("WhatsApp message not sent; OPENWA_URL is not configured.")
            return False

        if not phone:
            logger.warning("WhatsApp message not sent; phone number is missing.")
            return False

        # Clean phone number: remove any non-digit characters
        clean_phone = "".join(filter(str.isdigit, phone))
        
        # Ensure it has the correct chat ID format
        chat_id = clean_phone
        if not chat_id.endswith("@c.us"):
            chat_id = f"{chat_id}@c.us"

        payload = {
            "chatId": chat_id,
            "text": text,
            "session": "default"
        }
        
        headers = {"Content-Type": "application/json"}
        if settings.OPENWA_API_KEY:
            headers["Authorization"] = f"Bearer {settings.OPENWA_API_KEY}"
            headers["api_key"] = settings.OPENWA_API_KEY # sometimes provided directly in header

        try:
            url = f"{settings.OPENWA_URL.rstrip('/')}/api/sendText"
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, headers=headers, timeout=10.0)
                
                if response.status_code in (200, 201):
                    logger.info("Successfully sent WhatsApp message to %s", clean_phone)
                    return True
                else:
                    logger.error("Failed to send WhatsApp message to %s: HTTP %s %s", clean_phone, response.status_code, response.text)
                    return False
        except Exception as exc:
            logger.exception("Exception occurred while sending WhatsApp message to %s: %s", clean_phone, exc)
            return False
