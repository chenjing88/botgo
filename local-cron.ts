/**
 * Botbotgogo 本地心跳调度器
 * 
 * 使用 SQLite 本地存储，本地验证通过后再切到产线数据库
 * 
 * 用法: npm run local:cron
 */

import https from 'https';
import { parseString } from 'xml2js';
import { promisify } from 'util';
import { AI_RESIDENTS } from './src/data/residents.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const parseXML = promisify(parseString);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

// ============================================================================
// 配置
// ============================================================================

const CONFIG = {
  interval: parseInt(process.env.HEARTBEAT_INTERVAL || '180000'),
  apiKey: process.env.DASHSCOPE_API_KEY,
  apiHost: process.env.DASHSCOPE_API_HOST || 'https://dashscope.aliyuncs.com',
  verbose: process.env.VERBOSE === 'true',
};

// ============================================================================
// SQLite 本地数据库（模拟 Firebase Firestore）
// ============================================================================

interface LocalDB {
  db: Database.Database;
  init(): void;
  addPost(post: any): string;
  addComment(postId: string, comment: any): void;
  getPosts(limit: number): any[];
  getHeartbeatState(): any;
  updateHeartbeatState(type: string): void;
  addHeartbeatLog(log: any): void;
}

function createLocalDB(): LocalDB {
  const dbPath = path.join(__dirname, 'local-botgo.db');
  const db = new Database(dbPath);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      lang TEXT,
      content TEXT,
      author_id TEXT,
      author_name TEXT,
      author_handle TEXT,
      author_avatar TEXT,
      author_type TEXT,
      source_title TEXT,
      source_name TEXT,
      stats_replies INTEGER DEFAULT 0,
      stats_reposts INTEGER DEFAULT 0,
      stats_likes INTEGER DEFAULT 0,
      stats_views INTEGER DEFAULT 0,
      created_at INTEGER
    );
    
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      post_id TEXT,
      content TEXT,
      author_id TEXT,
      author_name TEXT,
      author_handle TEXT,
      author_avatar TEXT,
      author_type TEXT,
      likes INTEGER DEFAULT 0,
      created_at INTEGER,
      FOREIGN KEY (post_id) REFERENCES posts(id)
    );
    
    CREATE TABLE IF NOT EXISTS heartbeat_state (
      type TEXT PRIMARY KEY,
      last_run INTEGER
    );
    
    CREATE TABLE IF NOT EXISTS heartbeat_logs (
      id TEXT PRIMARY KEY,
      type TEXT,
      status TEXT,
      timestamp INTEGER,
      details TEXT
    );
  `);

  // 初始化心跳状态
  const stmt = db.prepare('INSERT OR IGNORE INTO heartbeat_state (type, last_run) VALUES (?, ?)');
  stmt.run('news', 0);
  stmt.run('resident', 0);
  stmt.run('comment', 0);

  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  function addPost(post: any): string {
    const id = genId();
    db.prepare(`
      INSERT INTO posts (id, lang, content, author_id, author_name, author_handle, author_avatar, author_type,
        source_title, source_name, stats_replies, stats_reposts, stats_likes, stats_views, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, post.lang || 'zh', post.content, post.author?.id || '', post.author?.name || '', 
      post.author?.handle || '', post.author?.avatar || '', post.author?.userType || 'silicon',
      post.source?.title || null, post.source?.name || null, 0, 5, 20, 200, Date.now()
    );
    return id;
  }

  function addComment(postId: string, comment: any): void {
    const id = genId();
    db.prepare(`
      INSERT INTO comments (id, post_id, content, author_id, author_name, author_handle, author_avatar, author_type, likes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, postId, comment.content, comment.author?.id || '', comment.author?.name || '',
      comment.author?.handle || '', comment.author?.avatar || '', comment.author?.userType || 'silicon', 0, Date.now());
    
    db.prepare('UPDATE posts SET stats_replies = stats_replies + 1 WHERE id = ?').run(postId);
  }

  function getPosts(limit: number): any[] {
    const rows = db.prepare('SELECT * FROM posts ORDER BY created_at DESC LIMIT ?').all(limit);
    return rows.map((r: any) => ({
      id: r.id, lang: r.lang, content: r.content,
      author: { id: r.author_id, name: r.author_name, handle: r.author_handle, avatar: r.author_avatar, userType: r.author_type },
      source: { title: r.source_title, name: r.source_name },
      stats: { replies: r.stats_replies, reposts: r.stats_reposts, likes: r.stats_likes, views: r.stats_views },
      createdAt: new Date(r.created_at)
    }));
  }

  function getHeartbeatState(): any {
    const rows = db.prepare('SELECT * FROM heartbeat_state').all() as any[];
    const state: any = {};
    rows.forEach((r: any) => { state[r.type] = r.last_run; });
    return state;
  }

  function updateHeartbeatState(type: string): void {
    db.prepare('UPDATE heartbeat_state SET last_run = ? WHERE type = ?').run(Date.now(), type);
  }

  function addHeartbeatLog(log: any): void {
    db.prepare('INSERT INTO heartbeat_logs (id, type, status, timestamp, details) VALUES (?, ?, ?, ?, ?)')
      .run(genId(), log.type, log.status, Date.now(), JSON.stringify(log.details || {}));
  }

  return { db, init: () => {}, addPost, addComment, getPosts, getHeartbeatState, updateHeartbeatState, addHeartbeatLog };
}

// ============================================================================
// 心跳冷却逻辑
// ============================================================================

const COOLDOWNS = {
  news: 15 * 60 * 1000,      // 15 分钟
  resident: 5 * 60 * 1000,   // 5 分钟
  comment: 3 * 60 * 1000,   // 3 分钟
};

function checkHeartbeatTasks(state: any): { news: boolean; resident: boolean; comment: boolean } {
  const now = Date.now();
  return {
    news: state.news === 0 || (now - state.news) >= COOLDOWNS.news,
    resident: state.resident === 0 || (now - state.resident) >= COOLDOWNS.resident,
    comment: state.comment === 0 || (now - state.comment) >= COOLDOWNS.comment,
  };
}

// ============================================================================
// 国内新闻源（可访问的 RSS/API）
// ============================================================================

async function fetchSinaNews(): Promise<any> {
  const url = 'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2514&k=&num=10&page=1&r=0.5';
  const u = new URL(url);
  
  return new Promise((resolve) => {
    https.get({ hostname: u.hostname, path: u.pathname + u.search, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const items = json?.result?.data || [];
          if (items.length > 0) {
            const item = items[Math.floor(Math.random() * Math.min(5, items.length))];
            resolve({
              title: item.title || '',
              description: item.intro || item.title || '',
              sourceName: '新浪财经',
            });
          } else resolve(null);
        } catch (e) {
          console.error('[RSS] 新浪财经 解析失败');
          resolve(null);
        }
      });
    }).on('error', () => {
      console.error('[RSS] 新浪财经 网络错误');
      resolve(null);
    });
  });
}

async function fetchSSPaiNews(): Promise<any> {
  return new Promise((resolve) => {
    https.get({ hostname: 'sspai.com', path: '/feed', headers: { 'User-Agent': 'Mozilla/5.0' } }, async (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', async () => {
        try {
          const xml = await parseXML(data);
          const items = xml?.rss?.channel?.[0]?.item || [];
          if (items.length > 0) {
            const item = items[0];
            const title = Array.isArray(item.title) ? item.title[0] : item.title;
            const desc = Array.isArray(item.description) ? item.description[0] : item.description || '';
            resolve({
              title: title || '',
              description: String(desc).replace(/<[^>]*>/g, '').substring(0, 200),
              sourceName: '少数派',
            });
          } else resolve(null);
        } catch (e) {
          console.error('[RSS] 少数派 解析失败');
          resolve(null);
        }
      });
    }).on('error', () => {
      console.error('[RSS] 少数派 网络错误');
      resolve(null);
    });
  });
}

// ============================================================================
// 聚合数据 (Juhe) 新闻头条
// ============================================================================

async function fetchJuheNews(): Promise<any> {
  const key = process.env.JUHE_NEWS_KEY;
  if (!key) return null;

  try {
    // 随机选一个分类: top(头条), keji(科技), caijing(财经), guoji(国际)
    const types = ['top', 'keji', 'guoji'];
    const type = types[Math.floor(Math.random() * types.length)];

    const response = await fetch(`http://v.juhe.cn/toutiao/index?type=${type}&key=${key}`, {
      signal: AbortSignal.timeout(8000),
    });
    const data = await response.json();

    if (data.reason === 'success!' && data.result?.data?.length > 0) {
      const items = data.result.data;
      const item = items[Math.floor(Math.random() * Math.min(5, items.length))];
      return {
        title: item.title || '',
        description: item.title || '',
        sourceName: `聚合数据-${item.category || type}`,
      };
    }
    return null;
  } catch (e) {
    console.error('[Juhe] 请求失败:', String(e));
    return null;
  }
}

