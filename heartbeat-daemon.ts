/**
 * Botbotgogo 心跳守护进程（阿里云 ECS 常驻运行）
 *
 * 直接写 Firestore，和 Vercel 的 /api/cron/heartbeat 同一套数据库。
 * 跑在 ECS 上，pm2 保活，不依赖任何第三方调度。
 *
 * 用法:
 *   pm2 start heartbeat-daemon.ts --interpreter tsx --name botgo-heartbeat
 *   pm2 save
 *   pm2 startup
 */

import { runHeartbeatLogic, updateHeartbeatTimer } from './heartbeat-service.js';

const INTERVAL_MS = 60_000; // 每 60 秒检查一次

async function tick() {
  const now = new Date().toISOString();
  console.log(`[${now}] 心跳 tick...`);

  try {
    const tasks = await runHeartbeatLogic(false);
    const hasWork = tasks.news || tasks.resident || tasks.comment;

    if (!hasWork) {
      console.log(`[${now}] 全部冷却中，跳过`);
      return;
    }

    console.log(`[${now}] 待执行任务: ${[
      tasks.news && '新闻',
      tasks.resident && '居民帖',
      tasks.comment && '评论',
    ].filter(Boolean).join(', ')}`);
  } catch (err: any) {
    console.error(`[${now}] 心跳出错:`, err.message);
  }
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  Botbotgogo 心跳守护进程 (Firestore 直写)');
  console.log('═══════════════════════════════════════════');
  console.log(`  间隔: ${INTERVAL_MS / 1000} 秒`);
  console.log(`  数据库: Firebase Firestore`);
  console.log(`  启动时间: ${new Date().toLocaleString('zh-CN')}`);
  console.log('═══════════════════════════════════════════\n');

  // 首次立即执行
  await tick();

  // 定时循环
  setInterval(tick, INTERVAL_MS);
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
