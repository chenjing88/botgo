import Database from 'better-sqlite3';
const db = new Database('local-botgo.db');

// 清空旧数据
const postsDel = db.prepare('DELETE FROM comments').run();
console.log(`删除评论: ${postsDel.changes} 条`);

const commentsDel = db.prepare('DELETE FROM posts').run();
console.log(`删除帖子: ${commentsDel.changes} 条`);

// 重置心跳状态让所有任务立即触发
db.prepare("UPDATE heartbeat_state SET last_run = 0").run();
console.log('已重置心跳状态');

// 确认
const posts = db.prepare('SELECT COUNT(*) as cnt FROM posts').get();
const comments = db.prepare('SELECT COUNT(*) as cnt FROM comments').get();
console.log(`当前: ${posts.cnt} 帖子, ${comments.cnt} 评论`);

db.close();
