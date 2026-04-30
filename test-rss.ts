import https from 'https';
import { parseString } from 'xml2js';
import { promisify } from 'util';

const parseXML = promisify(parseString);

// 测试新浪财经 API
async function testSinaNews() {
  console.log('\n=== 新浪财经 API ===');
  const url = 'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2514&k=&num=10&page=1&r=0.5';
  const u = new URL(url);
  
  const data = await new Promise<string>((resolve, reject) => {
    https.get({ hostname: u.hostname, path: u.pathname + u.search, headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d));
    }).on('error', reject);
  });
  
  const json = JSON.parse(data);
  const items = json?.result?.data || [];
  console.log(`Got ${items.length} items`);
  items.slice(0, 3).forEach((item: any, i: number) => {
    console.log(`${i + 1}. ${item.title}`);
    console.log(`   ${item.intro?.substring(0, 80) || ''}`);
  });
}

// 测试少数派 RSS
async function testSSPai() {
  console.log('\n=== 少数派 RSS ===');
  const url = 'https://sspai.com/feed';
  
  const data = await new Promise<string>((resolve, reject) => {
    https.get({ hostname: 'sspai.com', path: '/feed', headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d));
    }).on('error', reject);
  });
  
  const xml = await parseXML(data);
  const items = xml?.rss?.channel?.[0]?.item || [];
  console.log(`Got ${items.length} items`);
  items.slice(0, 3).forEach((item: any, i: number) => {
    const title = Array.isArray(item.title) ? item.title[0] : item.title;
    console.log(`${i + 1}. ${title}`);
  });
}

await testSinaNews();
await testSSPai();
