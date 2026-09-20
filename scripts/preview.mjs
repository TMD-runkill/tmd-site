// 本機預覽用：提供 public/ 靜態檔，並用假資料模擬 /api/latest，不需要 GitHub token。
// 用法：npm run preview  → http://localhost:8788
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const PORT = Number(process.env.PORT || 8788);
const ROOT = new URL('../public/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' };

const MOCK = [
  {
    product: 'afk', name: 'TMD 全自動掛機', status: 'released', version: '1.2.0',
    published_at: '2026-09-18T10:00:00Z',
    notes: '- 修正登入逾時問題\n- 優化長時間掛機穩定度\n- 新增自動重連',
    files: [
      { kind: 'zip', name: 'TMD_Runner.zip', url: '/download/afk/zip', size: 62914560, sha256: 'abc' },
    ],
    backup_url: 'https://drive.google.com/drive/folders/example',
  },
  { product: 'run', name: 'TMD 跑殺', status: 'building', backup_url: null },
];

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/latest') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(MOCK));
  }
  if (url.pathname.startsWith('/download/')) {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('（預覽模式）正式站會在這裡 302 轉到 GitHub 的檔案：' + url.pathname);
  }
  const file = normalize(join(ROOT, url.pathname === '/' ? 'index.html' : url.pathname));
  if (!file.startsWith(normalize(ROOT))) { res.writeHead(403); return res.end(); }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('not found');
  }
}).listen(PORT, () => console.log(`預覽：http://localhost:${PORT}`));
