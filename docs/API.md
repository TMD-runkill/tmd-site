# 版本資訊 API 規格

網頁和 WinForms 程式的自動更新都讀同一個來源。

## `GET /api/latest`

回傳所有產品的陣列。加上 `?product=afk` 只回單一產品（物件，不是陣列）。

回應加了 `Cache-Control: public, max-age=60`，新版發布後最多 60 秒內生效。

### 已發布的產品

```json
{
  "product": "afk",
  "name": "TMD 全自動掛機",
  "status": "released",
  "version": "1.2.0",
  "published_at": "2026-09-18T10:00:00Z",
  "notes": "- 修正登入逾時\n- 優化掛機穩定度",
  "files": [
    { "kind": "exe",    "name": "TMD-AutoAFK.exe", "url": "https://tmd-run.netlify.app/download/afk/exe",    "size": 3145728, "sha256": "e3b0c4..." },
    { "kind": "config", "name": "config.json",     "url": "https://tmd-run.netlify.app/download/afk/config", "size": 2048,    "sha256": "9f86d0..." }
  ],
  "backup_url": null
}
```

| 欄位 | 說明 |
|---|---|
| `product` | 產品代號，對應 `products.json` 的 `key` |
| `status` | `released`、`building`（尚無 Release）、`error`（GitHub 暫時查不到） |
| `version` | Git tag 去掉開頭的 `v`。C# 用 `Version.Parse` 直接比大小 |
| `published_at` | Release 發布時間，ISO 8601（UTC） |
| `notes` | Release 說明原文（Markdown） |
| `files[].kind` | `exe` 或 `config`，對應 `products.json` 的 `files` |
| `files[].url` | 下載網址，一律走本站，不會暴露 GitHub |
| `files[].sha256` | GitHub 計算的檔案雜湊，下載後可比對。GitHub 沒提供時為 `null` |
| `backup_url` | 備援下載連結，`products.json` 沒填就是 `null` |

Release 有附上的檔案才會出現在 `files`。如果發版時忘了附 exe，`files` 就不會有 exe。

### 尚未發布的產品

```json
{ "product": "run", "name": "TMD 跑殺", "status": "building", "backup_url": null }
```

### 查詢失敗

```json
{ "product": "afk", "name": "TMD 全自動掛機", "status": "error", "message": "GitHub 回應 401（...）" }
```

## `GET /download/{product}/{kind}`

例如 `/download/afk/exe`。回 `302` 轉到 GitHub 產生的暫時下載網址（幾分鐘內有效）。程式端用 `HttpClient` 下載時預設會自動跟隨轉址。

錯誤時回 JSON：`404`（產品、檔案類型不存在，或尚無 Release）、`502`（GitHub 暫時有問題）。

## 更新器建議流程

1. 啟動時 `GET /api/latest?product=afk`，逾時 5 秒，失敗就略過不影響使用。
2. `status == "released"` 且 `Version.Parse(version) > 目前版本` 才提示更新。
3. 下載 `kind == "exe"` 的檔案到同資料夾的 `TMD-AutoAFK.exe.new`，算 SHA256 比對 `sha256`。
4. 下載 `kind == "config"` 覆蓋 `config.json`（設定檔只含預設值，可直接覆蓋）。
5. Windows 不能覆蓋執行中的 exe：啟動一個小批次檔，等主程式結束後把 `.new` 改名成正式檔名並重新啟動。
6. 範例程式碼在 `docs/updater-sample/UpdateChecker.cs`。
