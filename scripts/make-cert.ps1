#requires -Version 5.1
# Deprecated: kept so old instructions still work.
# The real implementation lives in rotate-signing-cert.ps1 and never hardcodes a password.
Write-Host 'make-cert.ps1 is deprecated; running rotate-signing-cert.ps1 instead.'
& (Join-Path $PSScriptRoot 'rotate-signing-cert.ps1')
