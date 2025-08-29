# IFC Clash Detection (Flask + Sevalla)

## Run locally

```bash
python3.10 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python api/app.py
# open http://localhost:8080
```

## Deploy on Sevalla
- Connect repo
- Service type: Docker (auto)
- Health check: /api/health

## Notes
- ifcopenshell pinned to 0.7.0 (stable manylinux)
- Python 3.10 base image for compatibility


