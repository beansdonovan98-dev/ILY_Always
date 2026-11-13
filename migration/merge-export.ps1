param(
  [Parameter(Mandatory = $true)][string]$ExportDir,
  [string]$PackageDir = (Join-Path $PSScriptRoot '.')
)

# Merges an ily-export folder (produced by pod-export.sh) into the migration package:
#   - model-manifest.json gets real sizes + sha256, and any model not already listed
#   - custom-nodes.txt gets repo + pinned commit per node
#   - export-inventory.md summarises what came back
#   - checksums.txt is regenerated

$ErrorActionPreference = 'Stop'
$inv = Join-Path $ExportDir 'config\inventory.txt'
if (-not (Test-Path $inv)) { throw "inventory not found: $inv" }
$lines = Get-Content $inv

# ---- models ----
$models = @()
foreach ($l in $lines) {
  if ($l -match '^(.*)\|(\d+)\|([0-9a-f]{64})$') {
    $models += [pscustomobject]@{
      path     = $matches[1]
      filename = Split-Path $matches[1] -Leaf
      sizeBytes = [int64]$matches[2]
      sha256   = $matches[3]
      location = ($matches[1] -replace '^.*/models/', 'models/')
    }
  }
}
Write-Host "models found in export: $($models.Count)"

$manifestPath = Join-Path $PackageDir 'model-manifest.json'
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$known = @{}
foreach ($m in $manifest.models) { $known[$m.filename] = $m }

foreach ($m in $models) {
  if ($known.ContainsKey($m.filename)) {
    $known[$m.filename].sizeBytes = $m.sizeBytes
    $known[$m.filename].sha256 = $m.sha256
    $known[$m.filename].location = $m.location
    $known[$m.filename].verifiedAt = (Get-Date -Format 'yyyy-MM-dd')
  } else {
    $manifest.models += [pscustomobject]@{
      kind = 'discovered'; filename = $m.filename; location = $m.location
      sizeBytes = $m.sizeBytes; sha256 = $m.sha256; required = $true
      usedBy = 'found on pod, not referenced by code at packaging time'
      verifiedAt = (Get-Date -Format 'yyyy-MM-dd')
    }
  }
}
$manifest | ConvertTo-Json -Depth 6 | Set-Content $manifestPath -Encoding utf8

# ---- custom nodes ----
$nodeLines = @(
  '# Custom nodes — generated from pod-export.sh inventory',
  '# format: name | commit | remote | dirty_files | captured <date>',
  ''
)
foreach ($l in $lines) {
  if ($l -match '^([^|]+)\s\|\s([^|]+)\s\|\s([^|]+)\s\|\s(dirty_files=\d+)$') {
    $nodeLines += "$($matches[1].Trim())"
    $nodeLines += "  repo    $($matches[3].Trim())"
    $nodeLines += "  commit  $($matches[2].Trim())"
    $nodeLines += "  state   $($matches[4].Trim())"
    $nodeLines += ''
  }
}
$nodeLines | Set-Content (Join-Path $PackageDir 'custom-nodes.txt') -Encoding utf8

# ---- report ----
$report = @(
  '# Export inventory',
  '',
  "Captured: $(Get-Date -Format 'yyyy-MM-dd HH:mm')",
  "Source: $ExportDir",
  '',
  '## Models',
  '',
  '| file | size (GB) | sha256 |',
  '|---|---|---|'
)
foreach ($m in $models) {
  $report += "| $($m.filename) | $([math]::Round($m.sizeBytes / 1GB, 2)) | $($m.sha256.Substring(0,16))… |"
}
$report += @(
  '',
  '## Archives in the export',
  ''
)
Get-ChildItem $ExportDir -Recurse -File -Include *.tgz, *.tar.gz, *.part.* |
  Sort-Object Length -Descending |
  ForEach-Object { $report += "- $($_.FullName.Replace($ExportDir, '')) — $([math]::Round($_.Length / 1MB, 1)) MB" }
$report | Set-Content (Join-Path $PackageDir 'export-inventory.md') -Encoding utf8

# ---- checksums ----
Get-ChildItem $PackageDir -File |
  ForEach-Object { "$((Get-FileHash $_.FullName -Algorithm SHA256).Hash)  $($_.Name)" } |
  Set-Content (Join-Path $PackageDir 'checksums.txt') -Encoding utf8

Write-Host "merged: model-manifest.json, custom-nodes.txt, export-inventory.md, checksums.txt"
