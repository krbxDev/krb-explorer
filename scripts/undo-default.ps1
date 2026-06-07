# Restores File Explorer as the default file manager.

$keys = @(
    "HKCU:\SOFTWARE\Classes\Folder\shell\open\command",
    "HKCU:\SOFTWARE\Classes\Directory\shell\open\command",
    "HKCU:\SOFTWARE\Classes\Drive\shell\open\command"
)

foreach ($key in $keys) {
    Remove-Item -Path $key -Force -ErrorAction SilentlyContinue
    Write-Host "Removed $key"
}

# Kill AHK script
$ahkFile = "$env:APPDATA\NovaExplorer\WinE.ahk"
Get-Process -Name "AutoHotkey*" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*WinE*" } |
    Stop-Process -Force -ErrorAction SilentlyContinue

# Remove startup entry
Remove-Item "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\NovaExplorerWinE.vbs" -Force -ErrorAction SilentlyContinue
Remove-Item $ahkFile -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Done! File Explorer is restored as your default file manager."
