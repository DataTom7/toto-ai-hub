# PowerShell script to start toto-ai-hub locally
# Run with: .\start-local.ps1

Write-Host "🚀 Starting toto-ai-hub locally..." -ForegroundColor Cyan

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  Warning: .env file not found" -ForegroundColor Yellow
    Write-Host "   Make sure GOOGLE_AI_API_KEY is set in your environment or .env file" -ForegroundColor Yellow
}

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Cyan
    npm install
}

# Build TypeScript
Write-Host "🔨 Building TypeScript..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

# Start server
Write-Host "✅ Starting server on http://localhost:8080" -ForegroundColor Green
Write-Host "   Health check: http://localhost:8080/health" -ForegroundColor Gray
Write-Host "   Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""

npm start

