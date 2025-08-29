# Multi-stage build for IFC processing on Sevalla
FROM python:3.11-slim

# Install system dependencies for IfcOpenShell
RUN apt-get update && apt-get install -y \
    build-essential \
    libgeos-dev \
    libgdal-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install Python requirements first (for better caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy API code
COPY api/ ./api/

# Expose port for Flask
EXPOSE 5000

# Start the Flask app
CMD ["python", "api/clash.py"]
