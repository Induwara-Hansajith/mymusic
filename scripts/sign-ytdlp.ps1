$signtool = "C:\Users\induw\AppData\Local\electron-builder\Cache\winCodeSign-2.6.0\winCodeSign-2.6.0-5puky\windows-10\x64\signtool.exe"
$cert = "C:\Users\induw\OneDrive\Documents\programs\personal\mymusic\build\cert.pfx"
$target = "C:\Users\induw\OneDrive\Documents\programs\personal\mymusic\bin\yt-dlp.exe"

& $signtool sign /f $cert /p "MyMusicBuild2026!" /fd sha256 /tr "http://timestamp.digicert.com" /td sha256 $target
Get-AuthenticodeSignature $target | Select-Object Status, StatusMessage
