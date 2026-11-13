@echo off
title My Music
cd /d "%~dp0"

:: Clean up any hung or orphaned background electron processes that hold file/cache locks
taskkill /f /im electron.exe >nul 2>nul

:: Fast direct launch via native binary
if exist "%~dp0node_modules\electron\dist\electron.exe" (
    start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0"
    exit /b 0
)

:: Fallback check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is required to run My Music.
    echo Please download and install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: First-time setup if dependencies are not yet installed
echo Installing dependencies, please wait...
call npm install
start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0"
exit /b 0
