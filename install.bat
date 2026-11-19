@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [twfoxtetrio] Node.js is required to install this mod.
  echo Download Node.js LTS from https://nodejs.org/ and run this script again.
  pause
  exit /b 1
)
node scripts\install.js %*
set "ERR=%ERRORLEVEL%"
echo.
pause
exit /b %ERR%
