@echo off
cd /d "%~dp0"
echo.
echo ========================================
echo   Botbotgogo 本地完整运行包
echo ========================================
echo.
echo 1. 构建前端...
call npm run build
echo.
echo 2. 启动本地 API 服务器...
echo    (按 Ctrl+C 停止)
echo.
npx tsx local-server.ts
pause
