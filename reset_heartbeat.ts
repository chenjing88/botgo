import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, Timestamp } from 'firebase/firestore';
import fs from 'fs';

async function resetHeartbeat() {
  const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

  const past = Timestamp.fromMillis(0);
  console.log("--- RESETTING HEARTBEAT TIMERS ---");
  await updateDoc(doc(db, 'system', 'heartbeat'), {
    lastNews: past,
    lastResident: past,
    lastComment: past,
    lastPulse: past
  });
  console.log("✅ Done.");
}

resetHeartbeat();
