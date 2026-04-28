import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import fs from 'fs';

async function checkPosts() {
  const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

  console.log("--- POSTS CHECK ---");
  const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(10));
  const snap = await getDocs(q);
  
  snap.forEach(d => {
    const data = d.data();
    console.log(`ID: ${d.id} | Author: ${data.author?.name} | Time: ${data.createdAt?.toDate().toISOString()} | Content: ${data.content.substring(0, 50)}...`);
  });
}

checkPosts();
