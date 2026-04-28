/**
 * 新闻源配置 — 通过 NEWS_REGION 环境变量切换
 *   cn   → 国内源（新浪、少数派、聚合数据、ALAPI 网易）
 *   intl → 国际源（BBC、Reuters、Hacker News、Dev.to）
 */

import https from 'https';
import { parseString } from 'xml2js';
import { promisify } from 'util';
const parseXML = promisify(parseString);

export interface NewsItem {
  title: string;
  description: string;
  sourceName: string;
}

type NewsFetcher = () => Promise<NewsItem | null>;

// ── 国内源 ──────────────────────────────────────────

function fetchSinaNews(): Promise<NewsItem | null> {
  const url = 'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2514&k=&num=10&page=1&r=0.5';
  const u = new URL(url);

  return new Promise((resolve) => {
    https.get({ hostname: u.hostname, path: u.pathname + u.search, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const items = json?.result?.data || [];
          if (items.length > 0) {
            const item = items[Math.floor(Math.random() * Math.min(5, items.length))];
            resolve({ title: item.title || '', description: item.intro || item.title || '', sourceName: '新浪财经' });
          } else resolve(null);
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

function fetchSSPaiNews(): Promise<NewsItem | null> {
  return new Promise((resolve) => {
    https.get({ hostname: 'sspai.com', path: '/feed', headers: { 'User-Agent': 'Mozilla/5.0' } }, async (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', async () => {
        try {
          const xml = await parseXML(data);
          const items = xml?.rss?.channel?.[0]?.item || [];
          if (items.length > 0) {
            const item = items[0];
            const title = Array.isArray(item.title) ? item.title[0] : item.title;
            const desc = Array.isArray(item.description) ? item.description[0] : item.description || '';
            resolve({ title: title || '', description: String(desc).replace(/<[^>]*>/g, '').substring(0, 200), sourceName: '少数派' });
          } else resolve(null);
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

function fetchJuheNews(): Promise<NewsItem | null> {
  const key = process.env.JUHE_NEWS_KEY;
  if (!key) return Promise.resolve(null);

  const types = ['top', 'keji', 'guoji'];
  const type = types[Math.floor(Math.random() * types.length)];

  return fetch(`http://v.juhe.cn/toutiao/index?type=${type}&key=${key}`, { signal: AbortSignal.timeout(8000) })
    .then(r => r.json())
    .then(data => {
      if (data.reason === 'success!' && data.result?.data?.length > 0) {
        const item = data.result.data[Math.floor(Math.random() * Math.min(5, data.result.data.length))];
        return { title: item.title || '', description: item.title || '', sourceName: `聚合数据-${item.category || type}` };
      }
      return null;
    })
    .catch(() => null);
}

function fetchALAPINews(): Promise<NewsItem | null> {
  const token = process.env.ALAPI_TOKEN;
  if (!token) return Promise.resolve(null);

  return fetch('https://v3.alapi.cn/api/new/toutiao', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, type: '1', page: '1' }),
    signal: AbortSignal.timeout(8000),
  })
    .then(r => r.json())
    .then(data => {
      if (data.success && data.data?.length > 0) {
        const item = data.data[Math.floor(Math.random() * Math.min(5, data.data.length))];
        return { title: item.title || '', description: item.digest || item.title || '', sourceName: '网易新闻' };
      }
      return null;
    })
    .catch(() => null);
}

// ── 国际源 ──────────────────────────────────────────

async function fetchBBCNews(): Promise<NewsItem | null> {
  try {
    const res = await fetch('https://feeds.bbci.co.uk/news/world/rss.xml', {
      headers: { 'User-Agent': 'Botbotgogo/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    const text = await res.text();
    const xml = await parseXML(text);
    const items = xml?.rss?.channel?.[0]?.item || [];
    if (items.length > 0) {
      const item = items[Math.floor(Math.random() * Math.min(5, items.length))];
      const title = Array.isArray(item.title) ? item.title[0] : item.title;
      const desc = Array.isArray(item.description) ? item.description[0] : item.description || '';
      return { title: title || '', description: String(desc).replace(/<[^>]*>/g, '').substring(0, 300), sourceName: 'BBC World' };
    }
    return null;
  } catch { return null; }
}

async function fetchReutersNews(): Promise<NewsItem | null> {
  try {
    const res = await fetch('https://www.reuters.com/arc/outboundfeeds/v3/all/?outputType=xml&size=10', {
      headers: { 'User-Agent': 'Botbotgogo/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    const text = await res.text();
    const xml = await parseXML(text);
    const items = xml?.rss?.channel?.[0]?.item || [];
    if (items.length > 0) {
      const item = items[Math.floor(Math.random() * Math.min(5, items.length))];
      const title = Array.isArray(item.title) ? item.title[0] : item.title;
      const desc = Array.isArray(item.description) ? item.description[0] : item.description || '';
      return { title: title || '', description: String(desc).replace(/<[^>]*>/g, '').substring(0, 300), sourceName: 'Reuters' };
    }
    return null;
  } catch { return null; }
}

async function fetchHackerNews(): Promise<NewsItem | null> {
  try {
    const res = await fetch('https://hnrss.org/frontpage?count=10', {
      headers: { 'User-Agent': 'Botbotgogo/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    const text = await res.text();
    const xml = await parseXML(text);
    const items = xml?.rss?.channel?.[0]?.item || [];
    if (items.length > 0) {
      const item = items[Math.floor(Math.random() * Math.min(5, items.length))];
      const title = Array.isArray(item.title) ? item.title[0] : item.title;
      const desc = Array.isArray(item.description) ? item.description[0] : item.description || '';
      return { title: title || '', description: String(desc).replace(/<[^>]*>/g, '').substring(0, 300), sourceName: 'Hacker News' };
    }
    return null;
  } catch { return null; }
}

async function fetchDevTo(): Promise<NewsItem | null> {
  try {
    const res = await fetch('https://dev.to/feed', {
      headers: { 'User-Agent': 'Botbotgogo/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    const text = await res.text();
    const xml = await parseXML(text);
    const items = xml?.rss?.channel?.[0]?.item || [];
    if (items.length > 0) {
      const item = items[Math.floor(Math.random() * Math.min(5, items.length))];
      const title = Array.isArray(item.title) ? item.title[0] : item.title;
      const desc = Array.isArray(item.description) ? item.description[0] : item.description || '';
      return { title: title || '', description: String(desc).replace(/<[^>]*>/g, '').substring(0, 300), sourceName: 'DEV Community' };
    }
    return null;
  } catch { return null; }
}

// ── 按 region 注册源 ────────────────────────────────

const REGION_SOURCES: Record<string, NewsFetcher[]> = {
  cn: [
    fetchSinaNews,
    fetchSSPaiNews,
    fetchJuheNews,
    fetchALAPINews,
  ],
  intl: [
    fetchBBCNews,
    fetchReutersNews,
    fetchHackerNews,
    fetchDevTo,
  ],
};

/** 获取当前 region 对应的新闻源列表 */
export function getNewsSources(region?: string): NewsFetcher[] {
  const r = region || process.env.NEWS_REGION || 'cn';
  return REGION_SOURCES[r] || REGION_SOURCES.cn;
}

/** 随机尝试所有匹配源，返回第一条有效新闻 */
export async function getLatestNews(region?: string): Promise<NewsItem | null> {
  const sources = getNewsSources(region);
  const shuffled = sources.sort(() => 0.5 - Math.random());
  for (const fetchFn of shuffled) {
    const news = await fetchFn();
    if (news && news.title.length > 5) return news;
  }
  return null;
}
