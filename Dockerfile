# Unified IFC Clash Detection App for Sevalla
FROM node:18-alpine AS frontend-build

# Build Next.js frontend
WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Python stage for API
FROM python:3.11-slim

# Install system dependencies for IfcOpenShell
RUN apt-get update && apt-get install -y \
    build-essential \
    libgeos-dev \
    libgdal-dev \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Python requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy API code
COPY api/ ./api/

# Copy built Next.js frontend
COPY --from=frontend-build /app/out ./out
COPY --from=frontend-build /app/public ./public
COPY --from=frontend-build /app/package.json ./

# Create a simple server script to serve both frontend and API
RUN echo '#!/usr/bin/env python3\nfrom api.clash import app\nimport os\n\nif __name__ == "__main__":\n    port = int(os.environ.get("PORT", 8080))\n    app.run(host="0.0.0.0", port=port, debug=False)' > start.py && chmod +x start.py

EXPOSE 8080

CMD ["python", "start.py"]
