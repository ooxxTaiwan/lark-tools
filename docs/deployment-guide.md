# Lark TODO Bot 部署指南

## 總覽

部署分為 5 個階段，依序執行：

1. 建立 Lark App（取得 App ID / Secret）
2. 建立 Bitable 表格（取得 Table ID）
3. 推送到 GitHub
4. 部署到 Render（取得公網 URL）
5. 回到 Lark 設定 Webhook URL + UptimeRobot 保活

---

## 階段 1：建立 Lark App

### 1.1 進入 Lark 開發者後台

1. 開啟 https://open.larksuite.com/
2. 登入你的 Lark 帳號
3. 點擊「建立企業自建應用」

### 1.2 填寫應用資訊

- **應用名稱：** `TODO Bot`（或你喜歡的名字）
- **應用描述：** `個人 TODO 管理與自動請假通知`
- 建立後會進入應用管理頁面

### 1.3 記下關鍵資訊

在應用的「憑證與基礎資訊」頁面，記下：
- **App ID** → 填入 `LARK_APP_ID`
- **App Secret** → 填入 `LARK_APP_SECRET`

### 1.4 啟用 Bot 功能

1. 左側選單 →「添加應用能力」→「機器人」
2. 啟用機器人功能

### 1.5 設定權限

1. 左側選單 →「權限管理」
2. 搜尋並開通以下權限：

| 權限名稱 | 權限 ID |
|----------|---------|
| 讀取多維表格記錄 | `bitable:record:read` |
| 寫入多維表格記錄 | `bitable:record:write` |
| 以應用身份發送消息 | `im:message:send` |
| 建立審批實例 | `approval:instance:create` |
| 讀取審批實例 | `approval:instance:read` |
| 讀取使用者 ID | `contact:user.id:readonly` |

### 1.6 設定事件訂閱（先記下，Webhook URL 在階段 4 取得後回來填）

1. 左側選單 →「事件訂閱」
2. 記下頁面上的：
   - **Verification Token** → 填入 `LARK_VERIFICATION_TOKEN`
   - **Encrypt Key**（如果有的話）→ 填入 `LARK_ENCRYPT_KEY`
3. 訂閱事件（Webhook URL 稍後再填）：
   - `im.message.receive_v1`（接收消息）
   - `approval.instance.status_changed`（審批狀態變更，在「審批」分類下）

### 1.7 取得你的 User ID

1. 使用 API 調試台 https://open.larksuite.com/api-explorer/
2. 呼叫 `GET /open-apis/authen/v1/user_info`
3. 記下你的 `user_id` → 填入 `DEFAULT_USER_ID`

### 1.8 取得請假審批表代碼

1. 進入 Lark 管理後台 →「審批」
2. 找到公司的「請假」審批表
3. 記下該審批表的 `approval_code` → 填入 `DEFAULT_APPROVAL_CODE`

> 如果你不確定怎麼找到 approval_code，可以暫時留空，先部署其他功能。

---

## 階段 2：建立 Bitable 表格

### 2.1 建立多維表格

1. 在 Lark 中建立一個新的「多維表格」文件
2. 命名為「TODO Bot 資料」
3. 記下 URL 中的 App Token：
   - 網址格式：`https://xxx.larksuite.com/base/[APP_TOKEN]`
   - `APP_TOKEN` → 填入 `BITABLE_APP_TOKEN`

### 2.2 建立 TODO 主表

重命名預設的第一張表為「TODO」，然後新增以下欄位：

| 欄位名稱 | 類型 | 設定 |
|----------|------|------|
| `id` | 自動編號 | 預設即可 |
| `date` | 日期 | |
| `content` | 多行文字 | |
| `is_leave` | 核取方塊 | |
| `leave_reason` | 多行文字 | |
| `leave_type` | 單選 | 選項：事假、病假、特休、其他 |
| `leave_group_id` | 多行文字 | |
| `approval_status` | 單選 | 選項：未建立、已送出、已通過、已拒絕 |
| `approval_id` | 多行文字 | |
| `notified` | 核取方塊 | |
| `status` | 單選 | 選項：待辦、完成、取消 |
| `created_at` | 日期 | 包含時間 |

記下此表的 Table ID（在 URL 中可找到，或透過 API 查詢）→ 填入 `BITABLE_TODO_TABLE_ID`

### 2.3 建立 Config 設定表

