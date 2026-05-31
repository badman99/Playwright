#!/bin/bash
set -e

echo "======================================"
echo "🚀 Playwright MCP + zrok Tunnel"
echo "======================================"

# Verify Playwright MCP is installed
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found!"
    exit 1
fi

if ! command -v zrok &> /dev/null; then
    echo "❌ zrok not found!"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"
echo "✅ npm version: $(npm -v)"
echo "✅ Playwright version: $(npx playwright --version)"
echo "✅ zrok version: $(zrok version)"

# Check if chromium is installed
if [ ! -d "$HOME/.cache/ms-playwright/chromium-"* ]; then
    echo "⚠️  Chromium not found, installing..."
    npx playwright install chromium
else
    echo "✅ Chromium already installed"
fi

# ==========================================
# START PLAYWRIGHT MCP SERVER
# ==========================================
echo ""
echo "🌐 Starting Playwright MCP Server on port 3002..."

# Start the MCP server in background
npx @playwright/mcp@latest \
    --headless \
    --port 3002 \
    --host 0.0.0.0 \
    --browser chromium &

MCP_PID=$!
echo "✅ MCP Server started (PID: $MCP_PID)"

# Wait for MCP server to be ready
echo "⏳ Waiting for MCP server to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:3002 > /dev/null 2>&1; then
        echo "✅ MCP Server is ready!"
        break
    fi
    sleep 1
    if [ $i -eq 30 ]; then
        echo "⚠️  MCP Server may not be fully ready yet, continuing anyway..."
    fi
done

# ==========================================
# START ZROK TUNNEL
# ==========================================
echo ""
echo "🔗 Starting zrok tunnel..."
echo "   Static URL: https://playwright-mcp-static.share.zrok.io"
echo ""

# Check if reserved share exists, if not create it
if ! zrok shares list 2>/dev/null | grep -q "playwright-mcp-static"; then
    echo "   Creating reserved share..."
    zrok reserve public localhost:3002 --unique-name playwright-mcp-static || true
fi

# Start the zrok tunnel (this runs in foreground)
echo "🌍 Tunnel is live! Your MCP server is accessible at:"
echo "   https://playwright-mcp-static.share.zrok.io"
echo ""
echo "📋 Add this URL to your OpenCode config:"
echo '   {"mcp": {"playwright": {"type": "http", "url": "https://playwright-mcp-static.share.zrok.io"}}}'
echo ""

# Start zrok tunnel (foreground - keeps container alive)
exec zrok share reserved playwright-mcp-static
