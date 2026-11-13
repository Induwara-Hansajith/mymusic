@echo off
echo Installing My Music code signing certificate to trusted stores...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Import-Certificate -FilePath '%~dp0..\build\MyMusic.cer' -CertStoreLocation Cert:\CurrentUser\TrustedPublisher; Import-Certificate -FilePath '%~dp0..\build\MyMusic.cer' -CertStoreLocation Cert:\CurrentUser\TrustedPeople; Write-Host 'Certificate successfully installed into CurrentUser stores!' -ForegroundColor Green"
pause
