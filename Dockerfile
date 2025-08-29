FROM node:18-alpine AS ui
WORKDIR /ui
COPY client/package*.json ./
RUN npm install --no-audit --no-fund
COPY client/ .
RUN npm run build

FROM aecgeeks/ifcopenshell:latest

WORKDIR /app

RUN python3 -m ensurepip --upgrade || true

COPY requirements.txt .
RUN python3 -m pip install --no-cache-dir --upgrade pip && \
    python3 -m pip install --no-cache-dir -r requirements.txt

COPY api/ ./api/
COPY --from=ui /ui/../static ./static

ENV PORT=8080
EXPOSE 8080

CMD ["gunicorn", "--bind", "0.0.0.0:8080", "api.app:app", "--workers", "2", "--threads", "4", "--timeout", "300"]
