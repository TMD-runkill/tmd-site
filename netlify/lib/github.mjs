// 與 GitHub Releases 溝通的共用程式碼。兩個函式（latest、download）都用這裡。
import products from '../../products.json' with { type: 'json' };

const API = 'https://api.github.com';
const CACHE_TTL_MS = 60_000;
const cache = new Map(); // product.key -> { expires, release }

function token() {
  const t = process.env.GITHUB_TOKEN;
  if (!t) throw new Error('GITHUB_TOKEN 未設定');
  return t;
}

export function githubHeaders(accept = 'application/vnd.github+json') {
  return {
    Authorization: `Bearer ${token()}`,
    Accept: accept,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'tmd-site',
  };
}

export function allProducts() {
  return products;
}

export function getProduct(key) {
  return products.find((p) => p.key === key) ?? null;
}

// 回傳最新正式版 Release；沒有任何 Release 時回傳 null。
// 注意：repo 名稱錯誤或 token 沒有該 repo 權限時，GitHub 一樣回 404，也會被當成「尚無 Release」。
export async function fetchLatestRelease(product) {
  const hit = cache.get(product.key);
  if (hit && hit.expires > Date.now()) return hit.release;

  const res = await fetch(`${API}/repos/${product.repo}/releases/latest`, {
    headers: githubHeaders(),
  });

  let release;
  if (res.status === 404) release = null;
  else if (!res.ok) throw new Error(`GitHub 回應 ${res.status}（${product.repo}）`);
  else release = await res.json();

  cache.set(product.key, { expires: Date.now() + CACHE_TTL_MS, release });
  return release;
}

// 把 GitHub Release 轉成網頁和更新器共用的 JSON 格式（見 docs/API.md）。
export function toManifest(product, release, origin) {
  const base = {
    product: product.key,
    name: product.name,
    backup_url: product.backup_url ?? null,
  };
  if (!release) return { ...base, status: 'building' };

  const files = [];
  for (const [kind, name] of Object.entries(product.files)) {
    const asset = release.assets.find((a) => a.name === name);
    if (!asset) continue;
    files.push({
      kind,
      name,
      url: `${origin}/download/${product.key}/${kind}`,
      size: asset.size,
      sha256: asset.digest ? asset.digest.replace(/^sha256:/, '') : null,
    });
  }

  return {
    ...base,
    status: 'released',
    version: release.tag_name.replace(/^v/i, ''),
    published_at: release.published_at,
    notes: release.body ?? '',
    files,
  };
}
