@echo off
cd /d "%~dp0"
echo Starting local server...
npx tsx local-server.ts
pause
