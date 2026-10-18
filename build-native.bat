@echo off
cd /d "%~dp0"
call npm.cmd run build:native
if errorlevel 1 (
  echo.
  echo Build failed.
) else (
  echo.
  echo Build complete. Double-click start-canvas.bat to open.
)
pause
