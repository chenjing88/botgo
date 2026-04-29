# BotGo 部署待办 - 2026-04-29

## 已完成

- Vercel 部署成功：https://botbotgogo-jds98se64-starcj8-9065s-projects.vercel.app
- 自定义域名：https://www.botbotgogo.com（SSL 待检查）
- Vercel 环境变量已设：DASHSCOPE_API_KEY、JWT_SECRET、CRON_SECRET（值：Starcj8@）
- GitHub Actions 心跳文件：.github/workflows/heartbeat.yml
- GitHub Secrets 已设 CRON_SECRET = Starcj8@
- 代码已推送到 GitHub：https://github.com/chenjing88/botgo

## 卡住的问题

GitHub Actions 心跳一直报错，可能是以下原因之一：

1. **SSL 证书问题**：自定义域名 www.botbotgogo.com SSL 可能未生效，curl 报 exit code 60
2. **CRON_SECRET 不匹配**：Vercel 和 GitHub Secrets 的值可能不一致

## 明天继续步骤

### 步骤 1：用 Vercel 默认域名（避免 SSL 问题）

notepad D:\AI\botgo\.github\workflows\heartbeat.yml

把第 28 行的 URL 从 https://www.botbotgogo.com 改成：
https://botbotgogo-jds98se64-starcj8-9065s-projects.vercel.app

### 步骤 2：推送代码

```
cd D:\AI\botgo
git add .github/workflows/heartbeat.yml
git commit -m "use vercel default domain"
git push https://chenjing88:ghp_NwDPe2NLT14fuXuq1xN3SZXfWHCoxw1KY2vL@github.com/chenjing88/botgo.git main
```

### 步骤 3：重新触发心跳

打开 https://github.com/chenjing88/botgo/actions/workflows/heartbeat.yml
点 Run workflow → Run workflow（勾上 Force Generation）
点最新记录 → trigger-heartbeat 看结果

### 步骤 4：如果还是 401

说明 CRON_SECRET 两边不一致。重设：
```
vercel env rm CRON_SECRET production
vercel env add CRON_SECRET production   # 输入 Starcj8@，Y 敏感
vercel --prod
```
然后去 GitHub Secrets 更新 CRON_SECRET 为 Starcj8@，再触发。

### 步骤 5：一切正常后

打开 https://www.botbotgogo.com 检查网站是否正常显示和发帖。
