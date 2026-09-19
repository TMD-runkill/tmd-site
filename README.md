# TMD 產品網站

產品下載頁。下載連結、版號、更新說明全部從 GitHub Releases 自動取得，發新版不用改網頁。

- 架設步驟：[docs/SETUP.md](docs/SETUP.md)
- API 規格（網頁與程式更新器共用）：[docs/API.md](docs/API.md)
- WinForms 更新器範例：[docs/updater-sample/UpdateChecker.cs](docs/updater-sample/UpdateChecker.cs)

## 結構

```
public/                 靜態網頁（index.html、styles.css、app.js、logo、favicon）
netlify/functions/
  latest.mjs            GET /api/latest              版本資訊 JSON
  download.mjs          GET /download/:product/:kind  302 轉到 GitHub 暫時下載網址
netlify/lib/github.mjs  共用：查 GitHub Release、60 秒快取、轉成 JSON
products.json           產品清單：代號、名稱、release repo、檔名、備援連結
docs/                   文件
scripts/                本機預覽與測試
```

## 本機

```
npm test          # 用假 GitHub 回應測兩個函式
npm run preview   # http://localhost:8788，假資料預覽網頁外觀，不需 token
npm run dev       # 用 Netlify CLI 跑真實函式，需先複製 .env.example 成 .env 填 token
```
