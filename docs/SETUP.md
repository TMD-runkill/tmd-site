# 架設步驟（給網站管理者）

做完這份清單後，之後每次出新版只需要在 GitHub 發一個 Release，網頁和程式會自動看到新版本。

整體架構：

```
使用者瀏覽器 ──> Netlify 網站 ──> /api/latest、/download/... (Netlify 函式)
WinForms 程式 ─┘                          │ 帶 GITHUB_TOKEN
                                          ▼
                       GitHub 組織底下的私人 repo 的 Releases（一個 zip）
```

所有 repo 放在一個 GitHub **組織（Organization）** 底下，兩位管理者都是 Owner，不綁在任何一個人的帳號上。

需要的帳號：兩位管理者各自的 GitHub 帳號、Netlify（現有的 tmd-run 站台，只能一個人）。全程約 40 分鐘。

以下用 `tmd-team` 代表組織名稱，實際建立時自行取名。

---

## 第 1 步：建立 GitHub 組織

1. 登入 GitHub，右上角 **+** → **New organization**（或直接開 https://github.com/organizations/plan ）。
2. 選 **Free** → Create a free organization。
3. 填寫：
   - Organization name：`tmd-team`（會出現在網址 `github.com/tmd-team`）
   - Contact email：自己的信箱
   - This organization belongs to：**My personal account**
4. 「Add organization members」那頁輸入另一位管理者的帳號送出邀請，對方到 GitHub 通知或信箱接受。
5. 組織首頁 → **People** → 找到對方 → 右邊 **Member** 改成 **Owner**。兩人權限相同，任何一人都能管 repo、成員與設定。

## 第 2 步：建立 repo（3 個：網站公開，兩個 release repo 私人）

到 https://github.com/new，**Owner 下拉選單改選 `tmd-team`**，依序建立：

| Repo 名稱 | 用途 | 設定 |
|---|---|---|
| `tmd-site` | 網站程式碼（本資料夾） | **Public**，不勾 README |
| `tmd-afk-releases` | 「全自動掛機」的 Release 檔案 | Private，**勾選 Add a README**（repo 不能是空的） |
| `tmd-run-releases` | 「跑殺」的 Release 檔案 | Private，**勾選 Add a README** |

建好後網址會是 `github.com/tmd-team/tmd-site` 等。

`tmd-site` 必須公開：Netlify 免費方案不能連結「組織底下的私人 repo」，要連的話得升級 Pro（每月 20 美元）。公開沒有風險，這個 repo 裡只有網頁和函式程式碼，token 放在 Netlify 環境變數，exe 放在另外兩個私人 repo，都不會進到 `tmd-site`。`.gitignore` 已排除 `.env`，本機測試的 token 不會被 commit。

## 第 3 步：建立 GitHub token

1. GitHub 右上角頭像 → **Settings** → 左側最下方 **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**。
2. 填寫：
   - Token name：`tmd-site`
   - Expiration：選 **Custom** 設一年後（最長只能一年）。**把到期日記在行事曆**，到期前要換新 token，否則網站下載會全部失效。
   - **Resource owner：選 `tmd-team`**，不是自己的帳號。選錯會勾不到組織的 repo。
   - Repository access：選 **Only select repositories**，勾 `tmd-afk-releases` 和 `tmd-run-releases`。
   - Permissions → Repository permissions → **Contents** 設為 **Read-only**。其他都不用。
3. 按 Generate token，**立刻複製**（只會顯示這一次），先貼到記事本，第 5 步要用。

如果 Resource owner 下拉選單裡沒有 `tmd-team`，或建好後顯示等待核准：到組織 **Settings → Third-party Access → Personal access tokens → Settings**，把 Fine-grained personal access tokens 設成 **Allow access via fine-grained personal access tokens**，並選 **Do not require administrator approval**，再重做一次。

token 是建立者個人的。建立者離開組織，token 就失效。換 token 時另一人重做這一步即可（見「常用操作」）。

## 第 4 步：填 repo 名稱並上傳網站程式碼

1. 打開本資料夾的 `products.json`，把兩處 `GITHUB_OWNER` 換成組織名稱，例如：
   ```json
   "repo": "tmd-team/tmd-afk-releases"
   ```
   如果 zip 的檔名不是 `TMD_Runner.zip` / `TMD-RunKill.zip`，也在這裡改。**之後每次發版附上的檔名必須和這裡完全一樣。**
2. 在本資料夾開終端機，上傳到 `tmd-site`：
   ```
   git init
   git add .
   git commit -m "TMD 產品網站"
   git branch -M main
   git remote add origin https://github.com/tmd-team/tmd-site.git
   git push -u origin main
   ```

## 第 5 步：Netlify 接上 GitHub 並設定 token

Netlify 現在把站台叫做 **Project**，以下用新版介面的名稱。舊版介面對應的是 Site configuration → Build & deploy，位置相同。

