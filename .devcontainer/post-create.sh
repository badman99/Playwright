#!/bin/bash
set -e

echo "======================================"
echo "🔧 Playwright MCP + zrok Tunnel Setup"
echo "======================================"

# Ensure scripts are executable
chmod +x /workspaces/Playwright/scripts/*.sh

# Install any additional dependencies if package.json exists
if [ -f "/workspaces/Playwright/package.json" ]; then
    echo "📦 Installing project dependencies..."
    cd /workspaces/Playwright && npm install
fi

# Verify Playwright browsers are available
echo "🔍 Verifying Playwright installation..."
npx playwright install chromium || true

# ==========================================
# ZROK SETUP
# ==========================================
echo ""
echo "🌐 Setting up zrok tunnel..."

# Check if zrok is installed
if ! command -v zrok &> /dev/null; then
    echo "❌ zrok not found!"
    exit 1
fi

echo "✅ zrok version: $(zrok version)"

# Enable zrok environment (if not already enabled)
if [ ! -f "$HOME/.zrok/environment.json" ]; then
    echo "🔑 Enabling zrok environment..."
    # Token can be overridden via ZROK_TOKEN env var
    ZROK_TOKEN="${ZROK_TOKEN:-jphzLUZd8sIM}"
    echo "$ZROK_TOKEN" | zrok enable
    echo "✅ zrok environment enabled!"
else
    echo "✅ zrok environment already enabled"
fi

# Reserve a static share (one-time setup, idempotent)
echo "🔗 Reserving static zrok share..."
if ! zrok shares list 2>/dev/null | grep -q "playwright-mcp-static"; then
    echo "   Creating new reserved share: playwright-mcp-static"
    zrok reserve public localhost:3002 --unique-name playwright-mcp-static || true
    echo "✅ Reserved share created!"
else
    echo "✅ Reserved share already exists"
fi

echo ""
echo "🎯 Your static URL will be:"
echo "   https://playwright-mcp-static.share.zrok.io"
echo ""

echo ""
echo "✅ Post-create setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. zrok tunnel will start automatically with MCP server"
echo "   2. Static URL: https://playwright-mcp-static.share.zrok.io"
echo "   3. No need to update config - URL never changes!"
echo ""
