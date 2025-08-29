FROM python:3.12-slim

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
COPY static/ ./static/

ENV PORT=8080
EXPOSE 8080

CMD ["gunicorn", "--bind", "0.0.0.0:8080", "api.app:app", "--workers", "2", "--threads", "4", "--timeout", "300"]