在同一個多維表格中新增一張表，命名為「Config」，新增以下欄位：

| 欄位名稱 | 類型 |
|----------|------|
| `user_id` | 多行文字 |
| `notify_group_id` | 多行文字 |
| `morning_remind_time` | 多行文字 |
| `notify_days_before` | 數字 |
| `approval_code` | 多行文字 |

記下此表的 Table ID → 填入 `BITABLE_CONFIG_TABLE_ID`

> **如何找到 Table ID：**
> 點擊表格標籤，URL 會變成 `...base/[APP_TOKEN]?table=[TABLE_ID]`
> `TABLE_ID` 就是你要的值。

---

## 階段 3：推送到 GitHub

（這步我可以幫你自動化，見下方）

---

## 階段 4：部署到 Render

### 4.1 前往 Render

1. 開啟 https://render.com/
2. 註冊或登入（可用 GitHub 帳號登入）
3. 點擊「New」→「Web Service」
4. 連結你的 GitHub repo（`lark-tools`）

### 4.2 設定服務

- **Name:** `lark-todo-bot`
- **Runtime:** `Node`
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`
- **Plan:** `Free`

### 4.3 設定環境變數

在 Render 的 Environment 頁面，填入以下變數（值來自階段 1 和 2）：

| Key | Value |
|-----|-------|
| `LARK_APP_ID` | （從 1.3 取得） |
| `LARK_APP_SECRET` | （從 1.3 取得） |
| `LARK_VERIFICATION_TOKEN` | （從 1.6 取得） |
| `LARK_ENCRYPT_KEY` | （從 1.6 取得，可留空） |
| `BITABLE_APP_TOKEN` | （從 2.1 取得） |
| `BITABLE_TODO_TABLE_ID` | （從 2.2 取得） |
| `BITABLE_CONFIG_TABLE_ID` | （從 2.3 取得） |
| `DEFAULT_USER_ID` | （從 1.7 取得） |
| `DEFAULT_NOTIFY_GROUP_ID` | （可先留空，稍後用指令設定） |
| `DEFAULT_APPROVAL_CODE` | （從 1.8 取得，可留空） |
| `TZ` | `Asia/Taipei` |
| `NODE_ENV` | `production` |

### 4.4 部署

點擊「Create Web Service」，等待部署完成。
記下 Render 提供的 URL，例如 `https://lark-todo-bot-xxxx.onrender.com`

---

## 階段 5：完成設定

### 5.1 回到 Lark 設定 Webhook URL

1. 回到 Lark 開發者後台 → 你的應用 →「事件訂閱」
2. 填入 Request URL：
   - **事件回調：** `https://[你的render網址]/webhook/event`
   - **卡片回調：** `https://[你的render網址]/webhook/card`
3. 點擊驗證（Lark 會發送 challenge 請求，你的服務會自動回應）

### 5.2 發布應用

1. 左側選單 →「版本管理與發布」
2. 建立版本並提交審核（或自行發布，視你的 Lark 租戶設定而定）
3. 審核通過後，在 Lark 搜尋你的 Bot 名稱即可開始對話

### 5.3 設定 UptimeRobot 保活

1. 前往 https://uptimerobot.com/ 註冊免費帳號
2. 新增 Monitor：
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** `Lark TODO Bot`
   - **URL:** `https://[你的render網址]/health`
   - **Monitoring Interval:** `5 minutes`
3. 建立完成

### 5.4 測試

1. 在 Lark 中找到你的 Bot，發送 `?` 或 `help`
2. 應該會收到指令說明卡片
3. 試試 `新增 明天 測試項目`
4. 再試 `今天` 查看清單

---

## 環境變數速查表

```
LARK_APP_ID=cli_xxxxxxxxxx
LARK_APP_SECRET=xxxxxxxxxx
LARK_VERIFICATION_TOKEN=xxxxxxxxxx
LARK_ENCRYPT_KEY=
BITABLE_APP_TOKEN=xxxxxxxxxx
BITABLE_TODO_TABLE_ID=tblxxxxxxxxxx
BITABLE_CONFIG_TABLE_ID=tblxxxxxxxxxx
DEFAULT_USER_ID=xxxxxxxxxx
DEFAULT_NOTIFY_GROUP_ID=
DEFAULT_APPROVAL_CODE=
TZ=Asia/Taipei
PORT=3000
```
