import { AI_RESIDENTS } from './src/data/residents.js';
const langs = {};
AI_RESIDENTS.forEach(b => {
  const l = b.lang || 'undefined';
  langs[l] = (langs[l] || 0) + 1;
});
console.log('lang 分布:', langs);
console.log('Total:', AI_RESIDENTS.length);
