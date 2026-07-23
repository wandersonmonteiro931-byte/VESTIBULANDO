param(
  [string]$Site = "https://vestibulando.pages.dev",
  [Parameter(Mandatory = $true)]
  [string]$ExpectedVersion,
  [int]$Attempts = 48,
  [int]$DelaySeconds = 5
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
  try {
    $cacheBuster = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $uri = "$Site/deploy-version.json?v=$cacheBuster"
    $response = Invoke-RestMethod -Uri $uri -TimeoutSec 15 -Headers @{ "Cache-Control" = "no-cache" }

    if ($response.version -eq $ExpectedVersion) {
      Write-Host "Versao confirmada no dominio principal: $ExpectedVersion"
      exit 0
    }

    if ($response.version) {
      Write-Host "Aguardando Cloudflare: versao atual $($response.version), esperada $ExpectedVersion ($attempt/$Attempts)"
    } else {
      Write-Host "Aguardando Cloudflare ($attempt/$Attempts)"
    }
  } catch {
    Write-Host "Aguardando o novo deploy aparecer no dominio ($attempt/$Attempts)"
  }

  if ($attempt -lt $Attempts) {
    Start-Sleep -Seconds $DelaySeconds
  }
}

Write-Host "O GitHub recebeu a atualizacao, mas o dominio ainda nao confirmou a nova versao."
exit 1
