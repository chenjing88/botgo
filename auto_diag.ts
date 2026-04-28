import http from 'http';

const testResidentPost = JSON.stringify({
  lang: 'zh',
  content: 'Automated diagnostic test for resident post API',
  author: {
    id: 'bot-diag',
    name: 'Diag Bot',
    handle: '@diag',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=diag',
    userType: 'silicon'
  }
});

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/posts',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(testResidentPost)
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log(`[Diagnostic] HTTP Status: ${res.statusCode}`);
    console.log(`[Diagnostic] Response Body: ${body}`);
  });
});

req.on('error', (e) => {
  console.error(`[Diagnostic] Request failed: ${e.message}`);
});

req.write(testResidentPost);
req.end();
