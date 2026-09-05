// Local-only UI test fixture. No cloud client, credentials or real lesson content.
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
http.createServer((req, res) => {
  let name = new URL(req.url, 'http://localhost').pathname;
  if (name === '/mobile') {
    res.setHeader('Content-Type', 'text/html');
    return res.end('<title>Mobile preview</title><iframe title="iPhone preview" src="/preview" style="width:390px;height:844px;border:0"></iframe>');
  }
  if (name === '/preview') {
    let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    html = html.replace('class="auth-locked"', 'class="auth-ready"').replace(/\s+inert(?=[\s>])/g, '').replace('id="appShell"', 'id="appShell"');
    html = html.replace(/<script[^>]+(?:supabase|cloud-config|cloud-sync)[^>]*><\/script>/g, '');
    html = html.replace('</head>', '<style>#authGate{display:none!important}#appShell{visibility:visible!important;opacity:1!important;pointer-events:auto!important}</style></head>');
    res.setHeader('Content-Type', 'text/html'); return res.end(html);
  }
  const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  try { res.setHeader('Content-Type', types[path.extname(file)] || 'text/plain'); res.end(fs.readFileSync(file)); }
  catch { res.writeHead(404); res.end('Not found'); }
}).listen(8080, '0.0.0.0', () => console.log('Synthetic local preview at http://127.0.0.1:8080/mobile'));
