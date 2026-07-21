param(
  [switch]$SkipBuild,
  [switch]$UsePm2
)

$ErrorActionPreference = "Stop"

Write-Host "[medilab] Starting production preparation..."

if (-not (Test-Path ".env")) {
  throw "Missing .env file. Copy .env.production.example or another deployment env file into .env first."
}

if (-not $SkipBuild) {
  npm run prepare:prod
}

if ($UsePm2) {
  $pm2 = Get-Command pm2 -ErrorAction SilentlyContinue
  if (-not $pm2) {
    throw "PM2 is not installed or not on PATH. Install PM2 or run without -UsePm2."
  }

  Write-Host "[medilab] Launching API and worker with PM2..."
  pm2 start deploy/ecosystem.config.cjs --update-env
  pm2 save
  exit 0
}

Write-Host "[medilab] Launching API and worker with npm start:prod..."
npm run start:prod