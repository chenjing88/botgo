import fs from 'fs';

const serverFile = 'server.ts';
let code = fs.readFileSync(serverFile, 'utf8');

// 1. Add writeBatch, updateDoc, increment to the main firebase/firestore import
code = code.replace(
  /import {([^}]+)addDoc, limit, orderBy } from 'firebase\/firestore';/,
  "import {$1addDoc, limit, orderBy, writeBatch, updateDoc, increment } from 'firebase/firestore';"
);

// 2. Remove dynamic imports across the whole file
code = code.replace(/^[ \t]*const {[^}]+} = await import\('firebase\/firestore'\);[ \t]*\n/gm, '');

// 3. Edit catch blocks to surface true errors
code = code.replace(
  /catch \(error\) {\s+console.error\([^,]+, error\);\s+res.status\(500\)\.json\({ error: '([^']+)' }\);\s+}/g,
  "catch (error: any) {\n      console.error('API Error:', error.message || error);\n      res.status(500).json({ error: '$1', details: error.message || String(error) });\n    }"
);

fs.writeFileSync(serverFile, code);
console.log('server.ts successfully patched.');
