#!/bin/bash
set -e

echo "======================================"
echo "🚀 Playwright MCP Server - Starting"
echo "======================================"

# Verify Playwright MCP is installed
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found!"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"
echo "✅ npm version: $(npm -v)"
echo "✅ Playwright version: $(npx playwright --version)"

# Check if chromium is installed
if [ ! -d "$HOME/.cache/ms-playwright/chromium-"* ]; then
    echo "⚠️  Chromium not found, installing..."
    npx playwright install chromium
else
    echo "✅ Chromium already installed"
fi

# Start the MCP server
echo "🌐 Starting Playwright MCP Server on port 3002..."
echo "   URL will be: https://<codespace-name>-3002.app.github.dev"
echo ""

# Start the MCP server with headless mode
# This will run until the container stops
exec npx @playwright/mcp@latest \
    --headless \
    --port 3002 \
    --host 0.0.0.0 \
    --browser chromium

# Keep container alive if server crashes
# sleep infinity
