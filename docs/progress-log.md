# Lark TODO Bot 開發進度記錄

> 最後更新：2026-03-16

## 專案概述

個人 TODO 管理 Lark Bot，核心功能：TODO 管理、每日提醒、請假偵測與群組通知。

## 架構決策

- **個人 Lark 組織**：App Bot + Bitable（TODO 管理、每日提醒）
- **公司 Lark 群組**：Webhook Bot（請假通知，跨組織發送）
- **原因**：公司 Lark 組織需要管理員審核才能發布 App，個人工具不適合走審核流程
- **審批功能調整**：無法自動建立公司假單，改為 Bot 提醒使用者手動提交

## 已完成

### 程式碼（全部完成，已推送至 GitHub）

- ✅ 專案初始化（TypeScript + Express + Lark SDK）
- ✅ 日期解析工具（支援 M/D、今天、明天、下週X、日期區間）
- ✅ 指令解析器（新增、請假、完成、取消、help 等 12 種指令）
- ✅ Lark SDK 客戶端初始化
- ✅ Message Card 模板（help 表格、TODO 清單、請假通知等）
- ✅ Bitable CRUD 模組
- ✅ 通知模組（私訊 + 群組 + **Webhook 跨組織**）
- ✅ 審批模組（改為提醒模式）
- ✅ Config 儲存模組（Bitable 設定表 + 啟動自動 seed）
- ✅ 每日提醒排程（09:00）
- ✅ 請假群組通知排程（10:00，支援 Webhook）
- ✅ Bot 指令路由（所有指令處理器）
- ✅ 卡片互動處理（假別選擇、確認/延後）
- ✅ Express 入口點
- ✅ Render 部署設定
- ✅ 32 個單元測試全部通過
- ✅ Code review 完成，Critical/Important issues 已修正

### GitHub Repo

https://github.com/ooxxTaiwan/lark-tools

### 文件

- `docs/superpowers/specs/2026-03-16-lark-todo-bot-design.md` — 設計規格
- `docs/superpowers/plans/2026-03-16-lark-todo-bot.md` — 實作計畫
- `docs/deployment-guide.md` — 部署指南

## 公司 Lark App（已棄用）

以下憑證屬於公司組織的 App，因需要審核已放棄使用：
- App ID: `cli_a93d162e8be4de15`
- 其他憑證已取得但不再使用

## 待完成

### 階段 A：建立個人 Lark 組織（你需要手動操作）

1. [ ] 用個人信箱到 https://www.larksuite.com/ 註冊新帳號
2. [ ] 建立個人組織
3. [ ] 進入開發者後台 https://open.larksuite.com/ 建立新 App
4. [ ] 啟用 Bot 功能
5. [ ] 開通權限：bitable:app、im:message:send_as_bot、contact:user.base:readonly
6. [ ] 記下：App ID、App Secret、Verification Token、Encrypt Key
7. [ ] 發布 App（你是管理員，可以直接發布）

### 階段 B：建立 Bitable 表格（個人組織內）

1. [ ] 在個人組織中建立多維表格
2. [ ] 建 TODO 表（12 欄位）和 Config 表（5 欄位）
3. [ ] 記下：Bitable App Token、TODO Table ID、Config Table ID
4. [ ] 欄位規格見 `docs/deployment-guide.md` 階段 2

### 階段 C：公司群組 Webhook

1. [ ] 在公司 Lark 中，打開要通知的群組
2. [ ] 群組設定 → 群機器人 → 添加 → 自定義機器人 (Webhook)
3. [ ] 記下 Webhook URL

### 階段 D：部署到 Render

1. [ ] 前往 https://render.com/ 建立帳號
2. [ ] 新增 Web Service，連結 GitHub repo ooxxTaiwan/lark-tools
3. [ ] 設定環境變數（所有值來自階段 A/B/C）
4. [ ] 部署，記下 Render 公網 URL

### 階段 E：完成 Lark 設定

1. [ ] 回到個人組織的 Lark App，設定事件訂閱 Webhook URL
   - 事件回調：`https://[render-url]/webhook/event`
   - 卡片回調：`https://[render-url]/webhook/card`
2. [ ] 訂閱事件：`im.message.receive_v1`
3. [ ] 設定 UptimeRobot 每 5 分鐘 ping `https://[render-url]/health`

### 階段 F：測試

1. [ ] 在個人組織 Lark 中找到 Bot，發送 `?` 測試
2. [ ] 測試 `新增 明天 測試項目`
3. [ ] 測試 `請假 後天 測試請假`，確認公司群組收到 Webhook 通知

## 需要提供給 Claude 的資訊（下次繼續時）

回到這個專案時，把以下值準備好：

```
# 個人組織 App
LARK_APP_ID=
LARK_APP_SECRET=
LARK_VERIFICATION_TOKEN=
LARK_ENCRYPT_KEY=

# Bitable（個人組織）
BITABLE_APP_TOKEN=
BITABLE_TODO_TABLE_ID=
BITABLE_CONFIG_TABLE_ID=

# 你的個人組織 User ID
DEFAULT_USER_ID=

# 公司群組 Webhook
COMPANY_WEBHOOK_URL=

# 群組通知中顯示的你的名字
NOTIFY_USER_NAME=
```
