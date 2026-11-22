# 北成國樂管樂投票｜v4 Spark 免費版部署狀態

- GitHub 儲存庫： https://github.com/superterry0927/-music-vote
- GitHub Pages： https://superterry0927.github.io/-music-vote/
- Firebase 專案： `music-vote-3de89`，**Spark 免費方案**
- v4 前端：改為直接存取 Firestore，不再使用 Cloud Functions。
- Firestore Security Rules：已編寫原始碼，**尚須到 Firebase Console 的 Firestore Rules 按「發布」才會生效**。
- 管理員 `roles/{uid}`：仍需 Firebase Console 手動建立。
- 六台投票站 UID：需在 Authentication 新增帳號後由後台綁定。
- 正式投票：尚待 Firebase 控制台設定及六台 iPad 驗收；不可宣稱已上線可投票。

詳細步驟：[FIREBASE_下一步.md](./FIREBASE_下一步.md)。


### v5 更新
GitHub 網站及 Spark 客戶端程式已擴充到十二站。若資料庫先前只初始化六站，管理員必須在後台暫停投票並按「補齊 12 個站點」。無法由 GitHub 直接建立 Firebase Auth 帳號或更動使用者既有 Firebase Firestore 文件。
