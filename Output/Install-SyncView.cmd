@echo off
setlocal
title SyncView Installer
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-SyncView.ps1"
if errorlevel 1 (
  echo.
  echo SyncView installation could not be started.
  pause
  exit /b 1
)
endlocal
