#requires -Version 5.1
<#
Builds the Windows installer with the local signing key.

The PFX password is read from the DPAPI-protected file created by
scripts\rotate-signing-cert.ps1; it is never written to the repo or printed.

  powershell -ExecutionPolicy Bypass -File scripts\build-signed.ps1
#>
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$pfxPath = Join-Path $root 'build\cert.pfx'
$passwordPath = Join-Path $env:LOCALAPPDATA 'mymusic-signing\cert-password.txt'

if (-not (Test-Path $pfxPath)) {
  throw "Missing $pfxPath. Run scripts\rotate-signing-cert.ps1 first."
}
if (-not (Test-Path $passwordPath)) {
  throw "Missing $passwordPath. Run scripts\rotate-signing-cert.ps1 first."
}

$secure = Get-Content -Path $passwordPath | ConvertTo-SecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $env:CSC_LINK = $pfxPath
  $env:CSC_KEY_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  Push-Location $root
  try {
    npm run dist
  } finally {
    Pop-Location
  }
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  Remove-Item -Path Env:CSC_LINK, Env:CSC_KEY_PASSWORD -ErrorAction SilentlyContinue
}
