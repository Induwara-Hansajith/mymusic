#requires -Version 5.1
param(
  [string[]]$Target = @('dir'),
  [switch]$Publish
)

<#
Builds Linux distribution packages for My Music.
Generates:
  - dist/My.Music.1.1.8.deb (Debian/Ubuntu native package)
  - dist/My.Music.1.1.8.tar.gz (Universal portable bundle with desktop installer for Arch, Fedora, Debian)
  - dist/arch/PKGBUILD & .SRCINFO (Arch Linux / Manjaro makepkg package)

Examples:
  powershell -ExecutionPolicy Bypass -File scripts\build-linux.ps1
  powershell -ExecutionPolicy Bypass -File scripts\build-linux.ps1 -Publish
#>
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  Write-Host "==> Running syntax and integrity checks..." -ForegroundColor Cyan
  npm run check

  Write-Host "==> Compiling unpacked Linux application..." -ForegroundColor Cyan
  npx electron-builder --linux dir --x64

  Write-Host "==> Packaging Linux distributions (.deb, .tar.gz, Arch PKGBUILD)..." -ForegroundColor Cyan
  python scripts\pack-linux.py
} finally {
  Pop-Location
}
