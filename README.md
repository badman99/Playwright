# Playwright MCP Server - GitHub Actions

🎭 **Full browser automation server** running on GitHub Actions with **static URL** via zrok tunnel.

## 🚀 Quick Start

### 1. Set Secrets
Go to **Settings → Secrets and variables → Actions** and add:
- `ZROK_TOKEN` - Your zrok token (get from [zrok.io](https://zrok.io))

### 2. Trigger Workflow
Go to **Actions → Playwright MCP Server with zrok Tunnel → Run workflow**

### 3. Get Your URL
The workflow will output your **permanent static URL**:
```
https://playwright-mcp-gha.share.zrok.io
```

## 📝 OpenCode Config

Add this to your `opencode.jsonc`:
```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "playwright": {
      "type": "http",
      "url": "https://playwright-mcp-gha.share.zrok.io"
    }
  }
}
```

**URL never changes!** 🔥

## ⏰ Auto-Restart
The workflow auto-triggers every 5 hours to keep the server alive!

## 🛠️ Features
- ✅ All 23 Playwright MCP tools
- ✅ Headless Chromium browser
- ✅ Static URL (never changes)
- ✅ Auto-restart every 5 hours
- ✅ Network monitoring, screenshots, JS execution

## 📡 Available Tools
- `browser_navigate` - Open any URL
- `browser_click` - Click elements
- `browser_type` - Fill inputs
- `browser_take_screenshot` - Screenshots
- `browser_evaluate` - Run JavaScript
- `browser_network_requests` - Monitor network
- `browser_file_upload` - Upload files
- `browser_fill_form` - Form automation
- + 14 more tools!

## 🎯 How It Works

```
GitHub Actions Runner (Ubuntu, 6h max)
├── Playwright MCP Server (port 3002)
└── zrok Tunnel (static URL)
    └── https://playwright-mcp-gha.share.zrok.io
```

**Note:** GitHub Actions has a 6-hour limit. The workflow auto-restarts every 5 hours to maintain continuous uptime!

## 🔧 Manual Control

**Start:** Actions → Run workflow → `start`
**Stop:** Actions → Run workflow → `stop` (cancels running job)

## ⚠️ Limitations
- Max 6 hours per run (GitHub limit)
- Auto-restarts every 5 hours
- Need to re-trigger manually if Actions disabled

---

**Enjoy full browser automation!** 🎭🔥
