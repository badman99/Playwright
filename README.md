# Playwright MCP Server for Codespaces 🎭

A production-ready GitHub Codespaces configuration that automatically spins up a **Playwright MCP (Model Context Protocol) Server** for AI-powered browser automation.

## 🚀 Quick Start

### 1. Create a Codespace
1. Go to [github.com/badman99/Playwright](https://github.com/badman99/Playwright)
2. Click **"Code"** → **"Codespaces"** → **"Create codespace on main"**
3. Wait for the container to build (~2-3 minutes)

### 2. Get Your Public URL
1. Once the Codespace is running, go to the **PORTS** tab (bottom panel)
2. Look for port **3002** labeled "Playwright MCP Server"
3. **Right-click** → **"Port Visibility"** → **"Public"** (if not already public)
4. **Right-click** → **"Copy Local Address"**
5. Your URL will look like:
   ```
   https://yourname-playwright-xyz123-3002.app.github.dev
   ```

### 3. Connect from HuggingFace / OpenCode

Add this to your OpenCode config (`opencode.jsonc`):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "playwright": {
      "type": "http",
      "url": "https://yourname-playwright-xyz123-3002.app.github.dev"
    }
  }
}
```

Then restart your HF Space - AI will have full browser automation! 🎉

## 🛠️ What's Included

- **Node.js 20** + npm
- **Playwright MCP Server** (`@playwright/mcp@latest`)
- **Chromium Browser** (pre-installed, headless)
- **Auto port-forwarding** on port 3002
- **Public visibility** by default
- **Auto-start** on container launch

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

## ⚠️ Important Notes

### Codespace Idle Timeout
Free tier Codespaces **auto-shutdown after 30 minutes of inactivity**.

**Solutions:**
- **Upgrade to paid** ($0.18/hour) for no timeout
- **Use it regularly** to keep alive
- **Set up a ping** from HF Space every 10-15 minutes

### URL Changes on Rebuild
If the Codespace is rebuilt or recreated, the URL will change.

**Solution:**
- Copy the new URL from the PORTS tab
- Update your `opencode.jsonc` config
- Restart HF Space

### Security
- Port is **public by default** - anyone with the URL can access it
- For private access, set visibility to **"Private"** and use GitHub token authentication
- **Don't commit sensitive URLs** to public repos

## 🔧 Advanced Configuration

### Private Port (with auth)
If you want restricted access:

```jsonc
{
  "mcp": {
    "playwright": {
      "type": "http",
      "url": "https://yourname-playwright-xyz123-3002.app.github.dev",
      "headers": {
        "X-Github-Token": "ghu_xxxxxxxx"
      }
    }
  }
}
```

Get token: In Codespace terminal, run `echo $GITHUB_TOKEN`

### Multiple Browser Support
The default config uses Chromium. To use Firefox or WebKit:

Edit `scripts/start-mcp.sh`:
```bash
npx @playwright/mcp@latest --headless --port 3002 --host 0.0.0.0 --browser firefox
```

## 🔄 Keep-Alive Strategy

To prevent auto-shutdown, you can:

1. **From HF Space**: Send periodic requests
2. **From local**: Use a cron job or GitHub Action to ping
3. **Upgrade**: Paid Codespaces don't auto-shutdown

Example ping command:
```bash
curl https://yourname-playwright-xyz123-3002.app.github.dev/health
```

## 📁 Repo Structure

```
Playwright/
├── .devcontainer/
│   ├── devcontainer.json      # Codespace configuration
│   ├── Dockerfile             # Container image
│   └── post-create.sh         # Setup script
├── scripts/
│   └── start-mcp.sh           # MCP server startup
├── .github/
│   └── workflows/
│       └── keepalive.yml      # Optional: keep-alive workflow
└── README.md                  # This file
```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Port not showing | Wait 2-3 min after Codespace starts |
| URL not working | Make port public in PORTS tab |
| Server not starting | Check Terminal tab for logs |
| Chrome not found | Run `npx playwright install chromium` in terminal |

## 📝 License

MIT - Use freely!

---

**Happy Browser Automation!** 🎭🔥
