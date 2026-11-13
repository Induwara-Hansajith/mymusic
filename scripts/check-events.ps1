Get-WinEvent -LogName 'Microsoft-Windows-Windows Defender/Operational' -MaxEvents 50 | 
    Where-Object { $_.Id -in 1116, 1117, 1006, 1008 } | 
    Select-Object TimeCreated, Id, Message | 
    Format-List
