import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import fs from 'fs';

async function diagnose() {
  const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

  console.log("--- SYSTEM DIAGNOSIS ---");
  
  // 1. Check Heartbeat State
  const snap = await getDoc(doc(db, 'system', 'heartbeat'));
  console.log("Heartbeat State:", JSON.stringify(snap.data(), null, 2));

  // 2. Check Latest Logs
  const q = query(collection(db, 'system', 'heartbeat_logs', 'entries'), orderBy('timestamp', 'desc'), limit(5));
  const logSnap = await getDocs(q);
  console.log("\nLatest Logs:");
  logSnap.forEach(d => console.log(`- [${d.data().timestamp?.toDate().toISOString()}] ${d.data().type}: ${d.data().status}`));

  // 3. Check Post Count
  const postSnap = await getDocs(query(collection(db, 'posts'), limit(1)));
  console.log("\nPosts exist:", !postSnap.empty);
}

diagnose();
