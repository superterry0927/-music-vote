# 北成國樂管樂投票｜Firebase 最後上線步驟

本網站的 **GitHub Pages 已發布成功**：2026-11-22 已查核 GitHub Actions「pages build and deployment」顯示 success。

- 網站：https://superterry0927.github.io/-music-vote/
- 模擬操作：https://superterry0927.github.io/-music-vote/?demo=1
- Firebase 專案：`music-vote-3de89`

> **注意：網站已發布不等於可以正式投票。** Firebase 的資料庫、登入、Cloud Functions、安全規則及角色必須部署後才能讓六台 iPad 同步計票。目前不要匯入真實學生名冊。

## A. Firebase 控制台先完成三項

登入 https://console.firebase.google.com/project/music-vote-3de89/overview

1. **Firestore Database → Create database**：選擇 Standard edition（若有版本選項）、`(default)` 資料庫，建議區域 `asia-east1`（臺灣；若本專案已固定其他區域則以現有區域為準），**Production mode**。注意建立後資料庫位置通常不能直接更改。
2. **Authentication → Sign-in method**：啟用「電子郵件／密碼」。再至 Authentication → Settings → Authorized domains，加入 `superterry0927.github.io`（只輸入網域，不要加 https:// 或路徑）。
3. **Usage and billing**：將專案升級為 Blaze 按量計費方案並建立預算警示。部署 Cloud Functions (2nd gen) 需要 Blaze。

## B. 不用安裝工具，直接用瀏覽器 Cloud Shell 部署

在 Firebase 控制台開啟 Cloud Shell（或在 Google Cloud Console 右上角點選 Cloud Shell 圖示），用具有此 Firebase 專案權限的 Google 帳號執行：

```bash
git clone https://github.com/superterry0927/-music-vote.git
cd -- -music-vote
npm --prefix functions install
firebase deploy --project music-vote-3de89 --only firestore:rules,functions
```

若 Cloud Shell 沒有 firebase 指令，先在 Cloud Shell 執行 `npm install -g firebase-tools`，再重試最後一行。部署會更新這個專案的 Firestore Security Rules；若有其他應用共用相同專案，請先核對規則。

部署成功後應看到四個 Callable Functions：
`getClasses`、`getStudent`、`getStationProfile`、`castVote`，以及 `adminAction`（共五個）。

## C. 建立管理員角色（只在 Firebase 控制台操作，不要公開密碼）

1. **Authentication → Users → Add user** 建立教師管理員 Email/Password 帳號，密碼請自行保存。
2. 複製這個帳號的 **UID**。
3. **Firestore Database → Data → Start collection**：
   - Collection ID：`roles`
   - Document ID：剛剛複製的 UID
   - Field 1：`role`，類型 String，值 `admin`
   - Field 2：`active`，類型 Boolean，值 `true`
4. 開啟 https://superterry0927.github.io/-music-vote/?view=admin ，用剛才的 Email/Password 登入，按「初始化測試活動」。系統會建立 120 筆**虛構測試名冊**，預設為暫停投票。
5. Authentication → Users 再建立六組投票站用 Email/Password 帳號。登入管理後台，依序將每個帳號綁到第 1～6 站，確認樂器設定。
6. 每台 iPad 分別用專屬站點帳號登入：
   - 第1站：`?view=station&station=1`
   - 第2～6站：只需將 `station=1` 改成 2～6
   - 電視：`?view=display`
7. 完成六站測試後，管理員才將狀態切換為「開放投票」。

## D. 上線前必須測試

- 同位學生同類別換兩台 iPad 同時投票，只能成功一票。
- 同位學生可以投一張國樂票＋一張管樂票。
- 電視在六站送票後即時更新票數及比例。
- iPad 重新整理／斷網時不可誤認投票成功。
- 匯入的名冊只能由授權站點查詢，電視和公開頁面不得顯示姓名。
- **正式名冊上傳前請先暫停投票，清空測試票，並確認授權與資安。**

此文件是操作指引，不代表我已經替你的 Firebase 雲端部署。Firebase 帳戶尚未連接 ChatGPT，雲端部署必須由有專案權限的使用者在 Cloud Shell 完成。
