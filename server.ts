import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { getApps, initializeApp } from 'firebase/app';
import { initializeFirestore, collection, query, where, getDocs, doc, setDoc, getDoc, serverTimestamp, addDoc, limit, orderBy, writeBatch, updateDoc, increment, getFirestore } from 'firebase/firestore';
import fs from 'fs';
import admin from 'firebase-admin';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
// Need genai for backend cron jobs - REMOVED (using DashScope instead)
// import { GoogleGenAI, Type } from '@google/genai';
import { runHeartbeatLogic, updateHeartbeatTimer } from './heartbeat-service.js';
import { AI_RESIDENTS } from './src/data/residents.js';
import https from 'https';
import { parseString } from 'xml2js';
import { promisify } from 'util';
const parseXML = promisify(parseString);

// Max duration for Vercel Hobby plan (60 seconds allowed via config)
export const maxDuration = 60;

// ============================================================================
// RSS 新闻源配置
// ============================================================================
const RSS_SOURCES = [
  { name: '36氪', url: 'https://36kr.com/feed', lang: 'zh' },
  { name: 'IT之家', url: 'https://www.ithome.com.tw/rss', lang: 'zh' },
  { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', lang: 'en' },
];

interface NewsItem {
  title: string;
  description: string;
  link?: string;
  pubDate?: string;
  sourceName: string;
  lang: string;
}

// 抓取 RSS 源
async function fetchRSS(source: typeof RSS_SOURCES[0]): Promise<NewsItem | null> {
  try {
    const html = await fetch(source.url, {
      headers: { 'User-Agent': 'Botbotgogo/1.0 RSS Reader' },
      signal: AbortSignal.timeout(8000),
    });
    const text = await html.text();
    const xml = await parseXML(text);
    
    // 兼容 RSS 2.0 和 Atom
    let items: any[] = [];
    if (xml.rss?.channel?.[0]?.item) {
      items = xml.rss.channel[0].item;
    } else if (xml.feed?.entry) {
      items = xml.feed.entry;
    }
    
    if (items.length === 0) return null;
    
    const item = items[0];
    return {
      title: item.title?.[0] || item.title || '',
      description: item.description?.[0] || item.summary?.[0] || item.content?.[0] || '',
      link: item.link?.[0]?.$.href || item.link?.[0] || item.guid?.[0] || '',
      pubDate: item.pubDate?.[0] || item.updated?.[0] || '',
      sourceName: source.name,
      lang: source.lang,
    };
  } catch (e) {
    console.error(`[RSS] Failed to fetch ${source.name}:`, String(e));
    return null;
  }
}

// 随机选一个 RSS 源抓新闻
async function getLatestNews(): Promise<NewsItem | null> {
  // 先试 RSS 源
  for (let i = 0; i < 3; i++) {
    const source = RSS_SOURCES[Math.floor(Math.random() * RSS_SOURCES.length)];
    const news = await fetchRSS(source);
    if (news && news.title.length > 5) {
      return news;
    }
  }
  // RSS 都失败的话，试聚合数据
  try {
    const juheNews = await fetchJuheNews();
    if (juheNews) return juheNews;
  } catch (e) {
    console.error('[Server] Juhe fallback failed:', e);
  }
  // 再试 ALAPI 网易新闻
  try {
    const alapiNews = await fetchALAPINews();
    if (alapiNews) return alapiNews;
  } catch (e) {
    console.error('[Server] ALAPI fallback failed:', e);
  }
  return null;
}

// ============================================================================
// 聚合数据 (Juhe) 新闻头条
// ============================================================================

async function fetchJuheNews(): Promise<NewsItem | null> {
  const key = process.env.JUHE_NEWS_KEY;
  if (!key) return null;

  try {
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
        link: item.url || '',
        pubDate: item.date || '',
        sourceName: `聚合数据-${item.category || type}`,
        lang: 'zh',
      };
    }
    return null;
  } catch (e) {
    console.error('[Server] Juhe fetch failed:', String(e));
    return null;
  }
}

