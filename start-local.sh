#!/bin/bash
# Bash script to start toto-ai-hub locally
# Run with: ./start-local.sh

echo "🚀 Starting toto-ai-hub locally..."

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found"
    echo "   Make sure GOOGLE_AI_API_KEY is set in your environment or .env file"
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

# Start server
echo "✅ Starting server on http://localhost:8080"
echo "   Health check: http://localhost:8080/health"
echo "   Press Ctrl+C to stop"
echo ""

npm start

