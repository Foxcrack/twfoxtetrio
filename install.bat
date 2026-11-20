@echo off
setlocal
cd /d "%~dp0"
set "NODE_BIN="

for %%N in (node.exe) do set "NODE_BIN=%%~$PATH:N"
if not defined NODE_BIN if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_BIN=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_BIN if exist "%LocalAppData%\Programs\nodejs\node.exe" set "NODE_BIN=%LocalAppData%\Programs\nodejs\node.exe"
if defined NODE_BIN goto :run_install

echo [twfoxtetrio] No se encontro Node.js en este equipo.
echo Node.js LTS es necesario para ejecutar el instalador.
where winget >nul 2>nul
if errorlevel 1 goto :manual_node

echo.
set /p "INSTALL_NODE=Quieres instalar Node.js LTS automaticamente con winget ahora? (S/N): "
if /I not "%INSTALL_NODE%"=="S" if /I not "%INSTALL_NODE%"=="Y" goto :manual_node

echo [twfoxtetrio] Instalando Node.js LTS...
winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_BIN=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_BIN if exist "%LocalAppData%\Programs\nodejs\node.exe" set "NODE_BIN=%LocalAppData%\Programs\nodejs\node.exe"
if defined NODE_BIN goto :run_install

:manual_node
echo.
echo Descarga e instala Node.js LTS desde: https://nodejs.org/
echo Luego cierra TETR.IO Desktop y vuelve a ejecutar install.bat.
pause
exit /b 1

:run_install
"%NODE_BIN%" scripts\install.js %*
set "ERR=%ERRORLEVEL%"
echo.
pause
exit /b %ERR%
