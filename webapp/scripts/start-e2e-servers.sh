#!/bin/bash
# Start both API server and Vite dev server for E2E testing

# Get the project root directory (parent of webapp/)
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Start API server in background with BYPASS_INIT_DATA=true
cd "$ROOT_DIR"
NODE_ENV=development BYPASS_INIT_DATA=true node src/api/server.mjs > /tmp/api-e2e.log 2>&1 &
API_PID=$!
echo "API Server PID: $API_PID"

# Wait for API server to be ready
sleep 3

# Start Vite dev server
cd "$ROOT_DIR/webapp"
npx vite --port 5173 --strictPort

# Cleanup on exit
kill $API_PID 2>/dev/null || true