1. 登入 https://app.netlify.com，在 Projects 列表點進現有的 **tmd-run**。
2. 左側 **Project configuration** → **Developer settings** → **Continuous deployment** → **Repository** 區塊 → **Link repository**。
3. 選 **GitHub**，會跳到 GitHub 安裝 Netlify App 的畫面：
   - 先選要安裝到哪裡：**選 `tmd-team`** 組織，不要選個人帳號。
   - Repository access 選 **Only select repositories**，勾 `tmd-site`，按 Install。
   - 回到 Netlify，repo 列表選 `tmd-team/tmd-site`。
   - 如果列表裡找不到組織或 repo，點 **Configure Netlify on GitHub**，在 GitHub 那頁把 `tmd-team` 加進去或補勾 `tmd-site`。
4. 連結後不用改 Build settings。`netlify.toml` 已寫好 publish 目錄和函式目錄，設定檔的優先權高於介面。若想確認，在同一頁的 **Build settings** 區塊看到 Publish directory 是 `public` 即可；Functions directory 不會出現在介面上，這是正常的。
5. 左側 **Project configuration** → **Environment variables** → **Add a variable** → **Add a single variable**：
   - Key：`GITHUB_TOKEN`
   - Scopes：**All scopes**
   - Values：**Same value for all deploy contexts**，Value 貼上第 3 步的 token
   - 若有 **Contains secret values** 勾選框就勾起來
   - **Create variable**
6. 環境變數改了要重新部署才生效：左側 **Deploys** → 部署列表上方 **Trigger deploy** → 選 **Deploy project**（舊版叫 Deploy site）。等 1 分鐘變成綠色 Published。
7. 打開 https://tmd-run.netlify.app/api/latest 應該看到兩個產品都是 `"status":"building"`。這代表函式和 token 都正常，只是還沒發版。

Netlify 免費方案一個團隊只有一個成員，所以 Netlify 只能由一人登入。日常維護不需要碰 Netlify，push 到 GitHub 就自動部署；只有換 token 和看部署紀錄需要登入。

## 第 6 步：發布第一個版本

兩位 Owner 誰發都可以。

1. 到 `tmd-afk-releases` repo → 右側 **Releases** → **Create a new release**（或 Draft a new release）。
2. **Choose a tag** → 輸入 `v1.0.0` → 點 **Create new tag: v1.0.0 on publish**。
3. Release title：`V1.0.0`（隨意）。
4. Describe this release：更新說明，一行一條，例如：
   ```
   - 首發正式版
   - 支援全自動登入、進房、掛機
   ```
   這段文字會直接顯示在網頁上。
5. 把 exe 和 `config.json` 壓成 **`TMD_Runner.zip`**（選取兩個檔案直接壓縮，zip 打開就是檔案，不要多包一層資料夾），拖到 Attach binaries 區塊，等上傳完成。
6. 按 **Publish release**。
7. 最多 60 秒後重新整理網頁，就會看到 V1.0.0 和下載按鈕。

之後每次更新就重複第 6 步，tag 往上加（`v1.0.1`、`v1.1.0`……）。程式裡的 AssemblyVersion 要跟 tag 一致，更新器才會正確比較。

---

## 常用操作

**測試版不想公開：** 發 Release 時勾 **Set as a pre-release**，網頁和更新器會忽略它。

**備援下載連結：** 在 `products.json` 該產品的 `backup_url` 填網址（例如 Google Drive 資料夾），commit 並 push，網頁就會多一個「備援下載」按鈕。不填就不顯示。

**新增產品：** 在組織下建一個新的 release repo，`products.json` 加一筆，`public/index.html` 複製一個 `<article class="product" data-product="...">` 卡片改名字，push。新 repo 也要加進 token 的 Repository access，否則會一直顯示建置中。

**更換 token（每年一次）：** 任一位 Owner 重做第 3 步，請 Netlify 帳號持有人到 **Project configuration → Environment variables** 點 `GITHUB_TOKEN` → **Options → Edit** 換成新值，再到 **Deploys → Trigger deploy → Deploy project**。

**加人或移除人：** 組織首頁 → **People** → Invite member / Remove。不用逐個 repo 設定。

---

## 出問題時

| 現象 | 原因 | 處理 |
|---|---|---|
| 網頁顯示「暫時無法取得」 | 函式出錯 | 打開 `/api/latest` 看 `message`。最常見是 token 過期或打錯 |
| 明明發了 Release，網頁還是「建置中」 | `products.json` 的 repo 名稱打錯，或 token 沒勾到那個 repo | 檢查 repo 名稱與 token 的 Repository access |
| 建 token 時勾不到組織的 repo | Resource owner 選成個人帳號，或組織未允許 fine-grained token | 重做第 3 步，Resource owner 選組織；檢查組織的 Third-party Access 設定 |
| token 突然失效但沒過期 | 建立 token 的人離開了組織 | 另一位 Owner 重做第 3 步 |
| 網頁有版號，但少了下載按鈕 | 發版時附的 zip 檔名和 `products.json` 不一樣 | 到 Release 頁面刪掉附件重新上傳正確檔名 |
| 剛發版但網頁沒變 | 60 秒快取 | 等一下再重新整理 |
| 解壓後執行時 Windows 警告 | exe 未簽章 | 正常，說明區已寫給使用者看 |
