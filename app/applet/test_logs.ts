import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const run = async () => {
    try {
        const logsRef = collection(db, 'system', 'heartbeat_logs', 'entries');
        const q = query(logsRef, orderBy('timestamp', 'desc'), limit(10));
        const snap = await getDocs(q);
        snap.forEach(doc => {
            const data = doc.data();
            console.log(data.type, data.status, new Date(data.timestamp?.toMillis() || 0).toLocaleString(), data.details);
        });
    } catch(e) {
        console.error(e);
    }
}
run();
