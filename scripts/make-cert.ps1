$certDir = "C:\Users\induw\OneDrive\Documents\programs\personal\mymusic\build"
$pfxPath = "$certDir\cert.pfx"
$pwdText = "MyMusicBuild2026!"
$pwd = ConvertTo-SecureString -String $pwdText -Force -AsPlainText

$cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=My Music" -CertStoreLocation "Cert:\CurrentUser\My" -NotAfter (Get-Date).AddYears(5)
Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $pwd

# Also add to CurrentUser\TrustedPeople and CurrentUser\TrustedPublisher so Windows trusts it locally
$storePeople = New-Object System.Security.Cryptography.X509Certificates.X509Store "TrustedPeople", "CurrentUser"
$storePeople.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
$storePeople.Add($cert)
$storePeople.Close()

$storePublisher = New-Object System.Security.Cryptography.X509Certificates.X509Store "TrustedPublisher", "CurrentUser"
$storePublisher.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
$storePublisher.Add($cert)
$storePublisher.Close()

Write-Host "Code signing certificate created and trusted locally:" $cert.Thumbprint
