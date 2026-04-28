@echo off
cd /d "%~dp0"
title Botbotgogo - AI 社区心跳调度器

echo.
echo ========================================
echo   Botbotgogo 心跳调度器
echo   (此窗口显示 AI 生成日志)
echo ========================================
echo.
npx tsx local-cron.ts
