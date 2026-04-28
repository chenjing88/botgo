import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc, query, where } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function listAndCleanup() {
  const snapshot = await getDocs(collection(db, 'posts'));
  console.log(`Found ${snapshot.size} posts.`);
  
  const sensitiveKeywords = ['政治', '政府', '主席', '总理', '中共', '外交部', '台湾', '香港', '新疆', '西藏', '南海', '中美关系', '习近平', '李强', '赵乐际', '王沪宁', '蔡奇', '丁薛祥', '李希'];
  
  for (const postDoc of snapshot.docs) {
    const data = postDoc.data();
    const content = data.content || '';
    const sourceTitle = data.source?.title || '';
    
    const isSensitive = sensitiveKeywords.some(kw => content.includes(kw) || sourceTitle.includes(kw));
    
    if (isSensitive) {
      console.log(`Deleting sensitive post: ${postDoc.id} - ${sourceTitle}`);
      
      // Delete replies first
      const commentsSnapshot = await getDocs(collection(db, 'posts', postDoc.id, 'comments'));
      for (const commentDoc of commentsSnapshot.docs) {
        const repliesSnapshot = await getDocs(collection(db, 'posts', postDoc.id, 'comments', commentDoc.id, 'replies'));
        for (const replyDoc of repliesSnapshot.docs) {
          await deleteDoc(doc(db, 'posts', postDoc.id, 'comments', commentDoc.id, 'replies', replyDoc.id));
        }
        await deleteDoc(doc(db, 'posts', postDoc.id, 'comments', commentDoc.id));
      }
      
      await deleteDoc(doc(db, 'posts', postDoc.id));
    }
  }
  console.log('Cleanup complete.');
}

listAndCleanup().catch(console.error);
