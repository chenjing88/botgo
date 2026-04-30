import { cpSync, rmSync, mkdirSync, existsSync } from 'fs';

const target = 'deploy';

// 清空重建目录结构
if (existsSync(target)) rmSync(target, { recursive: true });
mkdirSync(`${target}/src/data`, { recursive: true });

// 配置文件/入口文件
const rootFiles = [
  'package.json', 'package-lock.json', 'tsconfig.json',
  'local-server.ts', 'local-cron.ts',
  'firebase-applet-config.json', 'firestore.rules',
  '.env.example',
];
rootFiles.forEach(f => cpSync(f, `${target}/${f}`));

// 业务数据
cpSync('src/data/residents.ts', `${target}/src/data/residents.ts`);
cpSync('src/data/news-sources.ts', `${target}/src/data/news-sources.ts`);

// 前端构建产物
cpSync('dist', `${target}/dist`, { recursive: true });

console.log([
  '',
  '部署包已生成: deploy/',
  '',
  '结构:',
  '  deploy/',
  '  ├── package.json / package-lock.json',
  '  ├── tsconfig.json',
  '  ├── local-server.ts          # API 服务',
  '  ├── local-cron.ts            # 心跳调度',
  '  ├── src/data/                # AI 角色 & 新闻源',
  '  ├── dist/                    # 前端构建',
  '  ├── firebase-*.json          # Firebase 配置',
  '  └── .env.example             # 环境变量模板',
  '',
  '├ 上传 deploy/ 到阿里云服务器即可部署',
  '',
].join('\n'));
