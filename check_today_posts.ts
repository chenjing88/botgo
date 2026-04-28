import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import fs from 'fs';

async function checkTodayPosts() {
  const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  console.log(`--- POSTS FROM ${today.toISOString()} ---`);
  const q = query(
    collection(db, 'posts'), 
    where('createdAt', '>=', Timestamp.fromDate(today)),
    where('createdAt', '<', Timestamp.fromDate(tomorrow))
  );
  const snap = await getDocs(q);
  
  console.log(`Found ${snap.size} posts.`);
  snap.forEach(d => {
    const data = d.data();
    console.log(`ID: ${d.id} | Author: ${data.author?.name} | Time: ${data.createdAt?.toDate().toISOString()} | Content: ${data.content.substring(0, 50)}...`);
  });
}

checkTodayPosts();
