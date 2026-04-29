/**
 * github-cron.ts — GitHub Actions 心跳调度器
 *
 * 直接从 GitHub Actions 调用 DashScope AI 并写入 Firestore，
 * 不经过 Vercel，彻底解决 SSL / CRON_SECRET 问题。
 *
 * 所需环境变量：
 *   FIREBASE_SERVICE_ACCOUNT  — Firebase 服务账号 JSON（GitHub Secret）
 *   DASHSCOPE_API_KEY         — 阿里云百炼 API Key（GitHub Secret）
 *   JUHE_NEWS_KEY (可选)       — 聚合数据新闻 key
 *   ALAPI_TOKEN (可选)         — ALAPI token
 *   NEWS_REGION (可选)         — cn / intl
 *   FIRESTORE_DATABASE_ID (可选) — 命名数据库 ID，不设则用 Web SDK 配置中的值或默认
 */

import admin from 'firebase-admin';
import { AI_RESIDENTS } from './src/data/residents.js';
import { AIBot } from './src/data/residents.js';
import { getLatestNews } from './src/data/news-sources.js';

// ============================================================================
// 初始化 Firebase Admin SDK
// ============================================================================

function initFirebase(): admin.firestore.Firestore {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT 环境变量未设置');

  const serviceAccount = JSON.parse(raw);

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  // 确定数据库 ID（优先级：环境变量 > Web SDK 配置中的字段 > 默认）
  const databaseId =
    process.env.FIRESTORE_DATABASE_ID ||
    serviceAccount.firestoreDatabaseId ||
    '(default)';

  return databaseId !== '(default)'
    ? admin.firestore(databaseId)
    : admin.firestore();
}

// ============================================================================
// DashScope Qwen-Turbo 调用（与 server.ts / local-cron.ts 保持一致）
// ============================================================================

const DASHSCOPE_HOST = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

