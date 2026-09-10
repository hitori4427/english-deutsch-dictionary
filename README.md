# 英德電子辭典 Web/PWA 版本

這是一個可在 iPad/iPhone 直接開啟使用的 Web 版，目標是「不用接電腦」也能用。

## 特點

- iPad 多裝置同步使用：設定儲存在瀏覽器本機（各裝置各自獨立）
- 本機查字：載入 `dictionary.json` 後可離線搜尋
- AI 設定：可選 `MiniMax-01 / m2.7 / m3`，可輸入 endpoint、API Key、逾時
- 測試鍵：`測試 API 設定`
- 收藏：簡單 localStorage 儲存
- 通行碼保護：未設定 `accessPassHash` 會停用；建議設定
- PWA：可安裝到主畫面

## 快速上線到 GitHub Pages

```bash
cd /Users/mac/Documents/ChatGPT/第一個app/apps/EnglishDeutschDictionary/web-pwa
# 把資料夾內容推到你的 GitHub Pages 專案
# 推上你要的 repo 後，Pages 指到 web-pwa 根目錄或這個資料夾對應路徑
```

### 步驟（建議）

1. 建一個 GitHub repo，放 `web-pwa` 資料夾內所有檔案。
2. 在 repo 設定 GitHub Pages，Source 指向 `main` + 根目錄。
3. 開啟你的 Pages 網址。
4. 點 `加到主畫面`（iPad 可直接加入，像原生 App 一樣打開）。

## 安全性說明（重要）

目前是「前端靜態網站」，所以有一件事一定要理解：

- **沒有伺服器端驗證，前端憑證保護只能做到阻擋普通外部亂入者，不是銀行等級防護。**
- 為了避免你 API Key 外流，建議每個人使用自己的 MiniMax API Key。
- 建議先在 `config.js` 設 `accessPassHash`（通行碼雜湊）。

## 設定通行碼

1. 開啟 `tools-generate-pass-hash.html`，輸入一組通行碼。
2. 複製產生的 SHA-256。
3. 貼到 `config.js` 的 `accessPassHash`。

```js
window.ED_WEB_CONFIG = {
  accessPassHash: "<SHA-256 結果>",
  dictionaryModelOptions: ["MiniMax-01", "m2.7", "m3"],
  defaultEndpoint: "https://api.minimax.com/v1/text/chat/completion",
  defaultTimeoutSeconds: 15,
};
```

如果 `accessPassHash` 留白，會關閉登入門檻。

## 注意

- 部分瀏覽器可能拒絕對 MiniMax API 的 CORS 呼叫；若 AI 查詢/測試按鈕顯示「查詢失敗」，可改走自建後端 Proxy，或改為純本機辭典模式。

