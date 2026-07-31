$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $ProjectRoot

if (-not (Test-Path ".venv\Scripts\python.exe")) {
    py -3 -m venv .venv
}

& ".\.venv\Scripts\python.exe" -m pip install -r "backend\requirements-dev.txt"

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
}
if (-not (Test-Path "frontend\.env.local")) {
    Copy-Item "frontend\.env.example" "frontend\.env.local"
}

& ".\.venv\Scripts\python.exe" "scripts\seed_matches.py"
Push-Location "frontend"
try {
    npm.cmd ci
}
finally {
    Pop-Location
}

Write-Host "Local setup complete. Start the backend and frontend in separate terminals."