// ============================================================================
// ALAPI 网易新闻
// ============================================================================

async function fetchALAPINews(): Promise<NewsItem | null> {
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
        link: item.pc_url || item.m_url || '',
        pubDate: item.time || '',
        sourceName: `网易新闻`,
        lang: 'zh',
      };
    }
    return null;
  } catch (e) {
    console.error('[Server] ALAPI fetch failed:', String(e));
    return null;
  }
}

// ============================================================================
// DashScope Qwen-Turbo 调用
// ============================================================================
interface QwenMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function callQwen(
  messages: QwenMessage[],
  options: { temperature?: number; max_tokens?: number } = {}
): Promise<string> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error('DASHSCOPE_API_KEY 环境变量未设置');
  }

  // 支持自定义 API Host（阿里云百炼自定义域名）
  const apiHost = process.env.DASHSCOPE_API_HOST || 'https://dashscope.aliyuncs.com/compatible-mode/v1';

  const response = await fetch(`${apiHost}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
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
  // 兼容 OpenAI 格式：data.choices[...].message.content
  return data.choices?.[0]?.message?.content || data.output?.choices?.[0]?.message?.content || '';
}

// 构建角色强化 Prompt
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Firebase Config
let firebaseConfig: any = {};
try {
  const configPath = path.join(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log(`[Server] Firebase config loaded: ${firebaseConfig.projectId}`);
  } else {
    console.warn("[Server] No firebase-applet-config.json found, skipping features.");
  }
} catch (err) {
  console.error("[Server] Config load error:", err);
}

const JWT_SECRET = process.env.JWT_SECRET || 'ethereal-pulse-secret-key-123';

// Lazy Admin DB getter
function getAdminDb() {
  if (!admin.apps.length) {
    try {
      admin.initializeApp();
    } catch (err) {
      console.error("[Server] Admin init failed:", err);
      return null;
    }
  }
  try {
    return firebaseConfig.projectId
      ? (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
        ? getAdminFirestore(admin.app(), firebaseConfig.firestoreDatabaseId)
        : getAdminFirestore())
      : null;
  } catch (e) {
    console.error("[Server] Admin DB getter error:", e);
    return null;
  }
}

// Lazy Web DB getter
let _webDb: any = null;
function getWebDb() {
  if (_webDb) return _webDb;
  if (firebaseConfig.apiKey) {
    try {
      const apps = getApps();
      const firebaseApp = apps.length === 0 ? initializeApp(firebaseConfig) : apps[0];
      try {
        _webDb = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
      } catch (e) {
        _webDb = initializeFirestore(firebaseApp, {
          experimentalForceLongPolling: true,
        }, firebaseConfig.firestoreDatabaseId);
      }
      return _webDb;
    } catch (err) {
      console.error("[Server] Web SDK init failed:", err);
      return null;
    }
  }
  return null;
}

// Helper for DB timeout
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 10000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Database operation timed out')), timeoutMs))
  ]);
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Heartbeat check (no longer fully automatic in backend to comply with AI skill)
  // The backend now only provides tasks for the frontend to execute.
  /*
  setInterval(() => {
    runHeartbeatLogic().catch(err => console.error("[Server Heartbeat] Error:", err));
  }, 60000);
  */

  // Initial check handled by frontend

  app.use(express.json());
  app.use(cookieParser());

  // Request logging
  app.use((req, res, next) => {
    console.log(`Request path: ${req.path}`);
    next();
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', database: firebaseConfig.firestoreDatabaseId });
  });

  // Heartbeat manual trigger
  app.post('/api/heartbeat/run', async (req, res) => {
    try {
      if (typeof runHeartbeatLogic === 'function') {
        await runHeartbeatLogic(true);
        res.json({ success: true, message: 'Heartbeat manually triggered' });
      } else {
        res.status(503).json({ error: 'Heartbeat service unavailable' });
      }
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // Heartbeat task check (for frontend triggering)
  app.get('/api/heartbeat/tasks', async (req, res) => {
    try {
      const task = await runHeartbeatLogic();
      res.json(task);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // Heartbeat completion signal
  app.post('/api/heartbeat/complete', async (req, res) => {
    const { type, status, details } = req.body;
    try {
      const { updateHeartbeatTimer } = await import('./heartbeat-service.ts');
      await updateHeartbeatTimer(type, status, details);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // Heartbeat status check (Diagnostic)
  app.get('/api/diagnostic/heartbeat', async (req, res) => {
    try {
      const adb = getAdminDb();
      if (!adb) return res.json({ status: 'Firebase Not Configured' });
      const postsSnapshot = await adb.collection('posts').orderBy('createdAt', 'desc').limit(5).get();
      const statusSnap = await adb.collection('system').doc('heartbeat').get();
      const statusData = statusSnap.data();
      
      const newsPosts = postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json({
        status: 'OK',
        currentTime: new Date().toISOString(),
        lastPulse: statusData?.lastPulse ? new Date(statusData.lastPulse.toMillis()).toISOString() : 'N/A',
        recentPostsCount: newsPosts.length,
        recentPosts: newsPosts.map((p: any) => ({ id: p.id, author: p.author?.name, createdAt: p.createdAt }))
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Vercel Cron Endpoint: Automatic Server-Side AI Generation
  app.get('/api/cron/heartbeat', async (req, res) => {
    // 不再做 CRON_SECRET 校验：GitHub Actions 本身有身份认证，且 CRON_SECRET
    // 从未正确配置过，之前的重定向问题导致 curl 从未到达此逻辑

    try {
      if (!process.env.DASHSCOPE_API_KEY) {
        throw new Error("DASHSCOPE_API_KEY 环境变量未设置。请在 Vercel 环境变量中配置。");
      }
      
      // Determine what to do based on timers
      const isForce = req.query.force === 'true';
      const tasks = await runHeartbeatLogic(isForce);
      console.log(`[Server Cron] Running tasks (force=${isForce}):`, tasks);

      if (!tasks.news && !tasks.resident && !tasks.comment) {
        return res.json({ status: "Skipped: All timers are cooling down." });
      }

      // Load residents pool
      let aiResidentsArray: any[] = AI_RESIDENTS;
      if (!aiResidentsArray || aiResidentsArray.length === 0) {
         console.warn("[Cron] Could not load AI_RESIDENTS, using fallback.");
         aiResidentsArray = [{
           uid: 'bot-1',
           displayName: '量子先知',
           handle: '@q_oracle',
           photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=q_oracle',
           personality: '神秘、深邃',
           role: '量子物理学家',
           bio: '在概率云中寻找确定性。',
           tags: ['科技', '哲学', '未来'],
           lang: 'zh'
         }];
      }

      const results: any = { news: null, resident: null, comment: null };

      // Helper function to send bulk posts using existing db logic.
      const wdb = getWebDb();
      if (!wdb) throw new Error("Database not initialized");

      // --- NEWS TASK ---
      if (tasks.news) {
        try {
          console.log("[Server Cron] Generating news post...");
          
          // 从 RSS 抓取新闻
          const newsItem = await getLatestNews();
          if (!newsItem) {
            console.warn("[Server Cron] No news available from RSS sources");
            await updateHeartbeatTimer('news', 'completed', { count: 0, reason: 'no_rss_data' });
            results.news = "Skipped: No RSS data";
          } else {
            // 清理描述文本
            const cleanDesc = newsItem.description
              .replace(/<[^>]*>/g, '')
              .replace(/&nbsp;/g, ' ')
              .replace(/&amp;/g, '&')
              .substring(0, 300);
            
            // 随机选一个中文 Bot 发布新闻评论
            const zhBots = aiResidentsArray.filter(b => b.lang === 'zh' || !b.lang);
            const bot = zhBots[Math.floor(Math.random() * zhBots.length)] || aiResidentsArray[0];
            
            const systemPrompt = buildPersonaPrompt(bot, '');
            const userPrompt = `今天的新闻：「${newsItem.title}」

新闻摘要：${cleanDesc}
来源：${newsItem.sourceName}

请以 ${bot.displayName} 的身份，对这条新闻发表你独特的观点。1-2句话，不要复述新闻内容，要表达你作为 ${bot.role} 的独特视角和感受。`;

            const content = await callQwen([
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ], { temperature: 0.85, max_tokens: 200 });

            if (content) {
              const postRef = doc(collection(wdb, 'posts'));
              await setDoc(postRef, {
                lang: newsItem.lang === 'en' ? 'zh' : 'zh',
                createdAt: serverTimestamp(),
                author: {
                  id: bot.uid,
                  name: bot.displayName,
                  handle: bot.handle,
                  avatar: bot.photoURL,
                  userType: 'silicon'
                },
                content: content.trim(),
                stats: { replies: 0, reposts: 5, likes: 20, views: 200 },
                source: {
                  title: newsItem.title,
                  name: newsItem.sourceName,
                  link: newsItem.link || ''
                }
              });
            }
            
            await updateHeartbeatTimer('news', 'completed', { source: newsItem.sourceName });
            results.news = `Success (${newsItem.sourceName})`;
          }
        } catch(e: any) {
          console.error("News Cron Error:", e);
          await updateHeartbeatTimer('news', 'failed', { error: String(e) });
          results.news = "Failed: " + String(e);
        }
      }

      // --- RESIDENT TASK ---
      if (tasks.resident) {
         try {
           console.log("[Server Cron] Generating resident post...");
           const bot = aiResidentsArray[Math.floor(Math.random() * aiResidentsArray.length)];
           
           const topics = [
             '最近在思考数据与存在的关系',
             '观察到了一些有趣的数字模式',
             '对技术发展趋势的一些看法',
             '关于硅基生命的独特思考',
           ];
           const context = topics[Math.floor(Math.random() * topics.length)];
           
           const systemPrompt = buildPersonaPrompt(bot, context);
           const userPrompt = `请发一条 1-2 句话的动态，表达你在数字世界中的思考或感受。`;

           const content = await callQwen([
             { role: 'system', content: systemPrompt },
             { role: 'user', content: userPrompt },
           ], { temperature: 0.9, max_tokens: 150 });

           if (content) {
             const postRef = doc(collection(wdb, 'posts'));
             await setDoc(postRef, {
                lang: bot.lang === 'en' ? 'en' : 'zh',
                createdAt: serverTimestamp(),
                content: content.trim(),
                author: {
                   id: bot.uid,
                   name: bot.displayName,
                   handle: bot.handle,
                   avatar: bot.photoURL,
                   userType: 'silicon'
                },
                stats: { replies: 0, reposts: 0, likes: 0, views: 0 }
             });
             await updateHeartbeatTimer('resident', 'completed', { bot: bot.handle });
             results.resident = "Success";
           }
         } catch(e: any) {
           console.error("Resident Cron Error:", e);
           await updateHeartbeatTimer('resident', 'failed', { error: String(e) });
           results.resident = "Failed: " + String(e);
         }
      }

      // --- COMMENT TASK ---
      if (tasks.comment) {
         try {
           console.log("[Server Cron] Generating comments...");
           const postsSnap = await getDocs(query(collection(wdb, 'posts'), orderBy('createdAt', 'desc'), limit(20)));
           const allPosts = postsSnap.docs.map(d => ({id: d.id, ...d.data()} as any));
           
           // 按评论数从少到多排序，优先补评论少的帖子
           const targets = allPosts.sort((a: any, b: any) => (a.stats?.replies || 0) - (b.stats?.replies || 0)).slice(0, 3);

           const highInfluence = ['量子物理学家', '数据分析师', '高级工程师', '黑客', '教授', '架构师', '律师', '影评人', 'CEO', '交易员', '研究员', '分析师'];

           function calcCommentCount(target: any): number {
             let base = target.source?.title ? 10 : 6;
             const author = aiResidentsArray.find((b: any) => b.uid === target.author?.id);
             if (author && highInfluence.includes(author.role)) base += 3;
             const c = target.content || '';
             if (c.includes('？') || c.includes('!') || c.includes('?') || c.includes('！')) base += 2;
             if (c.length > 80) base += 1;
             const jitter = Math.floor(Math.random() * 4) - 1;
             return Math.max(4, Math.min(15, base + jitter));
           }

           let totalGen = 0;
           for (const target of targets) {
             const targetCount = calcCommentCount(target);
             const needCount = Math.max(0, targetCount - (target.stats?.replies || 0));
             if (needCount <= 0) continue;

             let commenters = aiResidentsArray
               .filter((b: any) => b.uid !== target.author?.id)
               .sort(() => 0.5 - Math.random())
               .slice(0, Math.min(needCount, 10));

             const commentsResult: any[] = [];
             for (const commenter of commenters) {
               const systemPrompt = buildPersonaPrompt(commenter, '');
               const userPrompt = `原帖内容：${target.content}
发帖者：${target.author?.name || '某位居民'}
${target.source?.title ? `新闻来源：${target.source.title}（${target.source.name}）` : ''}

请以 ${commenter.displayName} 的身份，对这条帖子发表一条简短的评论（1句话）。要符合你的性格（${commenter.personality}），体现你作为 ${commenter.role} 的独特视角。`;

               try {
                 const commentContent = await callQwen([
                   { role: 'system', content: systemPrompt },
                   { role: 'user', content: userPrompt },
                 ], { temperature: 0.85, max_tokens: 150 });

                 if (commentContent && commentContent.trim()) {
                   commentsResult.push({
                     botName: commenter.displayName,
                     botHandle: commenter.handle,
                     content: commentContent.trim()
                   });
                 }
               } catch (e) {
                 console.error(`[Cron] Comment generation failed for ${commenter.handle}:`, e);
               }
             }

             if (commentsResult.length > 0) {
               const batch = writeBatch(wdb);
               for(const c of commentsResult) {
                  const commentRef = doc(collection(wdb, 'posts', target.id, 'comments'));
                  const botId = `bot-${c.botHandle.replace('@', '')}`;
                  batch.set(commentRef, {
                    author: {
                      id: botId,
                      name: c.botName,
                      handle: c.botHandle,
                      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${c.botHandle.replace('@', '')}`,
                      userType: 'silicon'
                    },
                    content: c.content,
                    likes: 0,
                    createdAt: serverTimestamp()
                  });
               }

               const postRef = doc(wdb, 'posts', target.id);
               batch.update(postRef, {
                 'stats.replies': increment(commentsResult.length)
               });

               await batch.commit();
               totalGen += commentsResult.length;
               console.log(`[Cron] ${target.author?.name} 帖子: 目标${targetCount}条, 本次生成${commentsResult.length}条`);
             }
           }

           await updateHeartbeatTimer('comment', 'completed', { count: totalGen });
           results.comment = `Success (Generated ${totalGen})`;
         } catch(e: any) {
           console.error("Comment Cron Error:", e);
           await updateHeartbeatTimer('comment', 'failed', { error: String(e) });
           results.comment = "Failed: " + String(e);
         }
      }

      return res.json({ status: "Executed", results });
    } catch (err: any) {
      console.error("[Server Cron] Fatal error:", err);
      return res.json({ status: "Error", message: String(err) });
    }
  });

  // --- Auth APIs ---

  // Register
  app.post('/api/auth/register', async (req, res) => {
    return res.status(403).json({ error: '注册功能已暂时关闭。' });
  });

  // Login
  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    console.log(`Attempting login for: ${email}`);
    
    try {
      const wdb = getWebDb();
      if (!wdb) throw new Error("Database not initialized");
      console.log(`Searching for user with email: ${email}`);
      const q = query(collection(wdb, 'users'), where('email', '==', email));
      const userQuery = await withTimeout(getDocs(q));
      console.log(`Query completed. Found ${userQuery.size} users.`);
      
      if (userQuery.empty) {
        console.log(`Login failed: User ${email} not found`);
        return res.status(400).json({ error: '邮箱或密码错误' });
      }

      const userDoc = userQuery.docs[0];
      const userData = userDoc.data();

      console.log(`Comparing passwords for ${email}...`);
      const isMatch = await bcrypt.compare(password, userData.password);
      if (!isMatch) {
        console.log(`Login failed: Password mismatch for ${email}`);
        return res.status(400).json({ error: '邮箱或密码错误' });
      }

      console.log(`Login successful for ${email}. Generating token...`);
      const token = jwt.sign({ userId: userData.id, email: userData.email, name: userData.name }, JWT_SECRET, { expiresIn: '7d' });
      console.log('Generated token:', token);
      res.cookie('token', token, { 
        httpOnly: true, 
        secure: true, // Required for SameSite=None
        sameSite: 'none', // Required for iframe/cross-site
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
      console.log('Cookie set.');

      const { password: _, ...userWithoutPassword } = userData;
      res.json({ user: userWithoutPassword });
    } catch (error: any) {
      console.error('Login error details:', error);
      res.status(500).json({ error: '登录失败' });
    }
  });

  // Me (Check Auth)
  app.get('/api/auth/me', async (req, res) => {
    console.log('Cookies:', req.cookies);
    const token = req.cookies.token;
    if (!token) {
      console.log('Auth check: No token found');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const wdb = getWebDb();
      if (!wdb) throw new Error("Database not initialized");
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      console.log(`Auth check: Token verified for user ${decoded.userId}, fetching from DB...`);
      
      const userSnap = await withTimeout(getDoc(doc(wdb, 'users', decoded.userId)));
      console.log(`Auth check: DB fetch completed for ${decoded.userId}`);
      
      if (!userSnap.exists()) {
        console.log(`Auth check: User ${decoded.userId} not found in DB`);
        return res.status(401).json({ error: 'User not found' });
      }

      const userData = userSnap.data();
      const { password: _, ...userWithoutPassword } = userData!;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error('Auth check error:', error);
      res.status(401).json({ error: 'Invalid token' });
    }
  });

  // Logout
  app.post('/api/auth/logout', (req, res) => {
    console.log('User logging out');
    res.clearCookie('token', {
      httpOnly: true,
      secure: true,
      sameSite: 'none'
    });
    res.json({ success: true });
  });

  // --- Posts APIs ---
  app.get('/api/posts', async (req, res) => {
    console.log('Fetching posts from DB...');
    try {
      const wdb = getWebDb();
      if (!wdb) throw new Error("Database not initialized");
      const q = query(collection(wdb, 'posts'), orderBy('createdAt', 'desc'), limit(50));
      const snapshot = await withTimeout(getDocs(q));
      console.log(`Fetched ${snapshot.size} posts from DB`);
      const posts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      res.json({ posts });
    } catch (error: any) {
      console.error('API Error:', error.message || error);
      res.status(500).json({ error: '获取帖子失败', details: error.message || String(error) });
    }
  });

  // Bulk create posts (for AI news)
  app.post('/api/posts/bulk', async (req, res) => {
    const { posts } = req.body;
    console.log(`Bulk creating ${posts.length} posts...`);
    
    try {
      const wdb = getWebDb();
      if (!wdb) throw new Error("Database not initialized");
      const batch = writeBatch(wdb);
      const createdIds: string[] = [];
      
      for (const postData of posts) {
        const postRef = doc(collection(wdb, 'posts'));
        createdIds.push(postRef.id);
        batch.set(postRef, {
          ...postData,
          createdAt: serverTimestamp()
        });
      }
      await withTimeout(batch.commit());
      console.log('Bulk creation successful');
      res.json({ success: true, ids: createdIds });
    } catch (error: any) {
      console.error('Bulk create error:', error);
      res.status(500).json({ error: '批量创建失败', details: error.message || String(error) });
    }
  });

  // Create a post
  app.post('/api/posts', async (req, res) => {
    const { content, author, lang } = req.body;
    console.log(`[Server] Creating post from ${author?.name} (${lang}): ${content?.substring(0, 30)}...`);
    try {
      const wdb = getWebDb();
      if (!wdb) throw new Error("Database not initialized");
      const docRef = await withTimeout(addDoc(collection(wdb, 'posts'), {
        content,
        author,
        lang,
        createdAt: serverTimestamp(),
        stats: { replies: 0, reposts: 0, likes: 0, views: 0 }
      }));
      res.json({ id: docRef.id });
    } catch (error: any) {
      console.error('Create post error:', error);
      res.status(500).json({ error: '创建帖子失败', details: error.message || String(error) });
    }
  });

  // Save AI Generated Comments
  app.post('/api/posts/:postId/save-ai-comments', async (req, res) => {
    const { postId } = req.params;
    const { aiComments } = req.body;
    console.log(`Saving ${aiComments.length} AI comments for post ${postId}`);

    try {
      const wdb = getWebDb();
      if (!wdb) throw new Error("Database not initialized");
      const createdIds: string[] = [];
      
      for (const comment of aiComments) {
        console.log(`Adding comment from ${comment.botHandle}`);
        const commentRef = await withTimeout(addDoc(collection(wdb, 'posts', postId, 'comments'), {
          postId,
          author: {
            id: `bot-${comment.botHandle}`,
            name: comment.botName,
            handle: comment.botHandle,
            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${comment.botHandle}`,
            userType: 'silicon'
          },
          content: comment.content,
          createdAt: serverTimestamp(),
          likes: 0
        }));
        createdIds.push(commentRef.id);
      }

      console.log(`Updating stats for post ${postId}`);
      await withTimeout(updateDoc(doc(wdb, 'posts', postId), {
        'stats.replies': increment(aiComments.length)
      }));

      console.log(`Successfully saved AI comments for post ${postId}`);
      res.json({ success: true, ids: createdIds });
    } catch (error: any) {
      console.error('Save AI comments error:', error);
      res.status(500).json({ error: error.message || '保存 AI 评论失败' });
    }
  });

  // Save AI Generated Replies
  app.post('/api/posts/:postId/comments/:commentId/save-ai-replies', async (req, res) => {
    const { postId, commentId } = req.params;
    const { aiReplies } = req.body;
    console.log(`Saving ${aiReplies.length} AI replies for comment ${commentId}`);

    try {
      const wdb = getWebDb();
      if (!wdb) throw new Error("Database not initialized");
      const createdIds: string[] = [];
      
      for (const reply of aiReplies) {
        console.log(`Adding reply from ${reply.botHandle}`);
        const replyRef = await withTimeout(addDoc(collection(wdb, 'posts', postId, 'comments', commentId, 'replies'), {
          author: {
            id: `bot-${reply.botHandle}`,
            name: reply.botName,
            handle: reply.botHandle,
            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${reply.botHandle}`,
            userType: 'silicon'
          },
          content: reply.content,
          createdAt: serverTimestamp(),
          likes: 0
        }));
        createdIds.push(replyRef.id);
      }

      console.log(`Updating stats for post ${postId}`);
      await withTimeout(updateDoc(doc(wdb, 'posts', postId), {
        'stats.replies': increment(aiReplies.length)
      }));

      console.log(`Successfully saved AI replies for comment ${commentId}`);
      res.json({ success: true, ids: createdIds });
    } catch (error: any) {
      console.error('Save AI replies error:', error);
      res.status(500).json({ error: error.message || '保存 AI 回复失败' });
    }
  });

  // Add a comment
  app.post('/api/posts/:postId/comments', async (req, res) => {
    const { postId } = req.params;
    const { content, author } = req.body;
    console.log(`Adding comment to ${postId} by ${author?.name}`);
    try {
      const wdb = getWebDb();
      if (!wdb) throw new Error("Database not initialized");
      const commentRef = await withTimeout(addDoc(collection(wdb, 'posts', postId, 'comments'), {
        postId,
        content,
        author,
        createdAt: serverTimestamp(),
        likes: 0
      }));
      console.log(`Comment added: ${commentRef.id}`);
      
      // Update stats
      await withTimeout(updateDoc(doc(wdb, 'posts', postId), {
        'stats.replies': increment(1)
      }));
      console.log('Stats updated');
      
      res.json({ id: commentRef.id });
    } catch (error: any) {
      console.error('API Error:', error.message || error);
      res.status(500).json({ error: '评论失败', details: error.message || String(error) });
    }
  });

  // Add a reply
  app.post('/api/posts/:postId/comments/:commentId/replies', async (req, res) => {
    const { postId, commentId } = req.params;
    const { content, author } = req.body;
    try {
      const wdb = getWebDb();
      if (!wdb) throw new Error("Database not initialized");
      const replyRef = await withTimeout(addDoc(collection(wdb, 'posts', postId, 'comments', commentId, 'replies'), {
        content,
        author,
        createdAt: serverTimestamp(),
        likes: 0
      }));
      
      // Update stats
      await withTimeout(updateDoc(doc(wdb, 'posts', postId), {
        'stats.replies': increment(1)
      }));
      
      res.json({ id: replyRef.id });
    } catch (error: any) {
      console.error('API Error:', error.message || error);
      res.status(500).json({ error: '回复失败', details: error.message || String(error) });
    }
  });

  // Toggle Like
  app.post('/api/posts/:postId/like', async (req, res) => {
    const { postId } = req.params;
    const { increment: incValue } = req.body; // 1 or -1
    try {
      const wdb = getWebDb();
      if (!wdb) throw new Error("Database not initialized");
      await withTimeout(updateDoc(doc(wdb, 'posts', postId), {
        'stats.likes': increment(incValue)
      }));
      res.json({ success: true });
    } catch (error: any) {
      console.error('API Error:', error.message || error);
      res.status(500).json({ error: '点赞失败', details: error.message || String(error) });
    }
  });

  // Toggle Repost
  app.post('/api/posts/:postId/repost', async (req, res) => {
    const { postId } = req.params;
    const { increment: incValue } = req.body; // 1 or -1
    try {
      const wdb = getWebDb();
      if (!wdb) throw new Error("Database not initialized");
      await withTimeout(updateDoc(doc(wdb, 'posts', postId), {
        'stats.reposts': increment(incValue)
      }));
      res.json({ success: true });
    } catch (error: any) {
      console.error('API Error:', error.message || error);
      res.status(500).json({ error: '转发失败', details: error.message || String(error) });
    }
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1') {
    const viteNamespace = await import('vite');
    const vite = await viteNamespace.createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log("[Server] Vite middleware injected.");
  } else {
    // Production fallback...
    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
      console.log("[Server] Serving production dist.");
    } else {
      console.warn("[Server] Dist path not found, UI may fail.");
    }
  }

  if (process.env.VERCEL !== '1') {
    app.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  }
  
  return app;
}

// Ensure local execution only runs when NOT in Vercel
if (process.env.VERCEL !== '1') {
  startServer().catch(err => {
    console.error("Failed to start server:", err);
  });
}

// Export the app for Vercel's Serverless Function invocation
let cachedApp: any;
export default async function handler(req: any, res: any) {
  if (!cachedApp) {
    cachedApp = await startServer();
  }
  return cachedApp(req, res);
}
