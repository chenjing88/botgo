import Database from 'better-sqlite3';
const db = new Database('local-botgo.db');

console.log('\n=== 最近10条帖子 ===');
const posts = db.prepare('SELECT id, lang, substr(content, 1, 60) as preview, source_title, created_at FROM posts ORDER BY created_at DESC LIMIT 10').all();
posts.forEach(p => {
  const d = new Date(p.created_at);
  console.log(`[${d.toLocaleString('zh-CN')}] lang=${p.lang} | ${p.source_title ? '📰 '+p.source_title : '❌无来源'} | ${p.preview}`);
});

console.log('\n=== 最近5条评论 ===');
const comments = db.prepare('SELECT id, substr(content, 1, 60) as preview, author_name, created_at FROM comments ORDER BY created_at DESC LIMIT 5').all();
comments.forEach(c => {
  const d = new Date(c.created_at);
  console.log(`[${d.toLocaleString('zh-CN')}] by ${c.author_name} | ${c.preview}`);
});

console.log('\n=== 心跳状态 ===');
const state = db.prepare('SELECT * FROM heartbeat_state').all();
console.log(state);

db.close();
