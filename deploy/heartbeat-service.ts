import {
  getFirestore,
  doc,
  updateDoc,
  collection,
  addDoc,
  serverTimestamp,
  Timestamp,
  runTransaction,
  Firestore
} from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import fs from 'fs';
import path from 'path';

let _db: Firestore | null = null;

function getDb(): Firestore {
  if (_db) return _db;
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  _db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  return _db;
}

async function addLog(type: string, status: string, details?: any) {
  try {
    const db = getDb();
    const logsRef = collection(db, 'system', 'heartbeat_logs', 'entries');
    await addDoc(logsRef, {
      type,
      status,
      timestamp: serverTimestamp(),
      details: details || {}
    });
  } catch (e) {
    console.error("[Heartbeat] Log failed:", e);
  }
}

export async function runHeartbeatLogic(force: boolean = false) {
  try {
    const db = getDb();
    const systemRef = doc(db, 'system', 'heartbeat');

    const task = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(systemRef);
      let data = snap.data();

      if (!snap.exists()) {
        data = {
          lastNews: Timestamp.fromMillis(0),
          lastResident: Timestamp.fromMillis(0),
          lastComment: Timestamp.fromMillis(0)
        };
        transaction.set(systemRef, { ...data, lastPulse: serverTimestamp() });
      }

      const now = Date.now();
      const run = { news: false, resident: false, comment: false };
      const updates: any = { lastPulse: serverTimestamp() };

      if (data) {
        const lastNews = data.lastNews?.toMillis() || 0;
        if (force || now - lastNews > 15 * 60 * 1000) {
          run.news = true;
          updates.lastNews = serverTimestamp();
        }

        const lastRes = data.lastResident?.toMillis() || 0;
        if (force || now - lastRes > 5 * 60 * 1000) {
          run.resident = true;
          updates.lastResident = serverTimestamp();
        }

        const lastCom = data.lastComment?.toMillis() || 0;
        if (force || now - lastCom > 3 * 60 * 1000) {
          run.comment = true;
          updates.lastComment = serverTimestamp();
        }
      }

      if (snap.exists()) {
        transaction.update(systemRef, updates);
      } else {
        transaction.set(systemRef, { ...data, ...updates });
      }
      return run;
    });

    return task;
  } catch (e) {
    console.error("[Heartbeat] Server logic error:", e);
    return { news: false, resident: false, comment: false };
  }
}

export async function updateHeartbeatTimer(type: 'news' | 'resident' | 'comment', status: string = 'completed', details?: any) {
  try {
    const db = getDb();
    const systemRef = doc(db, 'system', 'heartbeat');

    const field = type === 'news' ? 'lastNews' : type === 'resident' ? 'lastResident' : 'lastComment';

    if (status === 'completed' || status === 'success') {
      await updateDoc(systemRef, {
        [field]: serverTimestamp()
      });
    }

    addLog(type, status, details);
  } catch (e) {
    console.err