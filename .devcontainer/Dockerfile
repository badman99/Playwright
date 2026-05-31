FROM mcr.microsoft.com/devcontainers/javascript-node:20

# Install system dependencies required for Chromium/Chrome
RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /workspaces/Playwright

# Pre-install Playwright MCP globally for faster startup
RUN npm install -g @playwright/mcp@latest

# Pre-install Playwright browsers (Chromium for headless)
RUN npx playwright install chromium

# Install additional browsers with deps (uncomment if needed)
# RUN npx playwright install-deps chromium

# Install zrok for static tunneling
RUN apt-get update && apt-get install -y wget tar \
    && wget -q https://github.com/openziti/zrok/releases/latest/download/zrok-linux-amd64.tar.gz \
    && tar -xzf zrok-linux-amd64.tar.gz -C /usr/local/bin zrok \
    && rm zrok-linux-amd64.tar.gz \
    && chmod +x /usr/local/bin/zrok \
    && rm -rf /var/lib/apt/lists/*

# Verify installations
RUN node -v && npm -v && npx playwright --version && zrok version

# Expose the MCP server port
EXPOSE 3002

# Default command (will be overridden by post-start script)
CMD ["sleep", "infinity"]
