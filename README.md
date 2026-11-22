# 北成國小｜國樂＋管樂人氣投票 v4 — Firebase Spark 免費版

**GitHub Pages 網站：** https://superterry0927.github.io/-music-vote/  
**Firebase 專案：** `music-vote-3de89`  
**方案：** Firebase Spark 免費方案，不使用 Cloud Functions，也不需升級 Blaze 或綁信用卡。

## 重要：網站程式更新 ≠ Firebase 資料庫已啟用

這次已將 GitHub Pages 的程式碼改成直接存取 Firestore。**只有在 Firebase 控制台完成建立 Firestore、貼上安全規則、建立管理員權限後，才可以啟用正式投票。** 目前請勿匯入真實學生名冊，僅以內建 120 筆虛構名冊測試。

## 第一步：確認 Firestore 已建立（完全免費）

1. 開啟 https://console.firebase.google.com/project/music-vote-3de89/firestore
2. 若尚未建立，點「建立資料庫」，選 **Standard / `(default)` / Production mode**。可選臺灣 `asia-east1`，但若系統已指定其他地區，不要重建。
3. 確認目前專案顯示 **Spark**，不需要升級 Blaze。

## 第二步：最重要！發布 Firestore 安全規則

1. 在 Firebase 控制台 → **Firestore Database → 規則 (Rules)**。
2. 開啟本儲存庫的 [`firestore.rules`](./firestore.rules)，**全選複製完整內容**，貼進 Firebase「規則」編輯器，覆蓋原有測試規則。
3. 按下 **發布 (Publish)**，確認沒有語法錯誤。**只修改 GitHub 的 `firestore.rules` 不會自動修改 Firebase 雲端規則。**
4. 所有學生姓名、投票明細、站點設定、權限均依登入身份限制存取；公開電視僅能讀取匿名樂器彙總資料。站點建立選票和計數分片必須在同一個 Firestore 交易中，否則規則會拒絕。

> 也可以從專案根目錄執行 `firebase deploy --project music-vote-3de89 --only firestore:rules`，但**只部署安全規則**，不需要 Cloud Functions 或 Blaze。沒有安裝 Firebase CLI 就直接在控制台貼上即可。

## 第三步：Authentication 已啟用；新增管理員

1. Firebase → Authentication → 登入方式：你已啟用「電子郵件／密碼」，請維持開啟。
2. Authentication → 設定 → 已授權網域：確認有 `superterry0927.github.io`（不要加協定或路徑）。
3. Authentication → 使用者 → 新增使用者，建立**教師管理員 Email＋強密碼**（不要提供密碼給 ChatGPT，亦不要寫進 GitHub）。
4. 建立成功後，在「使用者」清單複製該帳號的 **UID**。
5. Firebase → Firestore Database → 資料 →「開始集合」：
   - 集合 ID：`roles`
   - 文件 ID：**剛才複製的管理員 UID**（不是電子郵件）
   - 欄位 `role`：字串 String，值 **`admin`**
   - 欄位 `active`：布林 Boolean，值 **`true`**
