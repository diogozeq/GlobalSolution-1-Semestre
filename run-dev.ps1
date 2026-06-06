# run-dev.ps1 — sobe backend (FastAPI) e frontend (Vite) do OrbitGuard AI.
# Uso:  ./run-dev.ps1   (opcional: -BackendPort 8077)
param(
  [int]$BackendPort = 8000
)
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$backend = Join-Path $root "src\backend"
$frontend = Join-Path $root "src\frontend"
$venvPy = Join-Path $backend ".venv\Scripts\python.exe"

if (-not (Test-Path $venvPy)) {
  Write-Host "[setup] Criando venv e instalando dependencias do backend..." -ForegroundColor Cyan
  python -m venv (Join-Path $backend ".venv")
  & $venvPy -m pip install -r (Join-Path $backend "requirements.txt")
}
if (-not (Test-Path (Join-Path $frontend "node_modules"))) {
  Write-Host "[setup] Instalando dependencias do frontend..." -ForegroundColor Cyan
  Push-Location $frontend; npm install; Pop-Location
}

# Se o backend nao usar a porta 8000, aponta o frontend para ele.
if ($BackendPort -ne 8000) {
  "VITE_API_URL=http://localhost:$BackendPort" | Out-File -Encoding utf8 (Join-Path $frontend ".env")
}

Write-Host "[run] Backend  -> http://localhost:$BackendPort/docs" -ForegroundColor Green
Write-Host "[run] Frontend -> http://localhost:5173" -ForegroundColor Green

Start-Process powershell -ArgumentList "-NoExit", "-Command",
  "Set-Location '$backend'; .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port $BackendPort"
Start-Process powershell -ArgumentList "-NoExit", "-Command",
  "Set-Location '$frontend'; npm run dev"
