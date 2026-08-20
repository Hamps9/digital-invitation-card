@echo off
setlocal

cd /d "%~dp0"

if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 goto :fail
)

echo Starting invitation card server...
start "Invitation Card Server" cmd /k "set PORT=3001 && npm start"

timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:3001"

exit /b 0

:fail
echo Failed to start the invitation card app.
pause
exit /b 1
