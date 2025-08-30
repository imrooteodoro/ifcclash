# IFC Clash Detection (Flask + React)

## Quick Start - One Command

The easiest way to start development:

```bash
# From project root
./dev-start.sh
```

Or using Python:
```bash
python3 dev.py
```

This starts both servers:
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:5001

## Manual Setup

### Prerequisites
```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Install Node.js dependencies
cd client && npm install && cd ..
```

### Start Servers Individually

**Backend Only:**
```bash
source venv/bin/activate
PORT=5001 python api/app.py
```

**Frontend Only:**
```bash
cd client
npm run dev
```

### Using npm scripts (from client directory)

```bash
# Start both servers
npm run dev:full

# Start backend only
npm run dev:backend

# Start frontend only
npm run dev:frontend
```

### Using Make (Unix/Linux/macOS)

```bash
# Start both servers
make dev

# Initial setup
make setup

# Start individual servers
make backend
make frontend

# Clean up processes
make clean
```

### Advanced Options

**Shell Script Options:**
```bash
# Start both servers
./dev-start.sh

# Start backend only
./dev-start.sh --backend-only

# Start frontend only
./dev-start.sh --frontend-only

# Show help
./dev-start.sh --help
```

**Python Script Options:**
```bash
# Start both servers
python3 dev.py

# Start backend only
python3 dev.py --backend-only

# Start frontend only
python3 dev.py --frontend-only
```

**Windows Users:**
```cmd
# Use the batch file
dev-start.bat
```

## Deploy on Sevalla (Nixpacks)
- Connect repo
- Ensure Procfile exists
- Health check: /api/health

## Notes
- ifcopenshell/ifcclash pinned to 0.8.3.post1
- Python 3.10 recommended for maximum wheel compatibility


