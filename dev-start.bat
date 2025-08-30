@echo off
REM IFC Clash Detection - Development Startup Script (Windows)
REM This script starts both the Flask backend and React frontend development servers

REM Colors (using Windows color codes)
set "GREEN=[92m"
set "YELLOW=[93m"
set "RED=[91m"
set "BLUE=[94m"
set "NC=[0m"

echo Starting IFC Clash Detection Development Environment...
echo.

REM Check if we're in the right directory
if not exist "api\app.py" (
    echo [91mERROR[0m Please run this script from the project root directory
    pause
    exit /b 1
)

if not exist "client" (
    echo [91mERROR[0m Client directory not found
    pause
    exit /b 1
)

REM Check if virtual environment exists
if not exist "venv\Scripts\activate.bat" (
    echo [93mWARNING[0m Virtual environment not found.
    echo Please run: python -m venv venv ^& venv\Scripts\activate ^& pip install -r requirements.txt
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "client\node_modules" (
    echo [93mWARNING[0m node_modules not found. Installing dependencies...
    cd client
    call npm install
    cd ..
    if errorlevel 1 (
        echo [91mERROR[0m Failed to install npm dependencies
        pause
        exit /b 1
    )
)

echo [92mINFO[0m Starting Flask backend server...
start "Flask Backend" cmd /k "venv\Scripts\activate.bat && set PORT=5001 && python api/app.py"

timeout /t 3 /nobreak > nul

echo [92mINFO[0m Starting React frontend server...
cd client
start "React Frontend" cmd /k "npm run dev"
cd ..

echo.
echo [92mSUCCESS[0m Development servers started!
echo.
echo 🌐 Frontend: http://localhost:5173
echo 🔧 Backend:  http://localhost:5001
echo 💚 Health:   http://localhost:5001/api/health
echo.
echo Press any key to exit...
pause > nul
