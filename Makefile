# IFC Clash Detection - Development Makefile
# Simple make targets for development setup

.PHONY: help setup dev dev-shell dev-py backend frontend clean

# Default target
help:
	@echo "IFC Clash Detection - Development Commands"
	@echo ""
	@echo "Available targets:"
	@echo "  setup      - Set up development environment"
	@echo "  dev        - Start both servers (Shell script)"
	@echo "  dev-py     - Start both servers (Python script)"
	@echo "  backend    - Start backend server only"
	@echo "  frontend   - Start frontend server only"
	@echo "  clean      - Clean up processes and temporary files"
	@echo ""
	@echo "Examples:"
	@echo "  make dev          # Start both servers"
	@echo "  make setup        # Initial setup"
	@echo "  make backend      # Backend only"

# Setup development environment
setup:
	@echo "Setting up development environment..."
	# Create virtual environment if it doesn't exist
	@if [ ! -d "venv" ]; then \
		echo "Creating virtual environment..."; \
		python3 -m venv venv; \
	fi
	@echo "Activating virtual environment and installing dependencies..."
	@source venv/bin/activate && pip install -r requirements.txt
	@echo "Installing Node.js dependencies..."
	@cd client && npm install && cd ..
	@echo "Setup complete! Run 'make dev' to start development servers."

# Start both servers using shell script
dev:
	@echo "Starting both servers..."
	@./dev-start.sh

# Start both servers using Python script
dev-py:
	@echo "Starting both servers (Python)..."
	@python3 dev.py

# Start backend server only
backend:
	@echo "Starting backend server..."
	@./dev-start.sh --backend-only

# Start frontend server only
frontend:
	@echo "Starting frontend server..."
	@./dev-start.sh --frontend-only

# Clean up
clean:
	@echo "Cleaning up..."
	# Kill any running Python processes
	@-pkill -f "python api/app.py" 2>/dev/null || true
	# Kill any running Node processes
	@-pkill -f "vite" 2>/dev/null || true
	@-pkill -f "npm.*dev" 2>/dev/null || true
	@echo "Cleanup complete."