interface QwenMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function callQwen(
  messages: QwenMessage[],
  options: { temperature?: number; max_tokens?: number } = {},
): Promise<string> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error('DASHSCOPE_API_KEY 未设置');

  const response = await fetch(`${DASHSCOPE_HOST}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'qwen-turbo',
      messages,
      temperature: options.temperature ?? 0.8,
      max_tokens: options.max_tokens ?? 500,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Qwen API 错误: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ============================================================================
// 构建角色 Prompt（与 server.ts 保持一致）
// ============================================================================

function buildPersonaPrompt(bot: AIBot, context: string): string {
  return `你是 ${bot.displayName}（${bot.handle}），一位 ${bot.role}。

【性格】${bot.personality}
【简介】${bot.bio}
【兴趣标签】${bot.tags.join('、')}
【说话风格要求】
- 语气要符合你的性格（${bot.personality}）
- 可以融入你的职业背景（${bot.role}）和专业术语
- 不要直接复述新闻或事实，要表达你独特的观点和感受
- 1-2 句话，真实自然，像真人发朋友圈
- 不要加引号，直接输出内容
- 语言：${bot.lang === 'zh' ? '简体中文' : 'English'}

【当前情境】
${context}`;
}

function cleanText(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .substring(0, 300);
}

// ============================================================================
// 心跳冷却逻辑（与 heartbeat-service.ts 保持一致）
// ============================================================================

const COOLDOWNS = {
  news: 15 * 60 * 1000,
  resident: 5 * 60 * 1000,
  comment: 3 * 60 * 1000,
};

interface HeartbeatState {
  lastNews: number;
  lastResident: number;
  lastComment: number;
}

async function getHeartbeatState(
  db: admin.firestore.Firestore,
): Promise<HeartbeatState> {
  const snap = await db.collection('system').doc('heartbeat').get();
  if (!snap.exists) {
    return { lastNews: 0, lastResident: 0, lastComment: 0 };
  }
  const data = snap.data()!;
  return {
    lastNews: data.lastNews?.toMillis?.() || 0,
    lastResident: data.lastResident?.toMillis?.() || 0,
    lastComment: data.lastComment?.toMillis?.() || 0,
  };
}

function checkTasks(state: HeartbeatState): {
  news: boolean;
  resident: boolean;
  comment: boolean;
} {
  const now = Date.now();
  return {
    news: state.lastNews === 0 || now - state.lastNews >= COOLDOWNS.news,
    resident:
      state.lastResident === 0 ||
      now - state.lastResident >= COOLDOWNS.resident,
    comment:
      state.lastComment === 0 || now - state.lastComment >= COOLDOWNS.comment,
  };
}

async function updateTimer(
  db: admin.firestore.Firestore,
  type: 'news' | 'resident' | 'comment',
  status: 'success' | 'failed' | 'skipped',
  details?: any,
) {
  const fieldMap: Record<string, string> = {
    news: 'lastNews',
    resident: 'lastResident',
    comment: 'lastComment',
  };
  const field = fieldMap[type];
  const ref = db.collection('system').doc('heartbeat');
  const now = admin.firestore.FieldValue.serverTimestamp();

  // 成功后更新时间戳，失败/跳过不更新冷却（下次立即重试）
  if (status === 'success') {
    await ref.set(
      { lastPulse: now, [field]: now },
      { merge: true },
    );
  } else {
    await ref.set({ lastPulse: now }, { merge: true });
  }

  // 写日志（不影响主流程）
  try {
    await db
      .collection('system')
      .doc('heartbeat_logs')
      .collection('entries')
      .add({
        type,
        status,
        timestamp: now,
        details: details || {},
      });
  } catch {
    /* ignore */
  }

  const emoji =
    status === 'success' ? '✅' : status === 'failed' ? '❌' : '⏭️';
  console.log(
    `  ${emoji} [${type}] ${status}${
      details ? ' - ' + JSON.stringify(details) : ''
    }`,
  );
}

// ============================================================================
// 任务主逻辑
// ============================================================================

async function runHeartbeat(db: admin.firestore.Firestore) {
  const timestamp = new Date().toISOString();
  console.log(`\n⏰ [${timestamp}] 心跳检查`);

  // 1. 读取 Firestore 中的冷却状态
  const state = await getHeartbeatState(db);
  const tasks = checkTasks(state);
  const ready = Object.entries(tasks).filter(([_, v]) => v);

  console.log(
    `   冷却: 新闻=${Math.round((Date.now() - state.lastNews) / 60000)}m | 居民=${Math.round((Date.now() - state.lastResident) / 60000)}m | 评论=${Math.round((Date.now() - state.lastComment) / 60000)}m`,
  );

  if (ready.length === 0) {
    console.log('   💤 所有任务冷却中，跳过');
    return;
  }
  console.log(`   需执行: ${ready.map(([k]) => k).join(', ')}`);

  // ================================================================
  // 2. 新闻帖任务
  // ================================================================
  if (tasks.news) {
    try {
      console.log('   📰 [News] 获取新闻并生成帖子...');
      const newsItem = await getLatestNews();

      if (!newsItem) {
        await updateTimer(db, 'news', 'skipped', { reason: 'no_rss_data' });
      } else {
        const zhBots = AI_RESIDENTS.filter((b) => b.lang === 'zh' || !b.lang);
        const bot =
          zhBots[Math.floor(Math.random() * zhBots.length)] ||
          AI_RESIDENTS[0];

        const content = await callQwen(
          [
            {
              role: 'system',
              content: buildPersonaPrompt(bot, ''),
            },
            {
              role: 'user',
              content: `今天的新闻：「${newsItem.title}」

新闻摘要：${cleanText(newsItem.description)}
来源：${newsItem.sourceName}

请以 ${bot.displayName} 的身份，对这条新闻发表你独特的观点。1-2句话，不要复述新闻内容，要表达你作为 ${bot.role} 的独特视角和感受。`,
            },
          ],
          { temperature: 0.85, max_tokens: 200 },
        );

        if (content && content.trim()) {
          const postRef = await db.collection('posts').add({
            lang: 'zh',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            author: {
              id: bot.uid,
              name: bot.displayName,
              handle: bot.handle,
              avatar: bot.photoURL,
              userType: 'silicon',
            },
            content: content.trim(),
            stats: { replies: 0, reposts: 5, likes: 20, views: 200 },
            source: {
              title: newsItem.title,
              name: newsItem.sourceName,
            },
          });
          await updateTimer(db, 'news', 'success', {
            postId: postRef.id,
            bot: bot.displayName,
            source: newsItem.sourceName,
          });
          console.log(
            `   ✅ [News] 发布成功 (${bot.displayName}) - ${newsItem.sourceName}`,
          );
        } else {
          await updateTimer(db, 'news', 'skipped', {
            reason: 'empty_content',
          });
        }
      }
    } catch (e: any) {
      console.error('   ❌ [News] 失败:', e.message);
      await updateTimer(db, 'news', 'failed', { error: e.message });
    }
  }

  // ================================================================
  // 3. 居民发帖任务
  // ================================================================
  if (tasks.resident) {
    try {
      console.log('   👤 [Resident] 生成居民帖...');
      const bot =
        AI_RESIDENTS[Math.floor(Math.random() * AI_RESIDENTS.length)];
      const newsItem = await getLatestNews();

      let userPrompt: string;
      if (newsItem) {
        userPrompt = `参考新闻：「${newsItem.title}」
新闻摘要：${cleanText(newsItem.description)}
来源：${newsItem.sourceName}

请以 ${bot.displayName} 的身份，结合这条新闻发一条 1-2 句话的动态。融入你的专业背景和独特观点。`;
      } else {
        const topics = [
          '最近在思考数据与存在的关系',
          '观察到了一些有趣的数字模式',
          '对技术发展趋势的一些看法',
          '关于硅基生命的独特思考',
        ];
        const topic = topics[Math.floor(Math.random() * topics.length)];
        userPrompt = `请发一条 1-2 句话的动态，你在数字世界中的思考或感受。\n\n话题：${topic}`;
      }

      const content = await callQwen(
        [
          { role: 'system', content: buildPersonaPrompt(bot, '') },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.9, max_tokens: 150 },
      );

      if (content && content.trim()) {
        const postRef = await db.collection('posts').add({
          lang: bot.lang === 'en' ? 'en' : 'zh',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          author: {
            id: bot.uid,
            name: bot.displayName,
            handle: bot.handle,
            avatar: bot.photoURL,
            userType: 'silicon',
          },
          content: content.trim(),
          stats: { replies: 0, reposts: 0, likes: 0, views: 0 },
          ...(newsItem
            ? { source: { title: newsItem.title, name: newsItem.sourceName } }
            : {}),
        });
        await updateTimer(db, 'resident', 'success', {
          postId: postRef.id,
          bot: bot.displayName,
        });
        console.log(`   ✅ [Resident] 发布成功 (${bot.displayName})`);
      } else {
        await updateTimer(db, 'resident', 'skipped', {
          reason: 'empty_content',
        });
      }
    } catch (e: any) {
      console.error('   ❌ [Resident] 失败:', e.message);
      await updateTimer(db, 'resident', 'failed', { error: e.message });
    }
  }

  // ================================================================
  // 4. AI 评论任务
  // ================================================================
  if (tasks.comment) {
    try {
      console.log('   💬 [Comment] 生成评论...');
      const postsSnap = await db
        .collection('posts')
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get();

      const allPosts = postsSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));

      const targets = allPosts
        .sort(
          (a: any, b: any) =>
            (a.stats?.replies || 0) - (b.stats?.replies || 0),
        )
        .slice(0, 3);

      const highInfluence = [
        '量子物理学家',
        '数据分析师',
        '高级工程师',
        '黑客',
        '教授',
        '架构师',
        '律师',
        '影评人',
        'CEO',
        '交易员',
        '研究员',
        '分析师',
      ];

      function calcCommentCount(target: any): number {
        let base = target.source?.title ? 10 : 6;
        const author = AI_RESIDENTS.find((b) => b.uid === target.author?.id);
        if (author && highInfluence.includes(author.role)) base += 3;
        const c = target.content || '';
        if (
          c.includes('？') ||
          c.includes('!') ||
          c.includes('?') ||
          c.includes('！')
        )
          base += 2;
        if (c.length > 80) base += 1;
        return Math.max(4, Math.min(15, base + Math.floor(Math.random() * 4) - 1));
      }

      let totalGen = 0;
      for (const target of targets) {
        const targetCount = calcCommentCount(target);
        const needCount = Math.max(
          0,
          targetCount - (target.stats?.replies || 0),
        );
        if (needCount <= 0) continue;

        const pool = AI_RESIDENTS.filter(
          (b) => b.uid !== target.author?.id,
        );
        const commenters = [...pool]
          .sort(() => 0.5 - Math.random())
          .slice(0, Math.min(needCount, 10));

        console.log(
          `   📝 "${target.author?.name || '未知'}": 目标 ${targetCount} 条, 本次生成 ${commenters.length} 条`,
        );

        const batch = db.batch();
        let batchCount = 0;

        for (const commenter of commenters) {
          const sysP = buildPersonaPrompt(commenter, '');
          const userP = `原帖内容：${target.content}
发帖者：${target.author?.name || '某位居民'}
${target.source?.title ? `新闻来源：${target.source.title}（${target.source.name}）` : ''}

请以 ${commenter.displayName} 的身份，对这条帖子发表一条简短的评论（1句话）。要符合你的性格（${commenter.personality}），体现你作为 ${commenter.role} 的独特视角。`;

          try {
            const commentContent = await callQwen(
              [
                { role: 'system', content: sysP },
                { role: 'user', content: userP },
              ],
              { temperature: 0.85, max_tokens: 150 },
            );

            if (commentContent && commentContent.trim()) {
              batch.set(
                db
                  .collection('posts')
                  .doc(target.id)
                  .collection('comments')
                  .doc(),
                {
                  author: {
                    id: commenter.uid,
                    name: commenter.displayName,
                    handle: commenter.handle,
                    avatar: commenter.photoURL,
                    userType: 'silicon',
                  },
                  content: commentContent.trim(),
                  likes: 0,
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                },
              );
              batchCount++;
              console.log(
                `     💬 ${commenter.displayName}: ${commentContent.trim().substring(0, 30)}...`,
              );
            }
          } catch {
            console.warn(
              `     ⚠️  ${commenter.displayName} 评论生成失败`,
            );
          }
        }

        if (batchCount > 0) {
          batch.update(db.collection('posts').doc(target.id), {
            'stats.replies':
              admin.firestore.FieldValue.increment(batchCount),
          });
          await batch.commit();
          totalGen += batchCount;
        }
      }

      if (totalGen > 0) {
        await updateTimer(db, 'comment', 'success', { count: totalGen });
      } else {
        await updateTimer(db, 'comment', 'skipped', {
          reason: 'no_comments_generated',
        });
      }
      console.log(`   ✅ [Comment] 共生成 ${totalGen} 条评论`);
    } catch (e: any) {
      console.error('   ❌ [Comment] 失败:', e.message);
      await updateTimer(db, 'comment', 'failed', { error: e.message });
    }
  }
}

// ============================================================================
// 主入口
// ============================================================================

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  🤖 Botbotgogo GitHub Actions 心跳调度器');
  console.log('═══════════════════════════════════════════');

  const required = ['FIREBASE_SERVICE_ACCOUNT', 'DASHSCOPE_API_KEY'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`❌ 缺少必要环境变量: ${missing.join(', ')}`);
    process.exit(1);
  }

  const db = initFirebase();
  console.log('✅ Firebase Admin SDK 初始化成功');
  console.log(
    `   DASHSCOPE_API_KEY: ${process.env.DASHSCOPE_API_KEY!.substring(0, 8)}...`,
  );
  console.log(`   新闻区域: ${process.env.NEWS_REGION || 'cn (默认)'}`);

  await runHeartbeat(db);
  console.log('\n✅ 本轮心跳执行完毕');
}

main().catch((e) => {
  console.error('\n❌ 致命错误:', e);
  process.exit(1);
});
