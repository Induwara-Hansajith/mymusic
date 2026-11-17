#requires -Version 5.1
<#
Creates a new self-signed code-signing certificate for My Music.

- The private key stays in build\cert.pfx, which is gitignored and must never be committed.
- The random PFX password is stored DPAPI-encrypted for the current Windows user only.
- The certificate is trusted for the current user (Root + TrustedPublisher), so
  Authenticode signatures verify locally.

Run from anywhere:
  powershell -ExecutionPolicy Bypass -File scripts\rotate-signing-cert.ps1

This does not help other PCs: a self-signed certificate still shows "Unknown publisher"
there. Use a CA-issued code-signing certificate for public distribution.
#>
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$buildDir = Join-Path $root 'build'
$secretDir = Join-Path $env:LOCALAPPDATA 'mymusic-signing'
$pfxPath = Join-Path $buildDir 'cert.pfx'
$cerPath = Join-Path $buildDir 'MyMusic.cer'
$passwordPath = Join-Path $secretDir 'cert-password.txt'

New-Item -ItemType Directory -Force -Path $buildDir, $secretDir | Out-Null

$cert = New-SelfSignedCertificate -Type CodeSigningCert `
  -Subject 'CN=My Music (induw)' `
  -KeyAlgorithm RSA -KeyLength 3072 -HashAlgorithm SHA256 `
  -KeyExportPolicy Exportable -NotAfter (Get-Date).AddYears(3) `
  -CertStoreLocation 'Cert:\CurrentUser\My'

$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$password = [Convert]::ToBase64String($bytes)
$secure = ConvertTo-SecureString $password -AsPlainText -Force
$secure | ConvertFrom-SecureString | Set-Content -Path $passwordPath -NoNewline

Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $secure -Force | Out-Null
Export-Certificate -Cert $cert -FilePath $cerPath -Force | Out-Null

Import-Certificate -FilePath $cerPath -CertStoreLocation 'Cert:\CurrentUser\Root' | Out-Null
Import-Certificate -FilePath $cerPath -CertStoreLocation 'Cert:\CurrentUser\TrustedPublisher' | Out-Null

Write-Host 'New signing certificate created.'
Write-Host "Subject:    $($cert.Subject)"
Write-Host "Thumbprint: $($cert.Thumbprint)"
Write-Host "PFX:        $pfxPath (gitignored)"
Write-Host "Password:   $passwordPath (DPAPI, current user only)"
Write-Host 'Build with: powershell -ExecutionPolicy Bypass -File scripts\build-signed.ps1'
