// 用假的 GitHub 回應測試兩個函式，不需要 token 和網路。
// 用法：npm test
import assert from 'node:assert/strict';

process.env.GITHUB_TOKEN = 'test-token';

const RELEASE = {
  tag_name: 'v1.2.0',
  published_at: '2026-09-18T10:00:00Z',
  body: '- 修正登入逾時\n- 優化穩定度',
  assets: [
    { id: 1, name: 'TMD_Runner.zip', size: 62914560, digest: 'sha256:aaa', url: 'https://api.github.com/repos/o/tmd-afk-releases/releases/assets/1' },
  ],
};

const calls = [];
globalThis.fetch = async (url, init = {}) => {
  calls.push({ url, init });
  assert.equal(init.headers.Authorization, 'Bearer test-token', 'GitHub 呼叫必須帶 token');
  if (url.endsWith('/tmd-afk-releases/releases/latest')) return Response.json(RELEASE);
  if (url.endsWith('/tmd-run-releases/releases/latest')) return new Response('', { status: 404 });
  if (url.endsWith('/releases/assets/1')) {
    assert.equal(init.redirect, 'manual');
    assert.equal(init.headers.Accept, 'application/octet-stream');
    return new Response(null, { status: 302, headers: { location: 'https://objects.githubusercontent.com/signed?X-Amz-Signature=abc' } });
  }
  throw new Error('未預期的請求：' + url);
};

const latest = (await import('../netlify/functions/latest.mjs')).default;
const download = (await import('../netlify/functions/download.mjs')).default;

// ---- /api/latest（全部產品）----
{
  const res = await latest(new Request('https://tmd-run.netlify.app/api/latest'));
  assert.equal(res.status, 200);
  const list = await res.json();
  assert.equal(list.length, 2);

  const afk = list.find((p) => p.product === 'afk');
  assert.equal(afk.status, 'released');
  assert.equal(afk.version, '1.2.0', 'tag 的 v 要去掉，更新器才能直接比大小');
  assert.equal(afk.files.length, 1, 'Release 只有一個 zip');
  assert.deepEqual(afk.files[0], {
    kind: 'zip', name: 'TMD_Runner.zip', url: 'https://tmd-run.netlify.app/download/afk/zip', size: 62914560, sha256: 'aaa',
  });
  assert.equal(afk.files[0].url.includes('github'), false, '下載網址必須走本站，不能暴露 GitHub 網址');

  const run = list.find((p) => p.product === 'run');
  assert.equal(run.status, 'building', '沒有 Release 的產品顯示建置中');
  assert.equal(run.version, undefined);
}

// ---- /api/latest?product=afk 走快取，不會再打 GitHub ----
{
  const before = calls.length;
  const res = await latest(new Request('https://tmd-run.netlify.app/api/latest?product=afk'));
  const one = await res.json();
  assert.equal(one.product, 'afk');
  assert.equal(calls.length, before, '60 秒內第二次查詢應命中快取');
}

// ---- 未知產品 ----
{
  const res = await latest(new Request('https://tmd-run.netlify.app/api/latest?product=nope'));
  assert.equal(res.status, 404);
}

// ---- /download/afk/zip → 302 到 GitHub 的暫時網址 ----
{
  const res = await download(new Request('https://tmd-run.netlify.app/download/afk/zip'), { params: { product: 'afk', kind: 'zip' } });
  assert.equal(res.status, 302);
  assert.match(res.headers.get('location'), /^https:\/\/objects\.githubusercontent\.com\//);
  assert.equal(res.headers.get('cache-control'), 'no-store', '暫時網址會過期，不能被快取');
}

// ---- 沒有 Release 的產品不能下載 ----
{
  const res = await download(new Request('https://tmd-run.netlify.app/download/run/zip'), { params: { product: 'run', kind: 'zip' } });
  assert.equal(res.status, 404);
}

// ---- 未知檔案類型（exe 已不在 products.json 裡）----
{
  const res = await download(new Request('https://tmd-run.netlify.app/download/afk/exe'), { params: { product: 'afk', kind: 'exe' } });
  assert.equal(res.status, 404);
}

console.log('全部測試通過');
