Get-ChildItem -Path "$env:LOCALAPPDATA\electron-builder\Cache" -Filter "signtool.exe" -Recurse | Select-Object -ExpandProperty FullName
