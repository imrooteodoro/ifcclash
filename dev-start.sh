#!/bin/bash

# IFC Clash Detection - Development Startup Script
# This script starts both the Flask backend and React frontend development servers

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

# Function to check if a port is in use
check_port() {
    local port=$1
    local name=$2
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        print_warning "Port $port ($name) is already in use. Skipping..."
        return 1
    fi
    return 0
}

# Function to start backend server
start_backend() {
    print_header "Starting Flask Backend Server"

    # Check if port 5001 is available
    if ! check_port 5001 "Flask Backend"; then
        return 1
    fi

    # Check if virtual environment exists
    if [ ! -d "venv" ]; then
        print_error "Virtual environment not found. Please run setup first."
        return 1
    fi

    # Activate virtual environment and start backend
    print_status "Activating virtual environment..."
    source venv/bin/activate

    print_status "Starting Flask server on port 5001..."
    export PORT=5001

    # Start Flask server in background
    python api/app.py &
    BACKEND_PID=$!

    # Wait a moment and check if server started successfully
    sleep 3
    if kill -0 $BACKEND_PID 2>/dev/null; then
        print_status "Flask backend server started successfully (PID: $BACKEND_PID)"
        print_status "Backend URL: http://localhost:5001"
        print_status "Health check: http://localhost:5001/api/health"
        return 0
    else
        print_error "Failed to start Flask backend server"
        return 1
    fi
}

# Function to start frontend server
start_frontend() {
    print_header "Starting React Frontend Server"

    # Check if port 5173 is available
    if ! check_port 5173 "Vite Frontend"; then
        return 1
    fi

    # Check if we're in the right directory and node_modules exists
    if [ ! -d "client" ]; then
        print_error "Client directory not found"
        return 1
    fi

    cd client

    if [ ! -d "node_modules" ]; then
        print_warning "node_modules not found. Installing dependencies..."
        npm install
    fi

    print_status "Starting Vite development server..."

    # Start frontend server in background
    npm run dev &
    FRONTEND_PID=$!

    # Wait a moment and check if server started successfully
    sleep 5
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        print_status "React frontend server started successfully (PID: $FRONTEND_PID)"
        print_status "Frontend URL: http://localhost:5173"
        return 0
    else
        print_error "Failed to start React frontend server"
        return 1
    fi
}

# Function to cleanup background processes
cleanup() {
    print_header "Cleaning up servers"

    if [ ! -z "$BACKEND_PID" ] && kill -0 $BACKEND_PID 2>/dev/null; then
        print_status "Stopping Flask backend server (PID: $BACKEND_PID)"
        kill $BACKEND_PID 2>/dev/null || true
    fi

    if [ ! -z "$FRONTEND_PID" ] && kill -0 $FRONTEND_PID 2>/dev/null; then
        print_status "Stopping React frontend server (PID: $FRONTEND_PID)"
        kill $FRONTEND_PID 2>/dev/null || true
    fi

    print_status "Cleanup complete"
    exit 0
}

# Function to show help
show_help() {
    echo "IFC Clash Detection - Development Startup Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -b, --backend-only    Start only the backend server"
    echo "  -f, --frontend-only   Start only the frontend server"
    echo "  -h, --help           Show this help message"
    echo ""
    echo "Without options, starts both servers."
    echo ""
    echo "Examples:"
    echo "  $0                    # Start both servers"
    echo "  $0 --backend-only    # Start only backend"
    echo "  $0 --frontend-only   # Start only frontend"
}

# Parse command line arguments
BACKEND_ONLY=false
FRONTEND_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -b|--backend-only)
            BACKEND_ONLY=true
            shift
            ;;
        -f|--frontend-only)
            FRONTEND_ONLY=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Set up signal handlers for cleanup
trap cleanup SIGINT SIGTERM

# Main execution
print_header "IFC Clash Detection Development Environment"

# Check if we're in the right directory
if [ ! -f "api/app.py" ] || [ ! -d "client" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Determine what to start
if [ "$BACKEND_ONLY" = true ]; then
    if start_backend; then
        print_status "Backend server is running. Press Ctrl+C to stop."
        wait $BACKEND_PID
    fi
elif [ "$FRONTEND_ONLY" = true ]; then
    if start_frontend; then
        print_status "Frontend server is running. Press Ctrl+C to stop."
        wait $FRONTEND_PID
    fi
else
    # Start both servers
    BACKEND_SUCCESS=false
    FRONTEND_SUCCESS=false

    if start_backend; then
        BACKEND_SUCCESS=true
    fi

    if start_frontend; then
        FRONTEND_SUCCESS=true
    fi

    # Check results
    if [ "$BACKEND_SUCCESS" = true ] && [ "$FRONTEND_SUCCESS" = true ]; then
        print_status "Both servers started successfully!"
        print_status ""
        print_status "🌐 Frontend: http://localhost:5173"
        print_status "🔧 Backend:  http://localhost:5001"
        print_status "💚 Health:   http://localhost:5001/api/health"
        print_status ""
        print_status "Press Ctrl+C to stop both servers"
        wait
    elif [ "$BACKEND_SUCCESS" = true ]; then
        print_warning "Only backend server started. Frontend failed."
        print_status "Press Ctrl+C to stop the backend server"
        wait $BACKEND_PID
    elif [ "$FRONTEND_SUCCESS" = true ]; then
        print_warning "Only frontend server started. Backend failed."
        print_status "Press Ctrl+C to stop the frontend server"
        wait $FRONTEND_PID
    else
        print_error "Failed to start both servers. Please check the error messages above."
        exit 1
    fi
fi
