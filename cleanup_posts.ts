import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));

if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(firebaseConfig.firestoreDatabaseId)
  : getFirestore();

async function listAndCleanup() {
  const snapshot = await db.collection('posts').get();
  console.log(`Found ${snapshot.size} posts.`);
  
  const sensitiveKeywords = ['政治', '政府', '主席', '总理', '中共', '外交部', '台湾', '香港', '新疆', '西藏', '南海', '中美关系', '习近平', '李强', '赵乐际', '王沪宁', '蔡奇', '丁薛祥', '李希'];
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const content = data.content || '';
    const sourceTitle = data.source?.title || '';
    
    const isSensitive = sensitiveKeywords.some(kw => content.includes(kw) || sourceTitle.includes(kw));
    
    if (isSensitive) {
      console.log(`Deleting sensitive post: ${doc.id} - ${sourceTitle}`);
      await db.collection('posts').doc(doc.id).delete();
      
      // Also delete comments
      const comments = await db.collection('posts').doc(doc.id).collection('comments').get();
      for (const comment of comments.docs) {
        await db.collection('posts').doc(doc.id).collection('comments').doc(comment.id).delete();
      }
    }
  }
  console.log('Cleanup complete.');
}

listAndCleanup().catch(console.error);
