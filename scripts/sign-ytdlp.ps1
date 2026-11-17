#requires -Version 5.1
# Signs the bundled yt-dlp.exe with the local My Music certificate.
# The PFX password comes from the DPAPI file created by rotate-signing-cert.ps1.
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$pfxPath = Join-Path $root 'build\cert.pfx'
$target = Join-Path $root 'bin\yt-dlp.exe'
$passwordPath = Join-Path $env:LOCALAPPDATA 'mymusic-signing\cert-password.txt'

if (-not (Test-Path $pfxPath) -or -not (Test-Path $passwordPath)) {
  throw 'Signing material missing. Run scripts\rotate-signing-cert.ps1 first.'
}

$signtool = Get-ChildItem "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign" -Recurse -Filter signtool.exe -ErrorAction SilentlyContinue |
  Select-Object -First 1 -ExpandProperty FullName
if (-not $signtool) {
  throw 'signtool.exe not found. Run an electron-builder build first.'
}

$secure = Get-Content -Path $passwordPath | ConvertTo-SecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  & $signtool sign /f $pfxPath /p $plain /fd sha256 /tr 'https://timestamp.digicert.com' /td sha256 $target
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

Get-AuthenticodeSignature $target | Select-Object Status, StatusMessage
