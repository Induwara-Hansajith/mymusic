#requires -Version 5.1
param(
  [string[]]$Target = @('tar.gz'),
  [switch]$Publish
)

<#
Builds Linux distribution packages for My Music.

Examples:
  powershell -ExecutionPolicy Bypass -File scripts\build-linux.ps1
  powershell -ExecutionPolicy Bypass -File scripts\build-linux.ps1 -Target AppImage,deb,tar.gz
  powershell -ExecutionPolicy Bypass -File scripts\build-linux.ps1 -Publish
#>
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  Write-Host "==> Running syntax and integrity checks..." -ForegroundColor Cyan
  npm run check

  $targetArgs = $Target -join ' '
  if ($Publish) {
    if (-not ($env:GH_TOKEN -or $env:GITHUB_TOKEN -or $env:GITHUB_RELEASE_TOKEN)) {
      throw 'Publishing requires GH_TOKEN, GITHUB_TOKEN, or GITHUB_RELEASE_TOKEN with permission to publish repository releases.'
    }
    Write-Host "==> Building and publishing Linux packages ($targetArgs)..." -ForegroundColor Cyan
    npx electron-builder --linux $Target --x64 --publish always
  } else {
    Write-Host "==> Building Linux packages ($targetArgs)..." -ForegroundColor Cyan
    npx electron-builder --linux $Target --x64
  }
} finally {
  Pop-Location
}
