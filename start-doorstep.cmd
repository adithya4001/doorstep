@echo off
setlocal
cd /d "%~dp0doorstep"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 24 LTS, then run this file again.
  pause
  exit /b 1
)
if not exist "node_modules\@modelcontextprotocol\sdk\package.json" (
  call npm ci
  if errorlevel 1 (
    echo Setup could not finish. Check your internet connection and try again.
    pause
    exit /b 1
  )
)
echo Open http://127.0.0.1:4317 in your browser after the ready message appears.
echo Keep this window open while using Doorstep. Press Ctrl+C to stop.
call npm start
pause
