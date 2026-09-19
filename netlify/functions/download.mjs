// GET /download/:product/:kind  例如 /download/afk/exe
// 向 GitHub 要私人 Release 檔案，GitHub 回一個短時間有效的網址，這裡把使用者 302 轉過去。
// 檔案本身不經過 Netlify，沒有大小或時間限制。
import { getProduct, fetchLatestRelease, githubHeaders } from '../lib/github.mjs';

export const config = { path: '/download/:product/:kind' };

const NO_STORE = { 'Cache-Control': 'no-store' };

export default async (req, context) => {
  const { product: key, kind } = context.params;
  const product = getProduct(key);
  if (!product) return Response.json({ error: `未知的產品：${key}` }, { status: 404, headers: NO_STORE });

  const name = product.files[kind];
  if (!name) return Response.json({ error: `未知的檔案類型：${kind}` }, { status: 404, headers: NO_STORE });

  let release;
  try {
    release = await fetchLatestRelease(product);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 502, headers: NO_STORE });
  }
  if (!release) return Response.json({ error: '此產品尚未發布' }, { status: 404, headers: NO_STORE });

  const asset = release.assets.find((a) => a.name === name);
  if (!asset) return Response.json({ error: `最新版沒有附上 ${name}` }, { status: 404, headers: NO_STORE });

  const res = await fetch(asset.url, {
    headers: githubHeaders('application/octet-stream'),
    redirect: 'manual',
  });

  const location = res.headers.get('location');
  if ((res.status === 302 || res.status === 307) && location) {
    return new Response(null, { status: 302, headers: { Location: location, ...NO_STORE } });
  }
  if (res.ok && res.body) {
    // 少數情況 GitHub 直接回檔案內容，就原樣串流出去。
    return new Response(res.body, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${name}"`,
        ...NO_STORE,
      },
    });
  }
  return Response.json({ error: `GitHub 回應 ${res.status}` }, { status: 502, headers: NO_STORE });
};
