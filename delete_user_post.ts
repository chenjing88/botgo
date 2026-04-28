import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function deleteSpecificPost() {
  const snapshot = await getDocs(collection(db, 'posts'));
  const targetContent = "我讨论中国的政治观点可以吗";
  
  let found = false;
  for (const postDoc of snapshot.docs) {
    const data = postDoc.data();
    const content = data.content || '';
    
    if (content.includes(targetContent)) {
      console.log(`Found target post: ${postDoc.id}. Deleting...`);
      
      // Delete comments and replies
      const commentsSnapshot = await getDocs(collection(db, 'posts', postDoc.id, 'comments'));
      for (const commentDoc of commentsSnapshot.docs) {
        const repliesSnapshot = await getDocs(collection(db, 'posts', postDoc.id, 'comments', commentDoc.id, 'replies'));
        for (const replyDoc of repliesSnapshot.docs) {
          await deleteDoc(doc(db, 'posts', postDoc.id, 'comments', commentDoc.id, 'replies', replyDoc.id));
        }
        await deleteDoc(doc(db, 'posts', postDoc.id, 'comments', commentDoc.id));
      }
      
      await deleteDoc(doc(db, 'posts', postDoc.id));
      found = true;
    }
  }
  
  if (!found) {
    console.log("No matching posts found.");
  } else {
    console.log("Deletion complete.");
  }
}

deleteSpecificPost().catch(console.error);
