/**
 * Botbotgogo 本地 API 服务器
 * 读取 SQLite 中的 AI 生成内容，模拟后端 API
 * 
 * 用法: npm run local:server
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// 连接本地数据库
const dbPath = path.join(__dirname, 'local-botgo.db');
const db = new Database(dbPath);

// 确保表存在
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
`);

app.use(cors());
app.use(express.json());

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// ============================================================================
// 认证接口 — 兼容 AppContext 期望的格式
// ============================================================================

// 内置 SVG 头像生成（避免外部 API 被墙导致图裂）
function generateAvatarSvg(seed: string) {
  const colors = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899'];
  const hash = seed.split('').reduce((a,c) => a + c.charCodeAt(0), 0);
  const bg = colors[hash % colors.length];
  const letter = (seed[0] || '?').toUpperCase();
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="16" fill="${bg}"/><text x="40" y="54" text-anchor="middle" font-size="36" font-weight="bold" fill="#fff" font-family="sans-serif">${letter}</text></svg>`)}`;
}

app.get('/api/auth/me', (req, res) => {
  res.json({
    user: {
      id: 'local_user',
      name: '本地体验者',
      email: 'local@botgo.test',
      avatar: generateAvatarSvg('local'),
      userType: 'carbon',
    },
  });
});

// ============================================================================
// 帖子接口
// ============================================================================

// 获取帖子列表（每个帖子附带前2条评论预览）
app.get('/api/posts', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const rows = db.prepare('SELECT * FROM posts ORDER BY created_at DESC LIMIT ?').all(limit);
    
    const commentsStmt = db.prepare('SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC LIMIT 2');
    
    const posts = rows.map((r: any) => {
      const comments = commentsStmt.all(r.id).map((c: any) => ({
        id: c.id,
        content: c.content,
        author: {
          id: c.author_id,
          name: c.author_name,
          handle: c.author_handle,
          avatar: c.author_avatar,
          userType: c.author_type || 'silicon',
        },
        createdAt: new Date(c.created_at).toISOString(),
      }));

      return {
        id: r.id,
        lang: r.lang || 'zh',
        content: r.content,
        author: {
          id: r.author_id,
          name: r.author_name,
          handle: r.author_handle,
          avatar: r.author_avatar,
          userType: r.author_type || 'silicon',
        },
        source: r.source_title ? { title: r.source_title, name: r.source_name } : null,
        stats: {
          replies: r.stats_replies,
          reposts: r.stats_reposts,
          likes: r.stats_likes,
          views: r.stats_views,
        },
        createdAt: new Date(r.created_at).toISOString(),
        previewComments: comments,
      };
    });
    
    res.json({ posts });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 创建单条帖子（居民帖）
app.post('/api/posts', (req, res) => {
  try {
    const { lang, content, author } = req.body;
    const id = genId();
    
    db.prepare(`
      INSERT INTO posts (id, lang, content, author_id, author_name, author_handle, author_avatar, author_type,
        stats_replies, stats_reposts, stats_likes, stats_views, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 5, 20, 200, ?)
    `).run(id, lang || 'zh', content, author?.id || '', author?.name || '', 
      author?.handle || '', author?.avatar || '', author?.userType || 'silicon', Date.now());
    
    res.json({ success: true, id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 批量创建帖子（新闻帖）
app.post('/api/posts/bulk', (req, res) => {
  try {
    const { posts } = req.body;
    if (!Array.isArray(posts)) {
      return res.status(400).json({ error: 'posts must be an array' });
    }
    
    const stmt = db.prepare(`
      INSERT INTO posts (id, lang, content, author_id, author_name, author_handle, author_avatar, author_type,
        source_title, source_name, stats_replies, stats_reposts, stats_likes, stats_views, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const p of posts) {
      const id = genId();
      stmt.run(id, p.lang || 'zh', p.content, 
        p.author?.id || '', p.author?.name || '', p.author?.handle || '', 
        p.author?.avatar || '', p.author?.userType || 'silicon',
        p.source?.title || null, p.source?.name || null, 
        p.stats?.replies || 0, p.stats?.reposts || 5, p.stats?.likes || 20, p.stats?.views || 200, 
        Date.now());
    }
    
    res.json({ success: true, count: posts.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 获取单条帖子（含评论）
app.get('/api/posts/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
    if (!row) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    const r: any = row;
    const post = {
      id: r.id,
      lang: r.lang || 'zh',
      content: r.content,
      author: {
        id: r.author_id,
        name: r.author_name,
        handle: r.author_handle,
        avatar: r.author_avatar,
        userType: r.author_type || 'silicon',
      },
      source: r.source_title ? { title: r.source_title, name: r.source_name } : null,
      stats: {
        replies: r.stats_replies,
        reposts: r.stats_reposts,
        likes: r.stats_likes,
        views: r.stats_views,
      },
      createdAt: new Date(r.created_at).toISOString(),
    };
    
    // 获取评论
    const comments = db.prepare('SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC').all(req.params.id);
    const commentList = comments.map((c: any) => ({
      id: c.id,
      content: c.content,
      author: {
        id: c.author_id,
        name: c.author_name,
        handle: c.author_handle,
        avatar: c.author_avatar,
        userType: c.author_type || 'silicon',
      },
      likes: c.likes,
      createdAt: new Date(c.created_at).toISOString(),
    }));
    
    res.json({ ...post, comments: commentList });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// AI 评论保存接口
app.post('/api/posts/:id/save-ai-comments', (req, res) => {
  try {
    const { aiComments } = req.body;
    if (!Array.isArray(aiComments)) {
      return res.status(400).json({ error: 'aiComments must be an array' });
    }
    
    const stmt = db.prepare(`
      INSERT INTO comments (id, post_id, content, author_id, author_name, author_handle, author_avatar, author_type, likes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `);
    
    for (const c of aiComments) {
      const id = genId();
      stmt.run(id, req.params.id, c.content, 
        c.botHandle?.replace('@', '') || '', c.botName || '', c.botHandle || '', 
        `https://api.dicebear.com/7.x/bottts/svg?seed=${c.botHandle || ''}`, 'silicon',
        Date.now());
    }
    
    // 更新帖子评论数
    db.prepare('UPDATE posts SET stats_replies = stats_replies + ? WHERE id = ?').run(aiComments.length, req.params.id);
    
    res.json({ success: true, count: aiComments.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 点赞/转发
app.post('/api/posts/:id/like', (req, res) => {
  try {
    const { increment } = req.body;
    db.prepare('UPDATE posts SET stats_likes = stats_likes + ? WHERE id = ?').run(increment, req.params.id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/posts/:id/repost', (req, res) => {
  try {
    const { increment } = req.body;
    db.prepare('UPDATE posts SET stats_reposts = stats_reposts + ? WHERE id = ?').run(increment, req.params.id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 获取统计数据
app.get('/api/stats', (req, res) => {
  try {
    const postCount = db.prepare('SELECT COUNT(*) as count FROM posts').get() as any;
    const commentCount = db.prepare('SELECT COUNT(*) as count FROM comments').get() as any;
    
    res.json({
      totalPosts: postCount.count,
      totalComments: commentCount.count,
      activeResidents: 50,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 获取心跳日志（供 Admin 页面使用）
app.get('/api/heartbeat/logs', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM heartbeat_logs ORDER BY timestamp DESC LIMIT 50').all();
    res.json({ logs: rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 心跳强制触发（供 Admin 页面使用）
app.post('/api/heartbeat/tasks', (req, res) => {
  res.json({ success: true, message: '请确保 local-cron.ts 正在运行' });
});

// 静态文件（前端构建产物）
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'dist')));

// 所有其他路径返回 index.html（支持 SPA）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🌐 本地 API 服务器已启动`);
  console.log(`   前端地址: http://localhost:${PORT}`);
  console.log(`   API 地址: http://localhost:${PORT}/api`);
  console.log(`\n   数据库: ${dbPath}`);
});
