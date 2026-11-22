# 北成國小｜國樂・管樂數位投票 v3（GitHub Pages + Firebase）

使用六台 iPad 固定一站一樂器。學生選「班級 → 座號」即顯示姓名，確認後由 Firebase Cloud Functions 交易式寫入；每位學生在 **國樂、管樂各最多一票**。電視頁面的票數與比例由 Firestore 分片計數器即時監聽。教師後台能管理樂器、站點、匯入 CSV／XLSX 名冊、查看各班票率、匯出明細與控制活動狀態。

> **已填入你提供的 Firebase Web App 設定，但是仍是可部署的原始碼，**不是**已啟用後端的正式網站。** 已預留安全後端程式與 Firestore Security Rules；未完成 Firebase 專案及身分驗證設定時，公開網頁會明確提示「僅供預覽，不能正式投票」，並且不存入任何真實選票。**請勿把正式學生名冊放進 GitHub 儲存庫。**

## 一、部署 GitHub Pages 靜態前端

1. 在 GitHub 建立新儲存庫 `-music-vote`，建議用獨立 repo，不要覆蓋既有校網。
2. 本儲存庫根目錄已包含 `index.html`、`style.css`、`app.js`、`firebase-config.js`，請從 GitHub Pages 設定 main 根目錄發布。
3. GitHub → 儲存庫 → Settings → Pages → Deploy from a branch → `main` → `/(root)` → Save。
4. 網站首頁格式通常為 `https://<你的GitHub帳號>.github.io/<儲存庫名稱>/`。正式上線前請核對 GitHub Pages 實際網址。前端所有檔案皆採相對路徑，支援專案站點子目錄。

## 二、建立 Firebase 專案（尚需 Firebase 帳戶連接或自行操作）

1. 到 https://console.firebase.google.com/ 新增專案，選擇適當區域，啟用 **Cloud Firestore（正式鎖定規則）**、**Authentication → Email/Password**。
2. **已完成：** `firebase-config.js` 填入 `music-vote-3de89` 的 Web App 設定，不需要再貼一次。它屬於公開 Web App 設定；不要放私鑰、憑證 JSON 或管理員密碼。
3. 啟用 Blaze 付費計畫（第二代 Cloud Functions 通常需要；請設定預算警示），安裝 Node 22 與 Firebase CLI：`npm i -g firebase-tools`，並用 `firebase login` 登入後在此專案目錄執行 `firebase use music-vote-3de89`。請先在 `functions/` 執行 `npm install` 安裝後端套件，再回到專案根目錄部署。
4. `firebase deploy --project music-vote-3de89 --only firestore:rules,functions` 部署安全規則及 Callable Functions。後端地區固定 `asia-east1`，前端也是相同地區。
5. 在 Firebase Auth 控制台手動建立一個教師管理員帳號；複製其 UID，並在 Firestore 控制台建立文件 `roles/<該UID>`，欄位 `role` (string) = `admin`、`active` (boolean) = `true`。
6. 管理員進入網站 `?view=admin`，登入後呼叫 **初始化**。初始化會建立活動設定、12 個樂器項目、六站及 **120 筆假學生資料**（不應先正式啟用）。初始活動狀態為「暫停投票」。
7. 在 Firebase Authentication 手動建立 6 個「投票站」帳號（建議各不同的強密碼），再在管理員後台「綁定站點帳號」輸入各站 Email。各 iPad 以各自的站點帳號登入。
8. 回到後台，確認各站樂器與測試名冊，再將狀態設為「開放投票」。

### 首次管理員初始化

若 `settings/public` 文件不存在，管理員登入後台會顯示「初始化測試活動」按鈕。它只應執行一次。這一步需要已完成 Firestore 角色授權，不能在未登入時自行建立管理員身分。

## 三、網址與現場操作

- 主頁：GitHub Pages 首頁
- 第 1 站：`?view=station&station=1`（其餘站號 `2～6`）
- 大電視：`?view=display`
- 教師後台：`?view=admin`

每一站的樂器從 Firebase 中的 `stations` 文件綁定，由投票 API 根據登入者身份與伺服器上的站點設定決定計票，**不是由學生自行指定**。

### 正式投票流程

班級 → 座號 → 顯示姓名、班級、座號 → 確認是否投給目前站點的樂器 → 成功畫面 → 約 1.7 秒自動回起始畫面；失敗則清楚顯示錯誤，不會加票。

### 防重複投票

Firebase 交易為每名學生每類建立固定選票 ID：`votes/{class_seat_category}`。同時在兩台 iPad 確認同一類別，只能成功建立一張選票；分類不同則分別有效。票數使用每樂器 24 個分片以減少寫入競爭。電視頁面僅讀取匿名的彙總計數及樂器名稱，不可讀學生姓名。

