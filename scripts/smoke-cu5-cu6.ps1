$ErrorActionPreference = "Stop"

# --- Configuración (rellena con IDs reales) ---
$baseUrl = "http://localhost:8083"
$policyId = "POLICY_ID"
$userId = "USER_ID"
$taskId = "TASK_ID"
$processInstanceId = "PROCESS_INSTANCE_ID"

function Invoke-Json($method, $url, $body = $null) {
  # Fuerza UTF-8 para evitar errores con caracteres como "¿", "á", etc.
  $headers = @{ "Content-Type" = "application/json; charset=utf-8" }
  if ($null -eq $body) {
    return Invoke-RestMethod -Method $method -Uri $url -Headers $headers
  }
  $json = ($body | ConvertTo-Json -Depth 20)
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  return Invoke-RestMethod -Method $method -Uri $url -Headers $headers -Body $bytes
}

Write-Host "1) Health" -ForegroundColor Cyan
Invoke-RestMethod "$baseUrl/api/health" | ConvertTo-Json

Write-Host "2) Policies" -ForegroundColor Cyan
Invoke-RestMethod "$baseUrl/api/policies" | ConvertTo-Json -Depth 20

Write-Host "4) Create process instance" -ForegroundColor Cyan
$created = Invoke-Json "POST" "$baseUrl/api/process-instances" @{ policyId = $policyId; requestedBy = $userId }
$created | ConvertTo-Json -Depth 20

Write-Host "5) List process instances" -ForegroundColor Cyan
Invoke-RestMethod "$baseUrl/api/process-instances" | ConvertTo-Json -Depth 20

Write-Host "6) My tasks" -ForegroundColor Cyan
Invoke-RestMethod "$baseUrl/api/tasks/my/$userId" | ConvertTo-Json -Depth 20

Write-Host "7) Start task" -ForegroundColor Cyan
Invoke-Json "PATCH" "$baseUrl/api/tasks/$taskId/start" @{ userId = $userId } | ConvertTo-Json -Depth 20

Write-Host "8) Complete task" -ForegroundColor Cyan
Invoke-Json "PATCH" "$baseUrl/api/tasks/$taskId/complete" @{
  userId = $userId
  formData = @{ descripcionSolicitud = "Solicitud de prueba desde smoke test" }
  observations = "Actividad completada correctamente"
  transitionConditionResult = "aprobada"
} | ConvertTo-Json -Depth 20

Write-Host "9) My tasks (after)" -ForegroundColor Cyan
Invoke-RestMethod "$baseUrl/api/tasks/my/$userId" | ConvertTo-Json -Depth 20

Write-Host "10) Get process instance" -ForegroundColor Cyan
Invoke-RestMethod "$baseUrl/api/process-instances/$processInstanceId" | ConvertTo-Json -Depth 20

