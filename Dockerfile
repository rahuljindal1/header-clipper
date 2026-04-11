FROM mcr.microsoft.com/devcontainers/javascript-node:20

# Minimal utilities only
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

RUN chown -R node:node /workspace