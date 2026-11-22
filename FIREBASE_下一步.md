# 2026-11-22：北成樂器投票 v4 Spark 免費版下一步

✅ GitHub Pages： https://superterry0927.github.io/-music-vote/  
✅ Firebase 網頁設定已填入：`music-vote-3de89`  
✅ Authentication 的「電子郵件／密碼」已由你啟用。  
✅ 前端已改成不呼叫 Cloud Functions 的 Firestore 交易投票。  
⛔ **Firestore 資料庫、Rules、登入角色尚待你在 Firebase Console 啟用／驗證；未啟用不能正式投票。**

## 完全免費的手動設定

### 1. 確認 Cloud Firestore 存在

前往 https://console.firebase.google.com/project/music-vote-3de89/firestore ，未建立才點「建立資料庫」，選 Production mode。使用 Spark 免費方案，不用 Blaze。

### 2. 貼上並發布 Firestore Rules（最重要）

開啟 GitHub 的 [`firestore.rules`](./firestore.rules) 並全選複製，貼到 Firebase → Firestore Database → **規則 (Rules)** → **發布**。不要使用 `allow read, write: if true` 的測試規則！

### 3. 建立管理員

Firebase → Authentication → 使用者 → 建立教師帳號，複製 **UID**。到 Firestore → 資料，建立 `roles/<UID>` 文件，欄位：

| 欄位 | 類型 | 值 |
| --- | --- | --- |
| `role` | String | `admin` |
| `active` | Boolean | `true` |

注意：UID 是 Auth 使用者 ID，不是 Email；密碼不要貼到 GitHub 或聊天中。

### 4. 初始化與六站帳號

在 https://superterry0927.github.io/-music-vote/?view=admin 登入，點「建立測試活動」。建立成功後，Firebase Authentication 再建立六組 Email／密碼投票站帳號；把各個使用者的 **UID** 複製到後台「綁定站點帳號」。

### 5. 測試

活動改為開放，使用四班共 120 人的虛構測試資料測一次：同位學生投「國樂」一次成功、再投另一國樂應被阻止、投「管樂」成功；用電視模式確認兩類比例。正式名冊導入前要先清空測試票，再暫停／替換學生名冊。

### 其他提醒

- GitHub Pages 的網址已發布，但不能用來推論 Firebase 也部署完成。
- `?demo=1` 是不寫入雲端的模擬操作，可隨時先試介面。
- **不需要安裝 Firebase 外掛、不需要 Cloud Shell、不需要 Cloud Functions、不需要付款或信用卡。**
- Firestore 免費額度用完會受限；測試前先確認有足夠配額。

完整文件請看 [README.md](./README.md)。


## v5：已初始化六站的活動如何升級到十二站

請登入管理後台、將投票狀態設為「暫停投票」，在「十二台 iPad 站點設定」點選 **補齊 12 個站點**。
此動作只增加缺少的站點，保留原有 1～6 站的樂器、帳號、學生及票數；不用重新初始化。
預設新增站點：第 7 站揚琴、第 8 站中阮、第 9 站國樂打擊、第 10 站小號、第 11 站長號、第 12 站管樂打擊。
請再至 Firebase Authentication → 使用者，建立第 7～12 站專用的電子郵件／密碼帳號。複製各帳號 UID，在教師後台「綁定站點帳號」指定第 7～12 站。每台 iPad 開啟 `?view=station&station=N`（N 為 1～12）。
**12 個投票站各自要有不同的登入帳號；十二種樂器仍然各別被歸類為國樂或管樂，每個學生兩類各限一票。**
