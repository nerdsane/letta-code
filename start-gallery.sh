#!/bin/bash

# Story Explorer Gallery Startup Script

echo "🎨 Starting Story Explorer Gallery..."
echo ""

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo "❌ Error: Bun is not installed"
    echo "   Install from: https://bun.sh"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found"
    echo "   Run this script from the letta-code directory"
    exit 1
fi

# Check if .dsf directory exists
if [ ! -d ".dsf" ]; then
    echo "📁 Creating .dsf directory..."
    mkdir -p .dsf/worlds .dsf/stories .dsf/assets
    echo "   Created: .dsf/worlds, .dsf/stories, .dsf/assets"
fi

# Start the gallery server
echo ""
echo "🚀 Launching gallery server..."
echo "   Server will be available at: http://localhost:3030"
echo "   Press Ctrl+C to stop"
echo ""

bun run src/gallery/server.ts
