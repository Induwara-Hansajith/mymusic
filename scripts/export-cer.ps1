$pfxPath = "C:\Users\induw\OneDrive\Documents\programs\personal\mymusic\build\cert.pfx"
$cerPath = "C:\Users\induw\OneDrive\Documents\programs\personal\mymusic\build\MyMusic.cer"
$pfx = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2
$pfx.Import($pfxPath, "MyMusicBuild2026!", [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::DefaultKeySet)

[System.IO.File]::WriteAllBytes($cerPath, $pfx.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert))
Write-Output "Exported to $cerPath"
