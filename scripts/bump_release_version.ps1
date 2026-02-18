param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^\d+\.\d+\.\d+$')]
  [string]$Version,

  [Parameter(Mandatory = $false)]
  [ValidateRange(1, 999999)]
  [int]$BuildNumber = 1,

  [Parameter(Mandatory = $false)]
  [ValidatePattern('^\d+\.\d+\.\d+$')]
  [string]$MinShell = $Version,

  [Parameter(Mandatory = $false)]
  [string]$ReleasedAt = "",

  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ReleasedAt)) {
  $ReleasedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Update-File {
  param(
    [Parameter(Mandatory = $true)][string]$RelativePath,
    [Parameter(Mandatory = $true)][string]$Pattern,
    [Parameter(Mandatory = $true)][string]$Replacement,
    [Parameter(Mandatory = $true)][string]$Label
  )

  $path = Join-Path $root $RelativePath
  if (-not (Test-Path $path)) {
    throw "Missing file: $RelativePath"
  }

  $content = [System.IO.File]::ReadAllText($path)
  if (-not [System.Text.RegularExpressions.Regex]::IsMatch(
      $content,
      $Pattern,
      [System.Text.RegularExpressions.RegexOptions]::Multiline
    )) {
    throw "No match for '$Label' in $RelativePath"
  }

  $updated = [System.Text.RegularExpressions.Regex]::Replace(
    $content,
    $Pattern,
    $Replacement,
    [System.Text.RegularExpressions.RegexOptions]::Multiline
  )

  if ($updated -eq $content) {
    Write-Host "No change for $Label in $RelativePath"
    return
  }

  if ($DryRun) {
    Write-Host "[DryRun] Updated $Label in $RelativePath"
    return
  }

  [System.IO.File]::WriteAllText($path, $updated, $utf8NoBom)
  Write-Host "Updated $Label in $RelativePath"
}

Update-File -RelativePath "mobile_shell_flutter/pubspec.yaml" `
  -Pattern '(^version:\s*)([^\r\n]+)' `
  -Replacement ('${1}' + $Version + '+' + $BuildNumber) `
  -Label "Flutter app version"

$jsonFiles = @(
  "field-site/version.json"
)

foreach ($jsonFile in $jsonFiles) {
  Update-File -RelativePath $jsonFile `
    -Pattern '("version"\s*:\s*")([^"]+)(")' `
    -Replacement ('${1}' + $Version + '${3}') `
    -Label "Site version"

  Update-File -RelativePath $jsonFile `
    -Pattern '("releasedAt"\s*:\s*")([^"]+)(")' `
    -Replacement ('${1}' + $ReleasedAt + '${3}') `
    -Label "releasedAt"

  Update-File -RelativePath $jsonFile `
    -Pattern '("minShell"\s*:\s*")([^"]+)(")' `
    -Replacement ('${1}' + $MinShell + '${3}') `
    -Label "minShell"
}

$swFiles = @(
  "field-site/sw.js"
)

foreach ($swFile in $swFiles) {
  Update-File -RelativePath $swFile `
    -Pattern '(const\s+CACHE_VERSION\s*=\s*")v[^"]+(";\s*)' `
    -Replacement ('${1}v' + $Version + '${2}') `
    -Label "Service worker cache version"
}

Write-Host ""
Write-Host "Done."
Write-Host "Version: $Version"
Write-Host "BuildNumber: $BuildNumber"
Write-Host "MinShell: $MinShell"
Write-Host "ReleasedAt: $ReleasedAt"
if ($DryRun) {
  Write-Host "Mode: DryRun (no files written)"
}
