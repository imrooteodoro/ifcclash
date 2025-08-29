# IFC Clash Detection (Flask + Sevalla)

## Run locally

```bash
python3.10 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python api/app.py
# open http://localhost:8080
```

## Deploy on Sevalla (Nixpacks)
- Connect repo
- Ensure Procfile exists
- Health check: /api/health

## Notes
- ifcopenshell/ifcclash pinned to 0.8.3.post1
- Python 3.10 recommended for maximum wheel compatibility


