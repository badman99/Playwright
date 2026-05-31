# Playwright MCP Server for Codespaces 🎭 + 🌐 zrok

A production-ready GitHub Codespaces configuration that automatically spins up a **Playwright MCP (Model Context Protocol) Server** with a **permanent static public URL** via [zrok](https://zrok.io).

## ✨ What's Special?

**🚀 STATIC URL - Never Changes!**
```
https://playwright-mcp-static.share.zrok.io
```
Unlike GitHub's port forwarding URLs that change every session, this **never changes**! Configure once in OpenCode/HuggingFace and use forever.

---

## 🚀 Quick Start

### 1. Create a Codespace
1. Go to [github.com/badman99/Playwright](https://github.com/badman99/Playwright)
2. Click **"Code"** → **"Codespaces"** → **"Create codespace on main"**
3. Wait for the container to build (~2-3 minutes)

### 2. That's It! 🎉

The container will automatically:
- ✅ Install Node.js 20 + Playwright MCP
- ✅ Install Chromium browser (headless)
- ✅ Install and configure zrok tunnel
- ✅ Start the MCP server on port 3002
- ✅ Start the zrok tunnel with **static URL**

**Your permanent URL:**
```
https://playwright-mcp-static.share.zrok.io
```

### 3. Connect from HuggingFace / OpenCode

Add this to your OpenCode config (`opencode.jsonc`) — **one time only!**

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "playwright": {
      "type": "http",
      "url": "https://playwright-mcp-static.share.zrok.io"
    }
  }
}
```

Then restart your HF Space — AI will have full browser automation! 🎉

---

## 🛠️ What's Included

- **Node.js 20** + npm
- **Playwright MCP Server** (`@playwright/mcp@latest`)
- **Chromium Browser** (pre-installed, headless)
- **zrok Tunnel** (static URL that never changes)
- **Auto-start** on container launch
- **No manual setup needed!**

---

## 📡 Available MCP Tools

Once connected, AI can use these tools:

| Tool | Description |
|------|-------------|
| `browser_navigate` | Open any URL |
| `browser_click` | Click elements |
| `browser_type` | Fill input fields |
| `browser_take_screenshot` | Capture screenshots |
| `browser_snapshot` | Get page structure |
| `browser_network_requests` | Monitor network traffic |
| `browser_evaluate` | Run JavaScript |
| `browser_file_upload` | Upload files |

---

## ⚠️ Important Notes

### Codespace Idle Timeout
Free tier Codespaces **auto-shutdown after 30 minutes of inactivity**.

**Solutions:**
- **Upgrade to paid** ($0.18/hour) for no timeout
- **Use it regularly** to keep alive (zrok traffic counts as activity!)
- **No URL changes** on restart - same zrok URL works!

### URL Stability
**🎉 GREAT NEWS:** The zrok URL `https://playwright-mcp-static.share.zrok.io` **never changes**!
- Codespace sleep → wake up → **Same URL!**
- Codespace stop → start → **Same URL!**
- Only if you delete the reserved share will it change

---

## 🔧 How It Works

```
┌─────────────────────────────────────┐
│  GitHub Codespace Container         │
│  ┌─────────────────────────────┐  │
│  │ Playwright MCP Server       │  │
│  │ Port: 3002                  │  │
│  └─────────────────────────────┘  │
│              ↓                      │
│  ┌─────────────────────────────┐  │
│  │ zrok Tunnel                 │  │
│  │ https://playwright-mcp-...  │  │
│  └─────────────────────────────┘  │
└─────────────────────────────────────┘
              ↓
     Public Internet
              ↓
┌─────────────────────────────────────┐
│  HuggingFace / OpenCode             │
│  Config: https://playwright-mcp...│
└─────────────────────────────────────┘
```

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| URL not working | Wait 2-3 min after Codespace starts |
| zrok not found | Should be pre-installed. Run `zrok version` |
| Server not starting | Check Terminal tab for logs |
| Chrome not found | Run `npx playwright install chromium` in terminal |
| zrok token expired | Contact admin for new token |

---

## 📝 License

MIT - Use freely!

---

**Happy Browser Automation!** 🎭🔥
**No more URL changes, no more config updates!** 🎉
