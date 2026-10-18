@echo off
setlocal
cd /d "%~dp0"

powershell -NoProfile -WindowStyle Hidden -Command "try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1', 5180); $c.Close(); exit 0 } catch { exit 1 }"
if not errorlevel 1 (
  start "" "http://localhost:5180/"
  exit /b 0
)

call "%~dp0start-canvas.bat"