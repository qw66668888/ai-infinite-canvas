@echo off
cd /d "%~dp0"

if not exist "native\index.html" (
  echo Building static version...
  call npm.cmd run build:native
  if errorlevel 1 goto :error
)

echo ============================================
echo   AI Workflow Canvas - static mode
echo   Keep this window OPEN while using the app.
echo ============================================
echo.

start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:5180'"
node serve.mjs
if errorlevel 1 goto :error
exit /b 0

:error
echo.
echo Start failed. Please send the error above to the assistant.
pause
exit /b 1
