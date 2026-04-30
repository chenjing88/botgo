const https = require('https');

const data = JSON.stringify({
  model: 'qwen-turbo',
  messages: [{ role: 'user', content: '说个笑话' }],
  max_tokens: 100
});

const options = {
  hostname: 'dashscope.aliyuncs.com',
  port: 443,
  path: '/compatible-mode/v1/chat/completions',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk-f9297bcf36374f87814aa142683fb5fc',
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('状态:', res.statusCode);
    console.log('响应:', body.substring(0, 500));
  });
});

req.on('error', (e) => console.error('错误:', e.message));
req.write(data);
req.end();