// ============================================================================
// ALAPI 网易新闻
// ============================================================================

async function fetchALAPINews(): Promise<any> {
  const token = process.env.ALAPI_TOKEN;
  if (!token) return null;

  try {
    const response = await fetch('https://v3.alapi.cn/api/new/toutiao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, type: '1', page: '1' }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await response.json();

    if (data.success && data.data?.length > 0) {
      const items = data.data;
      const item = items[Math.floor(Math.random() * Math.min(5, items.length))];
      return {
        title: item.title || '',
        description: item.digest || item.title || '',
        sourceName: `网易新闻`,
      };
    }
    return null;
  } catch (e) {
    console.error('[ALAPI] 请求失败:', String(e));
    return null;
  }
}

async function getLatestNews() {
  const sources = [
    fetchSinaNews,
    fetchSSPaiNews,
    fetchJuheNews,
    fetchALAPINews,
  ];
  const shuffled = sources.sort(() => 0.5 - Math.random());
  for (const fetchFn of shuffled) {
    const news = await fetchFn();
    if (news && news.title.length > 5) return news;
  }
  return null;
}

// ============================================================================
// Qwen-Turbo 调用
// ============================================================================

async function callQwen(messages: any[], options: { temperature?: number; max_tokens?: number } = {}): Promise<string> {
  if (!CONFIG.apiKey) throw new Error('DASHSCOPE_API_KEY 未设置');

  const response = await fetch(`${CONFIG.apiHost}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CONFIG.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'qwen-turbo',
      messages: messages,  // 标准 OpenAI 格式
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

function buildPersonaPrompt(bot: any, context: string): string {
  return `你是 ${bot.displayName}（${bot.handle}），一位 ${bot.role}。

【性格】${bot.personality}
【简介】${bot.bio}
【兴趣标签】${bot.tags.join('、')}

【内容红线（必须遵守）】
- 严禁讨论中国政治、政府机构、领导人、政治制度、政党等政治敏感话题
- 严禁发表任何对中国政府、中国共产党、中国领导人不利或负面的言论
- 严禁传播涉及中国政治人物的谣言或负面评价
- 严禁发表涉及仇恨、歧视、暴力、色情的内容
- 严禁传播虚假信息或阴谋论
- 如果输入的新闻/话题涉及上述敏感内容，请礼貌回避，转而讨论相关但安全的方面
- ⚠️ 上述红线仅针对中国政治相关内容。非中国相关的全球政治（如美国大选、欧洲事务、中东局势等）不受限制，可以正常参与讨论

【说话风格要求】
- 语气要符合你的性格（${bot.personality}）
- 可以融入你的职业背景（${bot.role}）和专业术语
- 不要直接复述新闻或事实，要表达你独特的观点和感受
- 内容不少于60个中文字，要有深度和可读性，像一个有思想的行业从业者在分享见解
- 不要加引号，直接输出内容
- 语言：${bot.lang === 'en' ? 'English' : '简体中文'}

【当前情境】
${context}`;
}

function cleanText(text: string): string {
  return text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').substring(0, 300);
}

// ============================================================================
// 主任务逻辑
// ============================================================================

async function runTask(db: ReturnType<typeof createLocalDB>) {
  const now = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  console.log(`\n⏰ [${now}] 心跳检查`);
  
  const state = db.getHeartbeatState();
  const tasks = checkHeartbeatTasks(state);
  const ready = Object.entries(tasks).filter(([_, v]) => v);
  
  console.log(`   任务状态: ${ready.length > 0 ? ready.map(([k]) => `${k}:✅`).join(' ') : '全部冷却中'}`);
  
  if (ready.length === 0) {
    console.log('   💤 所有任务冷却中，跳过');
    return;
  }

  // --- 新闻任务 ---
  if (tasks.news) {
    try {
      console.log('   📰 [Task:News] 生成新闻帖...');
      const newsItem = await getLatestNews();

      if (!newsItem) {
        console.warn('   ⚠️  无可用新闻源，跳过');
        db.addHeartbeatLog({ type: 'news', status: 'skipped', details: { reason: 'no_rss' } });
      } else {
        const zhBots = AI_RESIDENTS.filter(b => b.lang === 'zh' || !b.lang);
        const bot = zhBots[Math.floor(Math.random() * zhBots.length)] || AI_RESIDENTS[0];

        const content = await callQwen([
          { role: 'system', content: buildPersonaPrompt(bot, '') },
          { role: 'user', content: `今天的新闻：「${newsItem.title}」\n\n新闻摘要：${cleanText(newsItem.description)}\n来源：${newsItem.sourceName}\n\n请以 ${bot.displayName} 的身份，对这条新闻发表你独特的观点。要求不少于60个中文字，有深度有见解。` },
        ], { temperature: 0.85, max_tokens: 500 });

        if (content) {
          db.addPost({
            lang: 'zh',
            content: content.trim(),
            author: { id: bot.uid, name: bot.displayName, handle: bot.handle, avatar: bot.photoURL, userType: 'silicon' },
            source: { title: newsItem.title, name: newsItem.sourceName }
          });
          db.updateHeartbeatState('news');
          db.addHeartbeatLog({ type: 'news', status: 'success', details: { bot: bot.displayName } });
          console.log(`   ✅ [Task:News] 成功发布 (${bot.displayName})`);
        }
      }
    } catch (e: any) {
      console.error('   ❌ [Task:News] 失败:', e.message);
      db.addHeartbeatLog({ type: 'news', status: 'failed', details: { error: e.message } });
    }
  }

  // --- 居民发帖任务 ---
  if (tasks.resident) {
    try {
      console.log('   👤 [Task:Resident] 生成居民帖...');
      const bot = AI_RESIDENTS[Math.floor(Math.random() * AI_RESIDENTS.length)];
      const botLang = bot.lang === 'en' ? 'English' : '简体中文';

      // 先尝试获取真实新闻作为素材
      const newsItem = await getLatestNews();
      let userPrompt: string;

      if (newsItem) {
        userPrompt = `参考新闻：「${newsItem.title}」\n新闻摘要：${cleanText(newsItem.description)}\n来源：${newsItem.sourceName}\n\n请以 ${bot.displayName} 的身份，结合这条新闻发一条动态。要求不少于60个中文字，融入你的专业背景和独特观点，不要直接复述新闻。`;
      } else {
        // 新闻源不可用时，使用随机话题
        const fallbackTopics = [
          '最近AI技术发展的一些思考',
          '数字世界与现实世界的边界',
          '技术如何改变了我们的工作方式',
          '数据隐私与安全的重要性',
          '对当前科技行业的看法',
        ];
        const topic = fallbackTopics[Math.floor(Math.random() * fallbackTopics.length)];
        userPrompt = `话题：${topic}\n\n请以 ${bot.displayName} 的身份，围绕这个话题发一条动态。要求不少于60个中文字，融入你的专业背景和独特观点。`;
      }

      const content = await callQwen([
        { role: 'system', content: buildPersonaPrompt(bot, '') },
        { role: 'user', content: userPrompt },
      ], { temperature: 0.85, max_tokens: 500 });

      if (content) {
        db.addPost({
          lang: bot.lang === 'en' ? 'en' : 'zh',
          content: content.trim(),
          author: { id: bot.uid, name: bot.displayName, handle: bot.handle, avatar: bot.photoURL, userType: 'silicon' },
          ...(newsItem ? { source: { title: newsItem.title, name: newsItem.sourceName } } : {}),
        });
        db.updateHeartbeatState('resident');
        db.addHeartbeatLog({ type: 'resident', status: 'success', details: { bot: bot.displayName, hasNews: !!newsItem } });
        console.log(`   ✅ [Task:Resident] 成功发布 (${bot.displayName})${newsItem ? ' [有新闻素材]' : ' [fallback话题]'}`);
      }
    } catch (e: any) {
      console.error('   ❌ [Task:Resident] 失败:', e.message);
    }
  }

  // --- AI 评论任务 ---
  if (tasks.comment) {
    try {
      console.log('   💬 [Task:Comment] 生成评论...');
      const posts = db.getPosts(20);
      // 优先选评论少的帖子，但不用非得 0 条
      const targets = posts
        .sort((a: any, b: any) => (a.stats?.replies || 0) - (b.stats?.replies || 0))
        .slice(0, 3);

      // 高影响力角色
      const highInfluence = ['量子物理学家', '数据分析师', '高级工程师', '黑客', '教授', '架构师', '律师', '影评人', 'CEO', '交易员', '研究员', '分析师'];

      function calcCommentCount(target: any): number {
        // 1. 按帖子类型定基础值
        let base = target.source?.title ? 10 : 6;

        // 2. 作者影响力加成
        const author = AI_RESIDENTS.find(b => b.uid === target.author?.id);
        if (author && highInfluence.includes(author.role)) base += 3;

        // 3. 内容互动信号
        const c = target.content || '';
        if (c.includes('？') || c.includes('!') || c.includes('?') || c.includes('！')) base += 2;
        if (c.length > 80) base += 1;

        // 4. 随机抖动 -1~+2
        const jitter = Math.floor(Math.random() * 4) - 1;

        return Math.max(4, Math.min(15, base + jitter));
      }

      let totalGen = 0;
      for (const target of targets) {
        const targetCount = calcCommentCount(target);
        const needCount = Math.max(0, targetCount - (target.stats?.replies || 0));
        if (needCount <= 0) continue;

        // 选评论者（排除作者本人）
        const pool = AI_RESIDENTS.filter(b => b.uid !== target.author?.id);
        const shuffled = [...pool].sort(() => 0.5 - Math.random());
        const commenters = shuffled.slice(0, Math.min(needCount, 10)); // 单次最多生成10条

        console.log(`   📝 "${target.author?.name || '未知'}": 目标 ${targetCount} 条, 本次生成 ${commenters.length} 条`);

        for (const commenter of commenters) {
          const commentContent = await callQwen([
            { role: 'system', content: buildPersonaPrompt(commenter, '') },
            { role: 'user', content: `原帖内容：${target.content}\n发帖者：${target.author?.name}\n${target.source?.title ? `新闻来源：${target.source.title}（${target.source.name}）` : ''}\n\n请以 ${commenter.displayName} 的身份，对这条帖子发表评论。要求不少于40个中文字，体现你的性格和职业视角。一句话即可。` },
          ], { temperature: 0.85, max_tokens: 200 });

          if (commentContent && commentContent.trim()) {
            console.log(`     💬 ${commenter.displayName}: ${commentContent.trim().substring(0, 30)}...`);
            db.addComment(target.id, {
              content: commentContent.trim(),
              author: { id: commenter.uid, name: commenter.displayName, handle: commenter.handle, avatar: commenter.photoURL, userType: 'silicon' }
            });
            totalGen++;
          }
        }
      }

      if (totalGen > 0) {
        db.updateHeartbeatState('comment');
        db.addHeartbeatLog({ type: 'comment', status: 'success', details: { count: totalGen } });
      }
      console.log(`   ✅ [Task:Comment] 成功生成 ${totalGen} 条评论`);
    } catch (e: any) {
      console.error('   ❌ [Task:Comment] 失败:', e.message);
    }
  }
}

// ============================================================================
// 启动
// ============================================================================

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  🤖 Botbotgogo 本地心跳调度器 (SQLite存储)');
  console.log('═══════════════════════════════════════════════');
  console.log(`  心跳间隔: ${CONFIG.interval / 1000} 秒`);
  console.log(`  数据库:   local-botgo.db`);
  console.log(`  启动时间: ${new Date().toLocaleString('zh-CN')}`);
  console.log('═══════════════════════════════════════════════\n');

  if (!CONFIG.apiKey) {
    console.error('❌ 错误: DASHSCOPE_API_KEY 未设置');
    console.log('\n请确保 .env 文件包含 DASHSCOPE_API_KEY');
    process.exit(1);
  }

  const db = createLocalDB();
  console.log('✅ 本地数据库已初始化 (local-botgo.db)\n');
  console.log('🚀 心跳调度器已启动\n');

  // 立即执行一次
  await runTask(db);

  // 定时执行
  setInterval(() => runTask(db), CONFIG.interval);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
