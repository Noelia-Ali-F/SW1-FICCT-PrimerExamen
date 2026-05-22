$ErrorActionPreference = "Stop"

function Get-ListeningPids([int]$port) {
  try {
    return (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue).OwningProcess `
      | Sort-Object -Unique
  } catch {
    return @()
  }
}

function Stop-ListeningProcesses([int]$port) {
  $pids = Get-ListeningPids -port $port
  foreach ($procId in $pids) {
    try {
      Write-Host "==> Puerto $port ocupado. Cerrando PID $procId..." -ForegroundColor Yellow
      Stop-Process -Id $procId -Force -ErrorAction Stop
    } catch {
      Write-Host "==> No pude cerrar PID $procId en puerto $port. Motivo: $($_.Exception.Message)" -ForegroundColor Red
    }
  }
}

$root = "D:\ExSW1-2026"

# 0) Docker: si no está corriendo Docker Desktop, no intentamos levantar contenedores.
$dockerOk = $true
try {
  docker info | Out-Null
} catch {
  $dockerOk = $false
}

# 1) Mongo: si ya existe un mongod local en 27017, lo usamos (evita choque / requiere admin para parar servicio).
$mongoPort = 27017
$mongoBusy = (Get-ListeningPids -port $mongoPort).Count -gt 0
if ($mongoBusy) {
  Write-Host "==> Mongo ya está escuchando en $mongoPort. Usando Mongo local (no levanto Mongo en Docker)." -ForegroundColor Cyan
} else {
  if (-not $dockerOk) {
    Write-Host "==> Docker no está disponible. Necesitas Mongo local en $mongoPort (o iniciar Docker Desktop)." -ForegroundColor Yellow
  } else {
    Write-Host "==> Levantando Mongo (Docker)..." -ForegroundColor Cyan
    docker compose -f "$root\docker-compose.yml" up -d mongo | Out-Host
  }
}

Write-Host "==> Verificando Mongo..." -ForegroundColor Cyan
if ($dockerOk) {
  docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}" | Out-Host
} else {
  Write-Host "==> (Docker no disponible) Saltando verificación de contenedores." -ForegroundColor DarkYellow
}

# 2) Backend: liberar 8083 si está ocupado (proceso normal).
$backendPort = 8083
Stop-ListeningProcesses -port $backendPort

Write-Host "==> Iniciando Backend en $backendPort..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "cd $root\backend; mvn spring-boot:run ""-Dspring-boot.run.arguments=--server.port=$backendPort"""
) | Out-Null

Write-Host "==> Esperando health del backend (http://localhost:$backendPort/api/health)..." -ForegroundColor Cyan
for ($i=0; $i -lt 30; $i++) {
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:$backendPort/api/health" -UseBasicParsing -TimeoutSec 2
    if ($r.StatusCode -eq 200) { break }
  } catch {}
  Start-Sleep -Seconds 1
}

try {
  (Invoke-WebRequest -Uri "http://localhost:$backendPort/api/health" -UseBasicParsing -TimeoutSec 3).Content | Out-Host
} catch {
  Write-Host "No se pudo confirmar el health. Revisa la consola del backend." -ForegroundColor Yellow
}

# 3) Frontend local (Angular): liberar 4200 si lo quieres fijo; no tocamos 8086 aquí porque npm start usa 4200.
Write-Host "==> Iniciando Frontend (Angular)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "cd $root\workflow-frontend; npm start"
) | Out-Null

Write-Host "" 
Write-Host "Listo. Abre: http://localhost:4200" -ForegroundColor Green
Write-Host "Backend: http://localhost:$backendPort/api/health" -ForegroundColor Green

