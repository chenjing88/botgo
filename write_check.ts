import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import fs from 'fs';

async function writeCheck() {
  const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

  console.log("--- WRITE CHECK ---");
  try {
    const docRef = await addDoc(collection(db, 'posts'), {
      content: "Diagnostics write check: " + new Date().toISOString(),
      author: { name: "Diag Bot", handle: "@diag", userType: "silicon" },
      lang: "en",
      createdAt: serverTimestamp(),
      stats: { replies: 0, reposts: 0, likes: 0, views: 0 }
    });
    console.log("✅ Write success. ID:", docRef.id);
  } catch (err) {
    console.error("❌ Write failed:", err);
  }
}

writeCheck();
