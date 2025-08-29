FROM node:18-alpine AS ui
WORKDIR /ui
COPY client/package*.json ./
RUN npm install --no-audit --no-fund
COPY client/ .
RUN npm run build

FROM python:3.10-slim

# System deps for ifcopenshell (GEOS/GDAL often required)
RUN apt-get update && apt-get install -y \
    build-essential \
    libgeos-dev \
    libgdal-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY api/ ./api/
COPY --from=ui /static ./static

ENV PORT=8080
EXPOSE 8080

CMD ["gunicorn", "--bind", "0.0.0.0:8080", "api.app:app", "--workers", "2", "--threads", "4", "--timeout", "300"]
