# exam-score-lookup — 課程成績查詢

學生輸入**學號＋姓名** → 列出自己每一次測驗作答的時間戳記、系所、學號、姓名、分數（同一場考試交多次全部列出、標最高分）。2026-11-03 建立，課程「跨境電子商務」。姊妹專案：`../practice-submission-lookup/`（課堂練習存摺，同一套骨架）。

- 前端：單檔 `index.html`＋`manual.html`，公開 repo <https://github.com/M255525/exam-score-lookup>，GitHub Pages（Actions，push master 自動部署）<https://m255525.github.io/exam-score-lookup/>；本機預覽 port **8848**（`.claude/launch.json` 的 `exam-score-lookup`）。
- 後端：`gas/` 是**獨立** Apps Script 專案「課程成績查詢 API」（scriptId 見 `gas/.clasp.json`），Web App 以老師身分執行、任何人可存取。
  - 部署 ID `AKfycbyCNeQIzTCtxgo6HiyDC5XfyQ6sSuSOxx7dlxBYiWxaJ8yYWFotjGGpnF4-VXM2l_9rHA`（寫死在 `index.html` 的 `API_URL`）。
  - 改 Code.gs 後：`cd gas && clasp push --force && clasp create-deployment --deploymentId <上面ID>`，**沿用同一 ID**。
  - 端點：`?action=ping`（預熱）、`?action=lookup&sid=&name=`。
- 資料來源：`EXAMS` 陣列，目前一筆「期中測驗」＝試算表「115年跨境電子商務期中測驗 (回覆)」`1F-k8yRFmG614stE9zystmCSj3YIici3828PG5s4lUNc` 分頁「表單回覆 1」。**新增期末考等只要在 `EXAMS` 加一行**，欄位依標題文字找（時間戳記／分數／系所／學號／姓名），不寫死欄位字母。分數「96 / 100」拆成 got/full。

## 個資原則（真實學生姓名＋學號＋成績）
- 試算表維持私人，不要開「知道連結者可檢視」或發佈 CSV。
- 學號（全形轉半形、只留英數、大寫、6～12 碼）**與**姓名（去空白、全形轉半形）都相符才回傳；任一不符一律回 count 0，不透露是哪一個錯（避免用學號試出姓名）。
- 只回傳 5 個白名單欄位＋考試名稱；**不回傳作答內容（G–AE 欄）與電子郵件**。姓名是學生自己輸入的，所以不遮罩。
- 前端「記住學號與姓名」**預設關閉**（與練習存摺相反），因為成績比練習紀錄敏感。

## 標準配備
跑馬燈（共用 `MARQUEE_CHECK_URL`，滑鼠移入暫停）、PWA（`service-worker.js` 不快取跨網域 API）、訪客計數器 `m255525.examscorelookup`（說明頁 `.manual`）、⚙ 常用設定（localStorage `examScoreLookup.settings`／`.me`）、使用警語（頁面區塊＋首訪彈窗 `examScoreLookup.warned`）、創作者資訊在 `manual.html#creator`。

## 踩坑（沿用姊妹專案）
- `SpreadsheetApp.openById` 需完整 `spreadsheets` 權限；新專案要在編輯器跑一次 `testLookup` 授權，否則 Web App 回 Google 登入頁 HTML。
- CacheService 5 分鐘快取（每場考試一個 key），老師改試算表最多 5 分鐘後生效。
- 前端 `fetchJson` 25 秒逾時＋重試 1 次、開頁 ping 預熱、超過 5 秒顯示「請稍候」。
- clasp 3.x `clasp create` 會覆蓋 appsscript.json（時區變 America/New_York），建完要改回。
