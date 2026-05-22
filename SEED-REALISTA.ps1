param(
  [switch]$Compose,
  [switch]$Enable,
  [switch]$Disable
)

$ErrorActionPreference = "Stop"

function Set-RealisticSeedEnv([bool]$value) {
  if ($value) {
    $env:APP_SEED_REALISTIC = "true"
    Write-Host "APP_SEED_REALISTIC=true"
  } else {
    $env:APP_SEED_REALISTIC = "false"
    Write-Host "APP_SEED_REALISTIC=false"
  }
}

if ($Disable) { Set-RealisticSeedEnv $false; exit 0 }
if ($Enable -or -not $Disable) { Set-RealisticSeedEnv $true }

if (-not $Compose) {
  Write-Host "Listo. Ahora levanta el backend con:"
  Write-Host "  docker compose up -d --build --force-recreate backend"
  exit 0
}

docker compose up -d --build --force-recreate backend
docker compose ps

