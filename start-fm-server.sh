#!/bin/bash

# Navigate to project directory
cd /home/keith/ai/federated-memory

# Kill any existing processes
pkill -f "tsx watch src/index.ts" 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Remove lock file
rm -f .server.lock

# Wait for cleanup
sleep 2

# Start server without tsx watch (to avoid multiple restarts)
echo "Starting Federated Memory Server..."
node_modules/.bin/tsx src/index.ts