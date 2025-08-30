#!/usr/bin/env python3
"""
IFC Clash Detection - Development Server Manager
A Python script to start both Flask backend and React frontend servers
"""

import os
import sys
import time
import signal
import subprocess
import argparse
from pathlib import Path

# ANSI color codes for colored output
class Colors:
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    RED = '\033[0;31m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'  # No Color

def print_status(message):
    print(f"{Colors.GREEN}[INFO]{Colors.NC} {message}")

def print_warning(message):
    print(f"{Colors.YELLOW}[WARNING]{Colors.NC} {message}")

def print_error(message):
    print(f"{Colors.RED}[ERROR]{Colors.NC} {message}")

def print_header(message):
    print(f"{Colors.BLUE}================================{Colors.NC}")
    print(f"{Colors.BLUE}{message}{Colors.NC}")
    print(f"{Colors.BLUE}================================{Colors.NC}")

def check_port(port, name):
    """Check if a port is already in use"""
    import socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.bind(('localhost', port))
        sock.close()
        return True
    except OSError:
        print_warning(f"Port {port} ({name}) is already in use")
        return False

def start_backend():
    """Start the Flask backend server"""
    print_header("Starting Flask Backend Server")

    if not check_port(5001, "Flask Backend"):
        return None

    venv_path = Path("venv/bin/activate")
    if not venv_path.exists():
        print_error("Virtual environment not found at venv/bin/activate")
        print_error("Please run: python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt")
        return None

    try:
        print_status("Activating virtual environment and starting Flask server...")
        env = os.environ.copy()
        env['PORT'] = '5001'

        process = subprocess.Popen(
            ['bash', '-c', 'source venv/bin/activate && python api/app.py'],
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        # Wait a moment and check if server started
        time.sleep(3)
        if process.poll() is None:  # Process is still running
            print_status(f"Flask backend server started successfully (PID: {process.pid})")
            print_status("Backend URL: http://localhost:5001")
            print_status("Health check: http://localhost:5001/api/health")
            return process
        else:
            stdout, stderr = process.communicate()
            print_error("Failed to start Flask backend server")
            if stderr:
                print_error(f"Error: {stderr}")
            return None

    except Exception as e:
        print_error(f"Error starting backend: {e}")
        return None

def start_frontend():
    """Start the React frontend server"""
    print_header("Starting React Frontend Server")

    if not check_port(5173, "Vite Frontend"):
        return None

    client_dir = Path("client")
    if not client_dir.exists():
        print_error("Client directory not found")
        return None

    try:
        print_status("Starting Vite development server...")

        # Check if node_modules exists
        if not (client_dir / "node_modules").exists():
            print_warning("node_modules not found. Installing dependencies...")
            result = subprocess.run(
                ["npm", "install"],
                cwd=client_dir,
                capture_output=True,
                text=True
            )
            if result.returncode != 0:
                print_error("Failed to install npm dependencies")
                print_error(result.stderr)
                return None

        process = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=client_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        # Wait a moment and check if server started
        time.sleep(5)
        if process.poll() is None:  # Process is still running
            print_status(f"React frontend server started successfully (PID: {process.pid})")
            print_status("Frontend URL: http://localhost:5173")
            return process
        else:
            stdout, stderr = process.communicate()
            print_error("Failed to start React frontend server")
            if stderr:
                print_error(f"Error: {stderr}")
            return None

    except Exception as e:
        print_error(f"Error starting frontend: {e}")
        return None

def main():
    parser = argparse.ArgumentParser(
        description='IFC Clash Detection - Development Server Manager'
    )
    parser.add_argument(
        '-b', '--backend-only',
        action='store_true',
        help='Start only the backend server'
    )
    parser.add_argument(
        '-f', '--frontend-only',
        action='store_true',
        help='Start only the frontend server'
    )

    args = parser.parse_args()

    # Check if we're in the right directory
    if not Path("api/app.py").exists() or not Path("client").exists():
        print_error("Please run this script from the project root directory")
        print_error("Required files/directories not found: api/app.py, client/")
        sys.exit(1)

    print_header("IFC Clash Detection Development Environment")

    processes = []
    backend_process = None
    frontend_process = None

    def cleanup(signum=None, frame=None):
        """Clean up running processes"""
        print_header("Cleaning up servers")
        for proc in processes:
            if proc and proc.poll() is None:
                print_status(f"Stopping process (PID: {proc.pid})")
                proc.terminate()
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    proc.kill()
        print_status("Cleanup complete")
        sys.exit(0)

    # Set up signal handlers
    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    try:
        # Start servers based on arguments
        if args.backend_only:
            backend_process = start_backend()
            if backend_process:
                processes.append(backend_process)
                print_status("Backend server is running. Press Ctrl+C to stop.")
                backend_process.wait()
        elif args.frontend_only:
            frontend_process = start_frontend()
            if frontend_process:
                processes.append(frontend_process)
                print_status("Frontend server is running. Press Ctrl+C to stop.")
                frontend_process.wait()
        else:
            # Start both servers
            backend_process = start_backend()
            frontend_process = start_frontend()

            if backend_process:
                processes.append(backend_process)
            if frontend_process:
                processes.append(frontend_process)

            # Check results
            if backend_process and frontend_process:
                print_status("Both servers started successfully!")
                print_status("")
                print_status("🌐 Frontend: http://localhost:5173")
                print_status("🔧 Backend:  http://localhost:5001")
                print_status("💚 Health:   http://localhost:5001/api/health")
                print_status("")
                print_status("Press Ctrl+C to stop both servers")

                # Wait for either process to exit
                while processes:
                    for proc in processes[:]:
                        if proc.poll() is not None:
                            processes.remove(proc)
                            print_warning(f"Process {proc.pid} exited")
                    if processes:
                        time.sleep(1)

            elif backend_process:
                print_warning("Only backend server started. Frontend failed.")
                backend_process.wait()
            elif frontend_process:
                print_warning("Only frontend server started. Backend failed.")
                frontend_process.wait()
            else:
                print_error("Failed to start both servers")
                sys.exit(1)

    except KeyboardInterrupt:
        cleanup()
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        cleanup()

if __name__ == "__main__":
    main()
