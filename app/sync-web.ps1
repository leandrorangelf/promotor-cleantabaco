$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$target = Join-Path $PSScriptRoot 'www'

foreach ($file in @('index.html', 'manual.html', 'bonus.js', 'performance.js')) {
  Copy-Item -LiteralPath (Join-Path $root $file) -Destination (Join-Path $target $file) -Force
}

$indexPath = Join-Path $target 'index.html'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$index = [System.IO.File]::ReadAllText($indexPath, [System.Text.Encoding]::UTF8)
$index = $index -replace "const API = '';", "const API = 'https://promotor-cleantabaco.vercel.app';"
[System.IO.File]::WriteAllText($indexPath, $index, $utf8)

# Copia bridges construidos de volta para a raiz (Vercel precisa servir esses arquivos)
foreach ($file in @('geo-bridge.js', 'jornada-bridge.js', 'camera-bridge.js')) {
  $src = Join-Path $target $file
  if (Test-Path $src) {
    Copy-Item -LiteralPath $src -Destination (Join-Path $root $file) -Force
  }
}

Write-Output 'Assets web sincronizados para app/www.'
