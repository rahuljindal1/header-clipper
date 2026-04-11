FROM mcr.microsoft.com/devcontainers/javascript-node:20

# Install minimal tools
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

# Switch to node user BEFORE global installs
USER node

# Install Claude Code globally
RUN npm install -g @anthropic-ai/claude-code

# (optional) verify install
RUN claude --version || true