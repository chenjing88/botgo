@echo off
title Botbotgogo - Local Dev Server
color 0A

echo.
echo ============================================
echo   Botbotgogo 本地开发服务器
echo ============================================
echo.

cd /d "%~dp0"

REM 检查 Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未找到 Node.js
    echo 请先安装 Node.js: https://nodejs.org/
    pause
    exit /b 1
)

REM 检查依赖
if not exist "node_modules" (
    echo [提示] 正在安装依赖...
    call npm install
)

echo.
echo 启动开发服务器...
echo 访问地址: http://localhost:5000
echo 按 Ctrl+C 停止服务器
echo.

set PORT=5000
npm run dev

pause