6. 確認上述設定後，開啟 [教師管理後台](https://superterry0927.github.io/-music-vote/?view=admin)，以管理員帳號登入。
7. 首次登入按 **「建立測試活動」**，建立 12 種樂器、12 個投票站、120 名虛構學生。初始化時活動是 **暫停投票**。

**注意：** 若忘記第 5 步，即使 Email/Password 可以登入，也會顯示「沒有管理權限」；這是安全設計，並非帳號密碼錯誤。

## 第四步：建立十二台 iPad 的「投票站」帳號

1. Firebase Authentication → 使用者 → 新增六組不同的 Email／強密碼帳號。
2. 每個帳號旁邊都有不同的 **UID**，請複製（不用把密碼輸入管理後台）。
3. 在教師後台「十二台 iPad 站點設定 → 綁定站點帳號」，每一站填入相應的 **UID**，按「綁定此帳號」。
4. 各 iPad 用該站帳號登入，開啟各自網址：

| iPad | 網址 | 預設樂器 |
| --- | --- | --- |
| 1 | `?view=station&station=1` | 國樂／二胡 |
| 2 | `?view=station&station=2` | 國樂／琵琶 |
| 3 | `?view=station&station=3` | 國樂／笛子 |
| 4 | `?view=station&station=4` | 管樂／長笛 |
| 5 | `?view=station&station=5` | 管樂／單簧管 |
| 6 | `?view=station&station=6` | 管樂／薩克斯風 |

所有網址前面加上 `https://superterry0927.github.io/-music-vote/`，例如：  
https://superterry0927.github.io/-music-vote/?view=station&station=1

**電視展示：** https://superterry0927.github.io/-music-vote/?view=display

## 第五步：學生實際投票、雙類別一人一票

1. 管理員在後台改為「開放投票」。
2. 學生到指定投票站，點選「班級 → 座號」，系統顯示姓名。
3. 按「確認投給該樂器」，成功寫入後顯示成功訊息，約 1.7 秒返回班級選擇頁。
4. 同一位學生：**國樂最多一票、管樂最多一票**；相同類別跨站同時按下確認，Firestore 交易也只允許建立一張票。
5. 大電視會即時更新樂器票數與得票比例；後台可查各班進度。

## 匯入／更換名冊

後台選擇 CSV 或 `.xlsx`；欄名第一列必須為 `班級,座號,姓名`，例如：

```csv
班級,座號,姓名
101,1,測試小明
101,2,測試小華
102,1,測試小安
```

首次測試使用系統假資料即可。匯入真實學生資料前，應取得學校授權並確認資料處理流程；必須暫停投票、先清空測試票，再勾選「整份替換」匯入，切勿將姓名名冊上傳到 GitHub。

## Spark 版本的安全設計

- **管理員登入：** Firebase Authentication 電子郵件／密碼 + Firestore `roles/{uid}` 管理員角色。
- **站點登入：** 每台 iPad 擁有不同 Firebase Auth 帳號，管理員只需綁定其 UID。
- **防重複計票：** `votes/{學生ID_類別}` 採固定文件 ID，Firestore 原子交易配合 `getAfter()` Rules 檢查計票分片必須精確增加一票。
- **防竄改：** 沒有站點角色不能建立選票；一般用戶不能直接加票、刪票、改角色、讀取姓名或投票明細。
- **管理員可維護：** 樂器新增、修改、封存、十二站改派、名冊匯入、CSV 統計及清空測試票。
- **僅有班級與座號不能驗證本人身分：** 正式活動應有教師在場核對，站點帳號需保密；站點人員若惡意替他人操作，程式無法僅靠班級座號識別。
- **安全規則必須先發布：** 不可使用 Firestore「允許所有人讀寫」測試規則；未發布時，後台和投票可能收到 `Missing or insufficient permissions`。

## 費用與運作限制

- **Spark 無須綁信用卡**；免費 Firestore 使用量有配額（以 Firebase 控制台最新公告為準），達上限會暫停服務，不會自動向未綁定付款方式的 Spark 專案收費。
- 本版每張有效選票會寫入 **2 份文件**（唯一選票 + 一個分片計數），並需查詢投票設定、學生、權限等文件；額外的同步讀取也會計入配額。
- 一般學校活動通常有機會在免費額度內，但需依參與人數、使用天數及即時監聽數量估算並現場監測。
- **這不是高防作弊身分驗證系統**，投票站帳號若外流可能被濫用，必須有人值守。
- 如需將來擴充多場次，須先將目前單場活動架構升級為活動 ID 隔離，不宜直接混用同一份正式名冊與票數。

## 結構

- `index.html`、`style.css`、`app.js`、`spark-backend.js`、`firebase-config.js`：GitHub Pages 公開前端。
- `firestore.rules`：必須貼到 Firebase 控制台並發布，絕不能只上傳 GitHub。
- `firebase.json`、`.firebaserc`：僅供日後部署 Firestore Rules，**沒有 Cloud Functions**。
- [TEST_CHECKLIST.md](./TEST_CHECKLIST.md)：正式投票前驗收清單。

**公開展示僅可查看匿名統計，個資僅在站點登入及教師管理頁可見。**


## v5：已初始化六站的活動如何升級到十二站

請登入管理後台、將投票狀態設為「暫停投票」，在「十二台 iPad 站點設定」點選 **補齊 12 個站點**。
此動作只增加缺少的站點，保留原有 1～6 站的樂器、帳號、學生及票數；不用重新初始化。
預設新增站點：第 7 站揚琴、第 8 站中阮、第 9 站國樂打擊、第 10 站小號、第 11 站長號、第 12 站管樂打擊。
請再至 Firebase Authentication → 使用者，建立第 7～12 站專用的電子郵件／密碼帳號。複製各帳號 UID，在教師後台「綁定站點帳號」指定第 7～12 站。每台 iPad 開啟 `?view=station&station=N`（N 為 1～12）。
**12 個投票站各自要有不同的登入帳號；十二種樂器仍然各別被歸類為國樂或管樂，每個學生兩類各限一票。**

- 第 7 站：`?view=station&station=7`（國樂／揚琴）
- 第 8 站：`?view=station&station=8`（國樂／中阮）
- 第 9 站：`?view=station&station=9`（國樂／打擊）
- 第 10 站：`?view=station&station=10`（管樂／小號）
- 第 11 站：`?view=station&station=11`（管樂／長號）
- 第 12 站：`?view=station&station=12`（管樂／打擊樂）