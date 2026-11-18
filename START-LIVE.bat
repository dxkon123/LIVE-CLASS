@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules (
  echo First run: installing libraries, please wait 1-2 minutes...
  call npm install
)
echo Starting the game... Close this window to stop it.
echo Link for TikTok LIVE Studio: http://lvh.me:3006/?view=stage  (1080 x 1920)
echo Report after the live: http://localhost:3006/report
rem Always run through Vite, even when the PC has NODE_ENV=production set
set NODE_ENV=development
rem Live mode: the stage page does not reload when the code changes
set LIVE_MODE=1
rem LIVE-CLASS's own port (other games use 3000)
set PORT=3006
start "" cmd /c "timeout /t 8 >nul & start http://localhost:3006"
rem All-day live: if the server stops (error, out of memory...) it restarts after 5 seconds.
rem The restarted server reconnects to TikTok if it was connected. The stage page reconnects too, no points are lost.
:run
call npm run dev
echo.
echo [%date% %time%] Server stopped, restarting in 5 seconds... (close this window to stop for good)
timeout /t 5 >nul
goto run
