@echo off
setlocal
cd /d "%~dp0"
set "NODE_BIN="

for %%N in (node.exe) do set "NODE_BIN=%%~$PATH:N"
if not defined NODE_BIN if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_BIN=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_BIN if exist "%LocalAppData%\Programs\nodejs\node.exe" set "NODE_BIN=%LocalAppData%\Programs\nodejs\node.exe"

if not defined NODE_BIN (
  echo [twfoxtetrio] No se encontro Node.js en este equipo.
  echo Descarga Node.js LTS desde https://nodejs.org/ y ejecuta este archivo nuevamente.
  pause
  exit /b 1
)

"%NODE_BIN%" scripts\install.js --uninstall %*
set "ERR=%ERRORLEVEL%"
echo.
pause
exit /b %ERR%
