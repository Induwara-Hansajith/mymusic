#requires -Version 5.1
# Exports the public certificate from build\cert.pfx for manual trust installation.
# The PFX password comes from the DPAPI file created by rotate-signing-cert.ps1.
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$pfxPath = Join-Path $root 'build\cert.pfx'
$cerPath = Join-Path $root 'build\MyMusic.cer'
$passwordPath = Join-Path $env:LOCALAPPDATA 'mymusic-signing\cert-password.txt'

if (-not (Test-Path $pfxPath) -or -not (Test-Path $passwordPath)) {
  throw 'Signing material missing. Run scripts\rotate-signing-cert.ps1 first.'
}

$secure = Get-Content -Path $passwordPath | ConvertTo-SecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($pfxPath, $plain)
  [System.IO.File]::WriteAllBytes($cerPath, $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert))
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

Write-Host "Exported to $cerPath"
