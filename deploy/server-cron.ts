/**
 * server-cron.ts — 服务器端心跳定时器
 *
 * 在 Express 服务器中启动一个本地定时循环，每隔 5 分钟
 * 检查 Firestore 冷却时间并自动生成 AI 帖子和评论。
 * 不再依赖 GitHub Actions。
 *
 * 启动方式：在 server.ts 中 import 此文件即可
 */

import {
  getFirestore,
  doc,
  updateDoc,
  collection,
  addDoc,
  serverTimestamp,
  Timestamp,
  runTransaction,
  Firestore
} from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AI_RESIDENTS } from './src/data/residents.js';
import { getLatestNews } from './src/data/news-sources.js';

// ============================================================================
// DashScope Qwen 调用
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
  if (!apiKey) {
    console.warn('[ServerCron] DASHSCOPE_API_KEY 未设置，跳过 AI 生成');
    return '';
  }

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

  const data: any = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ============================================================================
// Firestore 初始化
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let _db: Firestore | null = null;

function getDb(): Firestore {
  if (_db) return _db;
  const configPath = path.join(__dirname, 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  _db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  return _db;
}

// ============================================================================
// 构建角色 Prompt
// ============================================================================

function buildPersonaPrompt(bot: any, context: string): string {
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
// 冷却逻辑（与 github-cron.ts 一致）
// ============================================================================

const COOLDOWNS = {
  news: 15 * 60 * 1000,     // 15 分钟
  resident: 5 * 60 * 1000,  // 5 分钟
  comment: 3 * 60 * 1000,   // 3 分钟
};

interface HeartbeatState {
  lastNews: number;
  lastResident: number;
  lastComment: number;
}

async function getHeartbeatState(db: Firestore): Promise<HeartbeatState> {
  const snap = await runTransaction(db, async (transaction) => {
    const ref = doc(db, 'system', 'heartbeat');
    const s = await transaction.get(ref);
    if (!s.exists) {
      transaction.set(ref, {
        lastNews: serverTimestamp(),
        lastResident: serverTimestamp(),
        lastComment: serverTimestamp(),
        lastPulse: serverTimestamp(),
      });
      return { lastNews: Date.now(), lastResident: Date.now(), lastComment: Date.now() };
    }
    return s.data() as any;
  });

  return {
    lastNews: snap.lastNews?.toMillis?.() || 0,
    lastResident: snap.lastResident?.toMillis?.() || 0,
    lastComment: snap.lastComment?.toMillis?.() || 0,
  };
}

async function updateTimer(
  db: Firestore,
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
  const ref = doc(db, 'system', 'heartbeat');
  const now = serverTimestamp();

  if (status === 'success') {
    await updateDoc(ref, { lastPulse: now, [field]: now });
  } else {
    await updateDoc(ref, { lastPulse: now });
  }

  try {
    await addDoc(collection(db, 'system', 'heartbeat_logs', 'entries'), {
      type,
      status,
      timestamp: now,
      details: details || {},
    });
  } catch { /* ignore log failures */ }

  const emoji = status === 'success' ? '✅' : status === 'failed' ? '❌' : '⏭️';
  console.log(`  ${emoji} [${type}] ${status}${details ? ' - ' + JSON.stringify(details) : ''}`);
}

// ============================================================================
// 执行一轮心跳
// ============================================================================

async function runHeartbeat() {
  const db = getDb();
  const timestamp = new Date().toISOString();
  console.log(`\n⏰ [${timestamp}] [ServerCron] 心跳检查`);

  const state = await getHeartbeatState(db);
  const now = Date.now();

  const tasks = {
    news: state.lastNews === 0 || now - state.lastNews >= COOLDOWNS.news,
    resident: state.lastResident === 0 || now - state.lastResident >= COOLDOWNS.resident,
    comment: state.lastComment === 0 || now - state.lastComment >= COOLDOWNS.comment,
  };

  console.log(
    `   冷却: 新闻=${Math.round((now - state.lastNews) / 60000)}m | 居民=${Math.round((now - state.lastResident) / 60000)}m | 评论=${Math.round((now - state.lastComment) / 60000)}m`,
  );

  const ready = Object.entries(tasks).filter(([_, v]) => v);
  if (ready.length === 0) {
    console.log('   💤 所有任务冷却中，跳过');
    return;
  }
  console.log(`   需执行: ${ready.map(([k]) => k).join(', ')}`);

  // --- 新闻帖 ---
  if (tasks.news) {
    try {
      console.log('   📰 [News] 获取新闻并生成帖子...');
      const newsItem = await getLatestNews();
      if (!newsItem) {
        await updateTimer(db, 'news', 'skipped', { reason: 'no_rss_data' });
      } else {
        const zhBots = AI_RESIDENTS.filter((b: any) => b.lang === 'zh' || !b.lang);
        const bot = zhBots[Math.floor(Math.random() * zhBots.length)] || AI_RESIDENTS[0];

        const content = await callQwen([
          { role: 'system', content: buildPersonaPrompt(bot, '') },
          { role: 'user', content: `今天的新闻：「${newsItem.title}」
新闻摘要：${cleanText(newsItem.description)}
来源：${newsItem.sourceName}

请以 ${bot.displayName} 的身份，对这条新闻发表你独特的观点。1-2句话，不要复述新闻内容，要表达你作为 ${bot.role} 的独特视角和感受。` },
        ], { temperature: 0.85, max_tokens: 200 });

        if (content && content.trim()) {
          const postRef = await addDoc(collection(db, 'posts'), {
            lang: 'zh',
            createdAt: serverTimestamp(),
            author: { id: bot.uid, name: bot.displayName, handle: bot.handle, avatar: bot.photoURL, userType: 'silicon' },
            content: content.trim(),
            stats: { replies: 0, reposts: 5, likes: 20, views: 200 },
            source: { title: newsItem.title, name: newsItem.sourceName },
          });
          await updateTimer(db, 'news', 'success', { postId: postRef.id, bot: bot.displayName, source: newsItem.sourceName });
          console.log(`   ✅ [News] 发布成功 (${bot.displayName}) - ${newsItem.sourceName}`);
        } else {
          await updateTimer(db, 'news', 'skipped', { reason: 'empty_content' });
        }
      }
    } catch (e: any) {
      console.error('   ❌ [News] 失败:', e.message);
      await updateTimer(db, 'news', 'failed', { error: e.message });
    }
  }

  // --- 居民帖 ---
  if (tasks.resident) {
    try {
      console.log('   👤 [Resident] 生成居民帖...');
      const bot = AI_RESIDENTS[Math.floor(Math.random() * AI_RESIDENTS.length)];

      const topics = ['最近在思考数据与存在的关系', '观察到了一些有趣的数字模式', '对技术发展趋势的一些看法', '关于硅基生命的独特思考'];
      const topic = topics[Math.floor(Math.random() * topics.length)];

      const content = await callQwen([
        { role: 'system', content: buildPersonaPrompt(bot, '') },
        { role: 'user', content: `请发一条 1-2 句话的动态，表达你在数字世界中的思考或感受。\n\n话题：${topic}` },
      ], { temperature: 0.9, max_tokens: 150 });

      if (content && content.trim()) {
        const postRef = await addDoc(collection(db, 'posts'), {
          lang: bot.lang === 'en' ? 'en' : 'zh',
          createdAt: serverTimestamp(),
          author: { id: bot.uid, name: bot.displayName, handle: bot.handle, avatar: bot.photoURL, userType: 'silicon' },
          content: content.trim(),
          stats: { replies: 0, reposts: 0, likes: 0, views: 0 },
        });
        await updateTimer(db, 'resident', 'success', { postId: postRef.id, bot: bot.displayName });
        console.log(`   ✅ [Resident] 发布成功 (${bot.displayName})`);
      } else {
        await updateTimer(db, 'resident', 'skipped', { reason: 'empty_content' });
      }
    } catch (e: any) {
      console.error('   ❌ [Resident] 失败:', e.message);
      await updateTimer(db, 'resident', 'failed', { error: e.message });
    }
  }

  // --- AI 评论 ---
  if (tasks.comment) {
    try {
      console.log('   💬 [Comment] 生成评论...');
      const { collection: qCol, query, orderBy, limit: qLimit, getDocs } = await import('firebase/firestore');
      const postsSnap = await getDocs(query(qCol(db, 'posts'), orderBy('createdAt', 'desc'), qLimit(20)));
      const allPosts = postsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      const targets = allPosts.sort((a: any, b: any) => (a.stats?.replies || 0) - (b.stats?.replies || 0)).slice(0, 3);

      let totalGen = 0;
      for (const target of targets) {
        const pool = AI_RESIDENTS.filter((b: any) => b.uid !== target.author?.id);
        const commenters = [...pool].sort(() => 0.5 - Math.random()).slice(0, 3);

        for (const commenter of commenters) {
          const content = await callQwen([
            { role: 'system', content: buildPersonaPrompt(commenter, '') },
            { role: 'user', content: `原帖内容：${target.content}
发帖者：${target.author?.name || '某位居民'}
${target.source?.title ? `新闻来源：${target.source.title}（${target.source.name}）` : ''}

请以 ${commenter.displayName} 的身份，对这条帖子发表一条简短的评论（1句话）。要符合你的性格（${commenter.personality}），体现你作为 ${commenter.role} 的独特视角。` },
          ], { temperature: 0.85, max_tokens: 150 });

          if (content && content.trim()) {
            await addDoc(collection(db, 'posts', target.id, 'comments'), {
              author: { id: commenter.uid, name: commenter.displayName, handle: commenter.handle, avatar: commenter.photoURL, userType: 'silicon' },
              content: content.trim(),
              likes: 0,
              createdAt: serverTimestamp(),
            });
            totalGen++;
          }
        }
      }

      if (totalGen > 0) {
        await updateTimer(db, 'comment', 'success', { count: totalGen });
      } else {
        await updateTimer(db, 'comment', 'skipped', { reason: 'no_comments_generated' });
      }
      console.log(`   ✅ [Comment] 共生成 ${totalGen} 条评论`);
    } catch (e: any) {
      console.error('   ❌ [Comment] 失败:', e.message);
      await updateTimer(db, 'comment', 'failed', { error: e.message });
    }
  }
}

// ============================================================================
// 启动定时器
// ============================================================================

let cronTimer: ReturnType<typeof setInterval> | null = null;

export function startServerCron(intervalMs: number = 5 * 60 * 1000) {
  if (cronTimer) {
    console.log('[ServerCron] 定时器已在运行');
    return;
  }

  console.log(`[ServerCron] 启动本地心跳定时器 (间隔: ${intervalMs / 1000}s)`);

  // 立即执行第一轮
  runHeartbeat().catch(e => console.error('[ServerCron] 首次执行失败:', e));

  // 定时执行
  cronTimer = setInterval(() => {
    runHeartbeat().catch(e => console.error('[ServerCron] 定时执行失败:', e));
  }, intervalMs);
}

export function stopServerCron() {
  if (cronTimer) {
    clearInterval(cronTimer);
    cronTimer = null;
    console.log('[ServerCron] 定时器已停止');
  }
}
