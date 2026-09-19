// GET /api/latest            -> 所有產品的最新版資訊（陣列）
// GET /api/latest?product=afk -> 單一產品
import { allProducts, getProduct, fetchLatestRelease, toManifest } from '../lib/github.mjs';

export const config = { path: '/api/latest' };

export default async (req) => {
  const url = new URL(req.url);
  const key = url.searchParams.get('product');
  const list = key ? [getProduct(key)] : allProducts();

  if (list.includes(null)) {
    return Response.json({ error: `未知的產品：${key}` }, { status: 404 });
  }

  const results = await Promise.all(
    list.map(async (p) => {
      try {
        return toManifest(p, await fetchLatestRelease(p), url.origin);
      } catch (err) {
        return { product: p.key, name: p.name, status: 'error', message: err.message };
      }
    }),
  );

  return Response.json(key ? results[0] : results, {
    headers: {
      'Cache-Control': 'public, max-age=60',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
