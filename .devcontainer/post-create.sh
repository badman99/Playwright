#!/bin/bash
set -e

echo "======================================"
echo "🔧 Playwright MCP - Post-Create Setup"
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

echo ""
echo "✅ Post-create setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Port 3002 will be auto-forwarded"
echo "   2. MCP server will start automatically"
echo "   3. Check the PORTS tab for your public URL"
echo ""
