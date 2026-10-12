#!/bin/bash
# SENTI-MIND startup script (Linux compatible)

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo "========================================"
echo "  SENTI-MIND Mental Health Analyzer"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BACKEND_URL="http://127.0.0.1:8000"
FRONTEND_URL="http://127.0.0.1:5173"

# Function to check if a port is in use
check_port() {
    lsof -i:$1 > /dev/null 2>&1
}

# Function to cleanup processes on exit
cleanup() {
    echo ""
    echo "Shutting down services..."
    if [ -n "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
        echo "Backend stopped"
    fi
    if [ -n "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
        echo "Frontend stopped"
    fi
    exit 0
}

trap cleanup INT TERM

# Python 3.11 or 3.12 is required (core ML deps do not support <=3.10 or 3.14+).
is_supported_python() {
    "$1" -c 'import sys; sys.exit(0 if sys.version_info[:2] in ((3, 11), (3, 12)) else 1)' > /dev/null 2>&1
}

find_python() {
    for candidate in python3.12 python3.11 python3; do
        if command -v "$candidate" > /dev/null 2>&1 && is_supported_python "$candidate"; then
            echo "$candidate"
            return 0
        fi
    done
    return 1
}

VENV_DIR="backend/.venv"
VENV_PY="$VENV_DIR/bin/python"
REQ_STAMP="$VENV_DIR/.requirements.sha256"

# Check and install backend dependencies
echo -e "${YELLOW}Checking backend environment...${NC}"
if [ -x "$VENV_PY" ] && ! is_supported_python "$VENV_PY"; then
    echo -e "${RED}$VENV_DIR uses Python $("$VENV_PY" -c 'import platform; print(platform.python_version())'), but 3.11 or 3.12 is required.${NC}"
    echo -e "${RED}Delete $VENV_DIR and re-run this script.${NC}"
    exit 1
fi

if [ ! -x "$VENV_PY" ]; then
    echo -e "${YELLOW}Creating backend virtual environment...${NC}"
    if command -v uv > /dev/null 2>&1; then
        PY_VERSION="$(cat backend/.python-version 2>/dev/null || echo 3.11)"
        uv venv --python "$PY_VERSION" "$VENV_DIR" || exit 1
    else
        PYTHON_BIN="$(find_python)"
        if [ -z "$PYTHON_BIN" ]; then
            echo -e "${RED}No supported Python found. SentiMind needs Python 3.11 or 3.12${NC}"
            echo -e "${RED}(tried python3.12, python3.11, python3). Install one, or install uv${NC}"
            echo -e "${RED}(https://docs.astral.sh/uv/) so it can fetch the right version.${NC}"
            exit 1
        fi
        echo "Using $PYTHON_BIN ($("$PYTHON_BIN" --version 2>&1))"
        "$PYTHON_BIN" -m venv "$VENV_DIR" || exit 1
    fi
fi

# (Re)install dependencies when requirements.txt changed since the last install.
REQ_HASH="$(sha256sum backend/requirements.txt | cut -d' ' -f1)"
if [ "$(cat "$REQ_STAMP" 2>/dev/null)" != "$REQ_HASH" ]; then
    echo -e "${YELLOW}Installing python dependencies (includes the spaCy model)...${NC}"
    if command -v uv > /dev/null 2>&1; then
        uv pip install --python "$VENV_PY" -r backend/requirements.txt || exit 1
    else
        "$VENV_PY" -m pip install -r backend/requirements.txt || exit 1
    fi
    echo "$REQ_HASH" > "$REQ_STAMP"
    echo -e "${GREEN}Backend setup complete!${NC}"
fi

# Ensure .env exists at the repo root (shared by backend and frontend)
if [ ! -f "$PROJECT_DIR/.env" ] && [ -f "$PROJECT_DIR/.env.example" ]; then
    echo -e "${YELLOW}Creating .env from .env.example...${NC}"
    cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
    echo -e "${RED}IMPORTANT: Fill in .env (Supabase keys, HF_API_TOKEN, OPENROUTER_API_KEY) before using the app.${NC}"
fi

# Check and install frontend dependencies
echo -e "${YELLOW}Checking frontend environment...${NC}"
if [ ! -d "frontend/node_modules" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    cd frontend
    npm install
    cd ..
    echo -e "${GREEN}Frontend setup complete!${NC}"
fi

echo "Checking services..."
echo ""

# Start Backend
if check_port 8000; then
    echo -e "${YELLOW}Backend already running on port 8000${NC}"
else
    echo -e "${GREEN}Starting backend...${NC}"
    cd backend
    .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 &
    BACKEND_PID=$!
    cd ..
    echo -e "${GREEN}Backend PID: $BACKEND_PID${NC}"

    # Wait for backend to be ready
    echo -n "Waiting for backend..."
    for i in {1..30}; do
        if curl -s http://127.0.0.1:8000/health > /dev/null 2>&1; then
            echo -e " ${GREEN}Ready!${NC}"
            break
        fi
        echo -n "."
        sleep 0.5
    done
    echo ""
fi

echo ""

# Start Frontend
if check_port 5173; then
    echo -e "${YELLOW}Frontend already running on port 5173${NC}"
else
    echo -e "${GREEN}Starting frontend...${NC}"
    cd frontend
    npm run dev &
    FRONTEND_PID=$!
    cd ..
    echo -e "${GREEN}Frontend PID: $FRONTEND_PID${NC}"

    # Wait for frontend
    echo -n "Waiting for frontend..."
    for i in {1..30}; do
        if curl -s http://127.0.0.1:5173 > /dev/null 2>&1; then
            echo -e " ${GREEN}Ready!${NC}"
            break
        fi
        echo -n "."
        sleep 0.5
    done
    echo ""
fi

echo ""
echo "========================================"
echo -e "${GREEN}All services running!${NC}"
echo "========================================"
echo ""
echo "Backend API:  $BACKEND_URL"
echo "API Docs:     $BACKEND_URL/docs"
echo "Frontend:     $FRONTEND_URL"
echo ""
echo -e "Open ${YELLOW}$FRONTEND_URL${NC} in your browser"
echo ""
echo "Press Ctrl+C to stop all services"
echo "========================================"

# Keep script running
tail -f /dev/null &
TAIL_PID=$!
wait $TAIL_PID
