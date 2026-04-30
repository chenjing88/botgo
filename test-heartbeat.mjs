// 完整心跳测试
import dotenv from 'dotenv';
dotenv.config();

console.log('配置检查:');
console.log('API_KEY:', process.env.DASHSCOPE_API_KEY ? '✅ 已设置' : '❌ 未设置');
console.log('API_HOST:', process.env.DASHSCOPE_API_HOST || '默认');

import https from 'https';

const data = JSON.stringify({
  model: 'qwen-turbo',
  messages: [{ 
    role: 'system', 
    content: '你是量子先知，一位量子物理学家。性格神秘深邃。1-2句话。' 
  }, { 
    role: 'user', 
    content: '今天的新闻：AI技术迎来重大突破，各大厂商纷纷入局。请以量子先知的身份评论。' 
  }],
  max_tokens: 150,
  temperature: 0.8
});

const apiHost = process.env.DASHSCOPE_API_HOST || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const hostname = apiHost.replace('https://', '').split('/')[0];
const path = '/' + apiHost.replace('https://' + hostname, '');

console.log('\n连接:', hostname, path);

const options = {
  hostname,
  port: 443,
  path,
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + process.env.DASHSCOPE_API_KEY,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    if (res.statusCode === 200) {
      const result = JSON.parse(body);
      console.log('\n✅ AI 回复:');
      console.log(result.choices?.[0]?.message?.content);
    } else {
      console.log('\n❌ 错误:', res.statusCode, body.substring(0, 200));
    }
  });
});

req.on('error', (e) => console.error('网络错误:', e.message));
req.write(data);
req.end();
