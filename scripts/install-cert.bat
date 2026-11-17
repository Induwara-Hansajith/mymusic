@echo off
echo Installing the My Music code-signing certificate for the current user...
echo Only do this on a PC you control. It trusts code signed with build\MyMusic.cer.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Import-Certificate -FilePath '%~dp0..\build\MyMusic.cer' -CertStoreLocation Cert:\CurrentUser\Root; Import-Certificate -FilePath '%~dp0..\build\MyMusic.cer' -CertStoreLocation Cert:\CurrentUser\TrustedPublisher; Write-Host 'Certificate installed into CurrentUser Root and TrustedPublisher.' -ForegroundColor Green"
pause
