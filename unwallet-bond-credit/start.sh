#!/bin/bash
set -e

# Install Bun if not already installed
if ! command -v bun &> /dev/null; then
  echo "Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi

# Ensure Bun is in PATH
export PATH="$HOME/.bun/bin:$PATH"

# Verify Bun is available
if ! command -v bun &> /dev/null; then
  echo "Error: Bun installation failed"
  exit 1
fi

# Install dependencies
echo "Installing dependencies..."
bun install

# Start the polling server
echo "Starting polling server..."
exec bun run poll-server.ts

