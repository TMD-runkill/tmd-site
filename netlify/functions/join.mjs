// POST /api/join — TMD 進房回報,轉貼到 Discord 私人頻道「進房紀錄」。
// Webhook 網址放在 Netlify 環境變數 JOIN_WEBHOOK_URL,不寫在程式裡。
const CODE = /^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/;
const clean = (v, max = 40) => String(v ?? '').replace(/[`@<>\r\n|*_~]/g, '').slice(0, max);

export default async (req, context) => {
  if (req.method !== 'POST') return new Response('method', { status: 405 });
  const hook = process.env.JOIN_WEBHOOK_URL;
  if (!hook) return new Response('off', { status: 503 });

  let b;
  try { b = await req.json(); } catch { return new Response('bad', { status: 400 }); }
  const mc = String(b?.mc ?? '').toUpperCase();
  if (!CODE.test(mc)) return new Response('bad', { status: 400 });

  const keys = Array.isArray(b.keys) ? b.keys.slice(0, 5).map(k => clean(k, 60)) : [];
  const ip = req.headers.get('x-nf-client-connection-ip') || context?.ip || '';
  const time = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });

  const content = [
    `🚪 **${clean(b.mode)}**|${clean(b.prog)} ${clean(b.ver, 12)}|${time}`,
    `機器碼:\`${mc}\`|電腦:${clean(b.pc)}|IP:${clean(ip)}`,
    keys.length ? `Key:${keys.join('、')}` : 'Key:(沒有團體 Key)',
  ].join('\n');

  try {
    await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    });
  } catch { /* Discord 掛了也回 ok,不影響 TMD */ }
  return new Response('ok');
};

export const config = { path: '/api/join' };
