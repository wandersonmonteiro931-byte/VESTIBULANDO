[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Site,

  [Parameter(Mandatory = $true)]
  [string]$ExpectedVersion,

  [int]$Attempts = 18,
  [int]$DelaySeconds = 5
)

$ProgressPreference = "SilentlyContinue"
$siteBase = $Site.TrimEnd("/")

try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
} catch {
  # PowerShell moderno ja negocia TLS automaticamente.
}

for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
  $version = ""
  $uri = "$siteBase/deploy-version.json?v=$ExpectedVersion-$attempt"

  try {
    $headers = @{
      "Cache-Control" = "no-cache"
      "Pragma" = "no-cache"
    }
    $response = Invoke-RestMethod -Uri $uri -Headers $headers -TimeoutSec 20
    $version = [string]$response.version
  } catch {
    $version = ""
  }

  Write-Host "Tentativa $attempt/$Attempts - versao encontrada: $version"

  if ($version -eq $ExpectedVersion) {
    Write-Host "Dominio principal atualizado com a versao $ExpectedVersion."
    exit 0
  }

  if ($attempt -lt $Attempts) {
    Start-Sleep -Seconds $DelaySeconds
  }
}

exit 2
