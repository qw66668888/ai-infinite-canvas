@echo off
cd /d "%~dp0"
echo ============================================
echo   AI Workflow Canvas - starting dev server
echo   Keep this window OPEN while using the app.
echo ============================================
echo.
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 5; Start-Process 'http://localhost:5180'"
call npm.cmd run dev
echo.
echo ============================================
echo   Dev server stopped. Read the errors above.
echo ============================================
pause
