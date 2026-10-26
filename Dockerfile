FROM python:3.11-slim AS backend-builder

WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

FROM node:20-bookworm-slim AS whatsapp-builder
WORKDIR /app/whatsapp-api
COPY whatsapp-api/package.json whatsapp-api/package-lock.json ./
RUN PUPPETEER_SKIP_DOWNLOAD=true npm ci --omit=dev --no-audit --no-fund

FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM python:3.11-slim
WORKDIR /app

# Include the headless browser used by whatsapp-web.js in this same Render
# service. The WhatsApp API listens only on the container's internal port.
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    fonts-liberation \
    libatomic1 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=whatsapp-builder /usr/local/bin/node /usr/local/bin/node

# Copy installed python packages
COPY --from=backend-builder /usr/local/lib/python3.11/site-packages/ /usr/local/lib/python3.11/site-packages/
COPY --from=backend-builder /usr/local/bin/ /usr/local/bin/

# Copy application code
COPY backend/ backend/
COPY run.py .
COPY container_start.py .
COPY --from=whatsapp-builder /app/whatsapp-api/node_modules/ whatsapp-api/node_modules/
COPY whatsapp-api/server.js whatsapp-api/server.js

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist/ frontend/dist/

# Set environment variables for production
ENV PYTHONUNBUFFERED=1 \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    WHATSAPP_API_PORT=10001 \
    NODE_OPTIONS=--max-old-space-size=128
ENV PORT=8080

EXPOSE 8080

CMD ["python", "container_start.py"]
