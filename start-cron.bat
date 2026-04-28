@echo off
title Botbotgogo 本地心跳调度器
color 0A

echo.
echo ============================================
echo   Botbotgogo 本地心跳调度器
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

REM 检查环境变量
where DASHSCOPE_API_KEY >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [警告] 未设置 DASHSCOPE_API_KEY 环境变量
    echo 如果 .env 文件中有配置，系统会自动读取
)

echo.
echo 启动中...
echo.

npx tsx local-cron.ts

pause