## 四、學生名冊格式

CSV UTF-8 或 `.xlsx` 第一張工作表，欄名：

```csv
班級,座號,姓名
101,1,測試小明
101,2,測試小華
102,1,測試小安
```

若要換正式名冊，請先清除假資料投票，接著在後台勾選「整份替換」並匯入正式名冊。**不要把 Excel 上傳到公開 GitHub 儲存庫**。

## 五、資訊安全／使用限制

- GitHub Pages 是公開靜態網頁，不能用來藏管理員密碼或 Firebase 私鑰。管理後台使用 Firebase Authentication 加 Firestore `roles/{uid}` 授權；前端沒有內建的 `admin888` 之類弱密碼。
- 學生資料與選票唯有 Cloud Functions 伺服器側讀寫；Firestore Rules 拒絕客戶端直接讀寫學生、選票、權限資料，僅公開彙總票數。
- 教師在場監督學生選班級與座號。僅班級＋座號無法強驗本人身分，如需防代投須再加驗證步驟。
- 管理員可登入後台查看每班個人已投／未投，但不能在公共電視顯示姓名。
- 建議活動專用 iPad 啟用「引導使用模式」，使學生不會離開投票介面；裝置依校方 MDM 管理。
- **必須先用假名冊完成測試、授權與網路檢查，才匯入正式學籍個資。**

## 六、檔案結構

```text
index.html                 GitHub Pages 首頁
style.css                  RWD iPad／電視設計
app.js                     站點／投票／後台 UI
firebase-config.js         待填 Firebase Web App 公開設定
functions/index.js             Firebase 第二代 Callable Functions
functions/package.json         後端依賴
firestore.rules                Firestore 公開彙總、私有名冊規則
firebase.json                  Firebase 部署規格
```

此專案的靜態前端只有在 Firebase Web App 設定及 Functions 部署完成後，才是可跨裝置實際投票的正式系統。Firebase 官方文件：https://firebase.google.com/docs/functions/callable 、https://firebase.google.com/docs/firestore/security/get-started

## 七、不啟用後端時的操作預覽

在網站網址後加上 `?demo=1` 時，首頁與電視會使用明確標示的範例數據；六個站點可用「測試學生」體驗班級→座號→確認流程，但此時投票只暫存在該頁記憶體，**重新整理即消失，也不會同步到其他 iPad 或電視**。這僅是操作體驗，不是實際計票系統。教師管理後台必須連上 Firebase 並登入權限帳號才能操作。


## 八、這次已填入的設定與未完成項目（2026-11-22）

- ✅ Web App 設定：`music-vote-3de89`，並建立 `.firebaserc` 限定部署專案。
- ✅ 離線體驗：首頁開啟 `?demo=1` 可選班級、座號、確認投票。此模式不會寫入 Firebase，也不會跨裝置同步。
- ✅ 初始六個站點設定：國樂 3 站（二胡、琵琶、笛子），管樂 3 站（長笛、單簧管、薩克斯風）。後台可變更綁定。
- ⛔ ✅ `superterry0927/-music-vote` 已建立並可上傳網站程式；GitHub Pages 設定與 Firebase Cloud Functions 仍需另行啟用。
- ⛔ Firebase 外掛未連結：尚未代為開啟 Firestore、Authentication、Blaze、發布 Cloud Functions、套用安全規則或建立使用者。
- ⛔ 未進行真實跨六台 iPad 的網路／權限／投票壓力驗收。

### 建議你現在操作

1. GitHub https://github.com/new 建立 **Public**、名稱 `-music-vote` 的空白儲存庫，不要勾選初始化 README；完成後回覆「GitHub 建好了」，即可協助把公開網站檔案寫入該新儲存庫。
2. Firebase 控制台 https://console.firebase.google.com/project/music-vote-3de89/overview ：確認已建立 Firestore（先維持拒絕未授權讀寫的正式規則）、Authentication → Email/Password。Cloud Functions 發布需要 Blaze 方案。
3. Firebase Authentication → Settings → Authorized domains 加入 `superterry0927.github.io`（如果使用 GitHub Pages）。
4. 後端正式上線後才匯入真實名冊；管理員密碼不要放到 GitHub Pages。

### 使用者測試畫面

- 本機用 `python3 -m http.server 8000`（在 `web/` 資料夾執行）後，開啟 `http://localhost:8000/?demo=1`。直接打開 file:// 檔案可能因 ES Modules 被瀏覽器限制。
- 真正的線上投票網頁（完成 GitHub Pages 和 Firebase Functions 後）不需 `demo=1`。
