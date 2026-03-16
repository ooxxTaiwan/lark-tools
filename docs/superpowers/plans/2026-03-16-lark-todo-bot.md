# Lark TODO Bot Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Lark Bot that manages personal TODOs via Bitable, auto-creates leave approval instances, sends leave notifications to groups, and delivers daily TODO reminders.

**Architecture:** Express HTTP server receives Lark webhook events. Bot commands are parsed and routed to modules that interact with Bitable (data), Approval API (leave requests), and IM API (notifications). node-cron handles scheduled tasks. CardActionHandler processes interactive card button clicks.

**Tech Stack:** TypeScript, Node.js, Express, @larksuiteoapi/node-sdk, node-cron

**Spec:** `docs/superpowers/specs/2026-03-16-lark-todo-bot-design.md`

---

## File Structure

```
lark-tools/
├── src/
│   ├── index.ts              # Entry point: Express server + cron setup + config init
│   ├── config.ts             # Environment variables with validation
│   ├── lark/
│   │   ├── client.ts         # Lark SDK Client + EventDispatcher + CardActionHandler init
│   │   ├── bot.ts            # Bot command router: parse message → dispatch to handler
│   │   └── cards.ts          # Message Card JSON builders (help, todo list, leave notice, etc.)
│   ├── modules/
│   │   ├── todo.ts           # Bitable CRUD: create/read/update TODO records
│   │   ├── approval.ts       # Create approval instance, handle status callback
│   │   ├── notify.ts         # Send private message / group message via IM API
│   │   └── config-store.ts   # Config Bitable table read/write + startup seed
│   ├── scheduler/
│   │   ├── daily-remind.ts   # 09:00 cron: query today's TODOs + upcoming leave → private message
│   │   └── leave-notify.ts   # 10:00 cron: query day-after-tomorrow leave → group notify
│   └── utils/
│       ├── date.ts           # Date parsing: M/D, 今天, 明天, 下週一, M/D~M/D ranges
│       └── parser.ts         # Command parsing: extract command name, date, content
├── tests/
│   ├── utils/
│   │   ├── date.test.ts      # Date parsing unit tests
│   │   └── parser.test.ts    # Command parsing unit tests
│   └── lark/
│       └── cards.test.ts     # Card builder unit tests
├── vitest.config.ts           # Vitest configuration
├── package.json
├── tsconfig.json
├── .env.example              # Example environment variables
├── .gitignore
└── render.yaml               # Render deployment config
```

---

## Chunk 1: Project Setup & Utilities

### Task 1: Project Initialization

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Initialize git repo**

```bash
cd /c/Code/KR/lark-tools
git init
```

- [ ] **Step 2: Initialize npm project and install dependencies**

```bash
npm init -y
npm install @larksuiteoapi/node-sdk express node-cron dotenv uuid
npm install -D typescript @types/node @types/express @types/node-cron @types/uuid vitest
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
.env
*.js.map
```

- [ ] **Step 5: Create .env.example**

```
LARK_APP_ID=
LARK_APP_SECRET=
LARK_VERIFICATION_TOKEN=
LARK_ENCRYPT_KEY=
BITABLE_APP_TOKEN=
BITABLE_TODO_TABLE_ID=
BITABLE_CONFIG_TABLE_ID=
DEFAULT_USER_ID=
DEFAULT_NOTIFY_GROUP_ID=
DEFAULT_APPROVAL_CODE=
TZ=Asia/Taipei
PORT=3000
```

- [ ] **Step 6: Add build and start scripts to package.json**

Add to `package.json` scripts:
```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "npx tsx --watch src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 7: Create vitest.config.ts**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: '.',
  },
});
```

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore .env.example vitest.config.ts
git commit -m "chore: initialize project with TypeScript, Express, Lark SDK"
```

---

### Task 2: Config Module

**Files:**
- Create: `src/config.ts`

- [ ] **Step 1: Write config.ts with environment variable loading and validation**

```typescript
// src/config.ts
import dotenv from 'dotenv';
dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

export const config = {
  lark: {
    appId: requireEnv('LARK_APP_ID'),
    appSecret: requireEnv('LARK_APP_SECRET'),
    verificationToken: optionalEnv('LARK_VERIFICATION_TOKEN', ''),
    encryptKey: optionalEnv('LARK_ENCRYPT_KEY', ''),
  },
  bitable: {
    appToken: requireEnv('BITABLE_APP_TOKEN'),
    todoTableId: requireEnv('BITABLE_TODO_TABLE_ID'),
    configTableId: requireEnv('BITABLE_CONFIG_TABLE_ID'),
  },
  defaults: {
    userId: requireEnv('DEFAULT_USER_ID'),
    notifyGroupId: optionalEnv('DEFAULT_NOTIFY_GROUP_ID', ''),
    approvalCode: optionalEnv('DEFAULT_APPROVAL_CODE', ''),
  },
  port: parseInt(optionalEnv('PORT', '3000'), 10),
};
```

- [ ] **Step 2: Commit**

```bash
git add src/config.ts
git commit -m "feat: add config module with env var loading"
```

---

### Task 3: Date Parsing Utility

**Files:**
- Create: `src/utils/date.ts`
- Create: `tests/utils/date.test.ts`

- [ ] **Step 1: Write the failing tests for date parsing**

```typescript
// tests/utils/date.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseDate, parseDateRange } from '../../src/utils/date';

describe('parseDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-16T10:00:00+08:00'));
  });

  it('parses M/D format', () => {
    expect(parseDate('3/20')).toEqual(new Date(2026, 2, 20));
  });

  it('parses M月D日 format', () => {
    expect(parseDate('3月20日')).toEqual(new Date(2026, 2, 20));
  });

  it('parses YYYY/M/D format', () => {
    expect(parseDate('2026/3/20')).toEqual(new Date(2026, 2, 20));
  });

  it('parses 今天', () => {
    expect(parseDate('今天')).toEqual(new Date(2026, 2, 16));
  });

  it('parses 明天', () => {
    expect(parseDate('明天')).toEqual(new Date(2026, 2, 17));
  });

  it('parses 後天', () => {
    expect(parseDate('後天')).toEqual(new Date(2026, 2, 18));
  });

  it('parses 下週一 (2026-03-16 is Monday, so 下週一 = 2026-03-23)', () => {
    expect(parseDate('下週一')).toEqual(new Date(2026, 2, 23));
  });

  it('parses 下週日', () => {
    expect(parseDate('下週日')).toEqual(new Date(2026, 2, 29));
  });

  it('rolls to next year if date has passed', () => {
    expect(parseDate('1/1')).toEqual(new Date(2027, 0, 1));
  });

  it('returns null for invalid input', () => {
    expect(parseDate('abc')).toBeNull();
  });
});

describe('parseDateRange', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-16T10:00:00+08:00'));
  });

  it('parses M/D~M/D range', () => {
    const result = parseDateRange('3/21~3/23');
    expect(result).toEqual([
      new Date(2026, 2, 21),
      new Date(2026, 2, 22),
      new Date(2026, 2, 23),
    ]);
  });

  it('returns single-element array for non-range date', () => {
    const result = parseDateRange('3/20');
    expect(result).toEqual([new Date(2026, 2, 20)]);
  });

  it('returns null for invalid input', () => {
    expect(parseDateRange('abc')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/utils/date.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement date parsing**

```typescript
// src/utils/date.ts

const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return startOfDay(result);
}

export function parseDate(input: string): Date | null {
  const trimmed = input.trim();
  const now = new Date();
  const today = startOfDay(now);

  // 今天 / 明天 / 後天
  if (trimmed === '今天') return today;
  if (trimmed === '明天') return addDays(today, 1);
  if (trimmed === '後天') return addDays(today, 2);

  // 下週X
  const weekdayMatch = trimmed.match(/^下週([一二三四五六日])$/);
  if (weekdayMatch) {
    const targetDay = DAY_NAMES.indexOf(weekdayMatch[1]);
    const currentDay = today.getDay(); // 0=Sun
    // 下週X = next week's day X
    const daysUntilNextMonday = (8 - currentDay) % 7 || 7;
    const nextMonday = addDays(today, daysUntilNextMonday);
    const targetOffset = targetDay === 0 ? 6 : targetDay - 1; // Mon=0, Sun=6
    return addDays(nextMonday, targetOffset);
  }

  // YYYY/M/D
  const fullMatch = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (fullMatch) {
    const [, y, m, d] = fullMatch;
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  }

  // M/D
  const shortMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (shortMatch) {
    const [, m, d] = shortMatch;
    let date = new Date(today.getFullYear(), parseInt(m) - 1, parseInt(d));
    if (date < today) {
      date = new Date(today.getFullYear() + 1, parseInt(m) - 1, parseInt(d));
    }
    return date;
  }

  // M月D日
  const cnMatch = trimmed.match(/^(\d{1,2})月(\d{1,2})日$/);
  if (cnMatch) {
    const [, m, d] = cnMatch;
    let date = new Date(today.getFullYear(), parseInt(m) - 1, parseInt(d));
    if (date < today) {
      date = new Date(today.getFullYear() + 1, parseInt(m) - 1, parseInt(d));
    }
    return date;
  }

  return null;
}

export function parseDateRange(input: string): Date[] | null {
  const trimmed = input.trim();

  // M/D~M/D range
  const rangeMatch = trimmed.match(/^(.+)~(.+)$/);
  if (rangeMatch) {
    const start = parseDate(rangeMatch[1]);
    const end = parseDate(rangeMatch[2]);
    if (!start || !end || end < start) return null;

    const dates: Date[] = [];
    const current = new Date(start);
    while (current <= end) {
      dates.push(startOfDay(new Date(current)));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  // Single date
  const single = parseDate(trimmed);
  if (single) return [single];

  return null;
}

export function formatDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function formatDateWithWeekday(d: Date): string {
  const weekday = DAY_NAMES[d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()}（${weekday}）`;
}

export function isToday(d: Date): boolean {
  const today = startOfDay(new Date());
  return startOfDay(d).getTime() === today.getTime();
}

export function isTomorrow(d: Date): boolean {
  return startOfDay(d).getTime() === addDays(startOfDay(new Date()), 1).getTime();
}

export function isDayAfterTomorrow(d: Date): boolean {
  return startOfDay(d).getTime() === addDays(startOfDay(new Date()), 2).getTime();
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/utils/date.test.ts
```
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/date.ts tests/utils/date.test.ts
git commit -m "feat: add date parsing utility with range support"
```

---

### Task 4: Command Parser Utility

**Files:**
- Create: `src/utils/parser.ts`
- Create: `tests/utils/parser.test.ts`

- [ ] **Step 1: Write the failing tests for command parsing**

```typescript
// tests/utils/parser.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseCommand, CommandType } from '../../src/utils/parser';

describe('parseCommand', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-16T10:00:00+08:00'));
  });

  it('parses 新增 command', () => {
    const result = parseCommand('新增 3/20 準備週會簡報');
    expect(result).toEqual({
      type: CommandType.ADD,
      date: '3/20',
      content: '準備週會簡報',
      isLeave: false,
    });
  });

  it('parses 請假 command', () => {
    const result = parseCommand('請假 3/21 家中有事');
    expect(result).toEqual({
      type: CommandType.LEAVE,
      date: '3/21',
      content: '家中有事',
      isLeave: true,
    });
  });

  it('parses 新增 with 請假 keyword detection', () => {
    const result = parseCommand('新增 3/25 請假 搬家');
    expect(result).toEqual({
      type: CommandType.ADD,
      date: '3/25',
      content: '請假 搬家',
      isLeave: true,
    });
  });

  it('parses 今天 command', () => {
    const result = parseCommand('今天');
    expect(result).toEqual({ type: CommandType.TODAY });
  });

  it('parses 本週 command', () => {
    const result = parseCommand('本週');
    expect(result).toEqual({ type: CommandType.THIS_WEEK });
  });

  it('parses 完成 command', () => {
    const result = parseCommand('完成 3');
    expect(result).toEqual({ type: CommandType.COMPLETE, id: 3 });
  });

  it('parses 取消 command', () => {
    const result = parseCommand('取消 5');
    expect(result).toEqual({ type: CommandType.CANCEL, id: 5 });
  });

  it('parses 建立假單 command', () => {
    const result = parseCommand('建立假單 7');
    expect(result).toEqual({ type: CommandType.CREATE_APPROVAL, id: 7 });
  });

  it('parses help command', () => {
    expect(parseCommand('help')).toEqual({ type: CommandType.HELP });
    expect(parseCommand('?')).toEqual({ type: CommandType.HELP });
    expect(parseCommand('幫助')).toEqual({ type: CommandType.HELP });
  });

  it('parses 設定群組 command', () => {
    const result = parseCommand('設定群組');
    expect(result).toEqual({ type: CommandType.SET_GROUP });
  });

  it('parses 綁定通知 command', () => {
    const result = parseCommand('綁定通知');
    expect(result).toEqual({ type: CommandType.BIND_GROUP });
  });

  it('parses 設定提醒 command', () => {
    const result = parseCommand('設定提醒 08:30');
    expect(result).toEqual({ type: CommandType.SET_REMIND, time: '08:30' });
  });

  it('parses 請假 with date range', () => {
    const result = parseCommand('請假 3/21~3/23 搬家');
    expect(result).toEqual({
      type: CommandType.LEAVE,
      date: '3/21~3/23',
      content: '搬家',
      isLeave: true,
    });
  });

  it('returns UNKNOWN for unrecognized input', () => {
    const result = parseCommand('隨便說說');
    expect(result).toEqual({ type: CommandType.UNKNOWN });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/utils/parser.test.ts
```
Expected: FAIL

- [ ] **Step 3: Implement command parser**

```typescript
// src/utils/parser.ts

export enum CommandType {
  ADD = 'ADD',
  LEAVE = 'LEAVE',
  TODAY = 'TODAY',
  THIS_WEEK = 'THIS_WEEK',
  COMPLETE = 'COMPLETE',
  CANCEL = 'CANCEL',
  CREATE_APPROVAL = 'CREATE_APPROVAL',
  HELP = 'HELP',
  SET_GROUP = 'SET_GROUP',
  BIND_GROUP = 'BIND_GROUP',
  SET_REMIND = 'SET_REMIND',
  UNKNOWN = 'UNKNOWN',
}

export type ParsedCommand =
  | { type: CommandType.ADD; date: string; content: string; isLeave: boolean }
  | { type: CommandType.LEAVE; date: string; content: string; isLeave: true }
  | { type: CommandType.TODAY }
  | { type: CommandType.THIS_WEEK }
  | { type: CommandType.COMPLETE; id: number }
  | { type: CommandType.CANCEL; id: number }
  | { type: CommandType.CREATE_APPROVAL; id: number }
  | { type: CommandType.HELP }
  | { type: CommandType.SET_GROUP }
  | { type: CommandType.BIND_GROUP }
  | { type: CommandType.SET_REMIND; time: string }
  | { type: CommandType.UNKNOWN };

export function parseCommand(text: string): ParsedCommand {
  const trimmed = text.trim();

  // help / ? / 幫助
  if (/^(help|\?|幫助)$/i.test(trimmed)) {
    return { type: CommandType.HELP };
  }

  // 今天
  if (trimmed === '今天') {
    return { type: CommandType.TODAY };
  }

  // 本週
  if (trimmed === '本週') {
    return { type: CommandType.THIS_WEEK };
  }

  // 設定群組
  if (trimmed === '設定群組') {
    return { type: CommandType.SET_GROUP };
  }

  // 綁定通知
  if (trimmed === '綁定通知') {
    return { type: CommandType.BIND_GROUP };
  }

  // 完成 <id>
  const completeMatch = trimmed.match(/^完成\s+(\d+)$/);
  if (completeMatch) {
    return { type: CommandType.COMPLETE, id: parseInt(completeMatch[1]) };
  }

  // 取消 <id>
  const cancelMatch = trimmed.match(/^取消\s+(\d+)$/);
  if (cancelMatch) {
    return { type: CommandType.CANCEL, id: parseInt(cancelMatch[1]) };
  }

  // 建立假單 <id>
  const approvalMatch = trimmed.match(/^建立假單\s+(\d+)$/);
  if (approvalMatch) {
    return { type: CommandType.CREATE_APPROVAL, id: parseInt(approvalMatch[1]) };
  }

  // 設定提醒 <time>
  const remindMatch = trimmed.match(/^設定提醒\s+(\d{1,2}:\d{2})$/);
  if (remindMatch) {
    return { type: CommandType.SET_REMIND, time: remindMatch[1] };
  }

  // 請假 <date> <reason>
  const leaveMatch = trimmed.match(/^請假\s+(\S+)\s+(.+)$/);
  if (leaveMatch) {
    return {
      type: CommandType.LEAVE,
      date: leaveMatch[1],
      content: leaveMatch[2],
      isLeave: true,
    };
  }

  // 新增 <date> <content>
  const addMatch = trimmed.match(/^新增\s+(\S+)\s+(.+)$/);
  if (addMatch) {
    const content = addMatch[2];
    const isLeave = content.includes('請假');
    return {
      type: CommandType.ADD,
      date: addMatch[1],
      content,
      isLeave,
    };
  }

  return { type: CommandType.UNKNOWN };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/utils/parser.test.ts
```
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/parser.ts tests/utils/parser.test.ts
git commit -m "feat: add command parser with leave detection"
```

---

## Chunk 2: Lark Client & Message Cards

### Task 5: Lark Client Initialization

**Files:**
- Create: `src/lark/client.ts`

- [ ] **Step 1: Create Lark client with EventDispatcher and CardActionHandler**

```typescript
// src/lark/client.ts
import * as lark from '@larksuiteoapi/node-sdk';
import { config } from '../config';

export const client = new lark.Client({
  appId: config.lark.appId,
  appSecret: config.lark.appSecret,
});

export const eventDispatcher = new lark.EventDispatcher({
  encryptKey: config.lark.encryptKey,
  verificationToken: config.lark.verificationToken,
});

export const cardActionHandler = new lark.CardActionHandler(
  {
    encryptKey: config.lark.encryptKey,
    verificationToken: config.lark.verificationToken,
  },
  async (data) => {
    // Will be implemented in bot.ts
    // This is a placeholder — actual handling is registered later
    return {};
  }
);
```

- [ ] **Step 2: Commit**

```bash
git add src/lark/client.ts
git commit -m "feat: add Lark SDK client initialization"
```

---

### Task 6: Message Card Builders

**Files:**
- Create: `src/lark/cards.ts`
- Create: `tests/lark/cards.test.ts`

- [ ] **Step 1: Write failing tests for card builders**

```typescript
// tests/lark/cards.test.ts
import { describe, it, expect } from 'vitest';
import {
  buildHelpCard,
  buildTodoListCard,
  buildLeaveTypeCard,
  buildLeaveConfirmCard,
  buildLeaveNotifyCard,
} from '../../src/lark/cards';

describe('buildHelpCard', () => {
  it('returns valid card JSON string', () => {
    const card = buildHelpCard();
    const parsed = JSON.parse(card);
    expect(parsed.header.title.content).toContain('指令說明');
  });
});

describe('buildTodoListCard', () => {
  it('builds card with todo items', () => {
    const todos = [
      { id: 1, content: '準備週會', date: '3/20', isLeave: false },
      { id: 2, content: '家中有事', date: '3/21', isLeave: true, leaveType: '事假' },
    ];
    const card = buildTodoListCard('3/20', todos);
    const parsed = JSON.parse(card);
    expect(parsed.header.title.content).toContain('3/20');
  });
});

describe('buildLeaveTypeCard', () => {
  it('builds card with leave type buttons', () => {
    const card = buildLeaveTypeCard('3/21', '家中有事', 'record_123');
    const parsed = JSON.parse(card);
    expect(parsed.elements).toBeDefined();
  });
});

describe('buildLeaveConfirmCard', () => {
  it('builds card with confirm/defer buttons', () => {
    const card = buildLeaveConfirmCard('3/21', '事假', '家中有事', 'record_123');
    const parsed = JSON.parse(card);
    expect(parsed.elements).toBeDefined();
  });
});

describe('buildLeaveNotifyCard', () => {
  it('builds group notification card', () => {
    const card = buildLeaveNotifyCard('Jay', '3/21（五）', 1, '家中有事');
    const parsed = JSON.parse(card);
    expect(parsed.header.title.content).toContain('請假通知');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/lark/cards.test.ts
```
Expected: FAIL

- [ ] **Step 3: Implement card builders**

```typescript
// src/lark/cards.ts

interface TodoItem {
  id: number;
  content: string;
  date: string;
  isLeave: boolean;
  leaveType?: string;
}

export function buildHelpCard(): string {
  return JSON.stringify({
    header: {
      template: 'blue',
      title: { content: '📖 指令說明', tag: 'plain_text' },
    },
    elements: [
      {
        tag: 'markdown',
        content: [
          '| 指令 | 說明 | 範例 |',
          '| --- | --- | --- |',
          '| 新增 <日期> <內容> | 新增工作項目 | 新增 3/20 準備週會簡報 |',
          '| 請假 <日期> <事由> | 新增請假並建立假單 | 請假 3/21 家中有事 |',
          '| 今天 | 查看今天的工作項目 | 今天 |',
          '| 本週 | 查看本週的工作項目 | 本週 |',
          '| 完成 <id> | 標記項目完成 | 完成 3 |',
          '| 取消 <id> | 取消項目 | 取消 5 |',
          '| 建立假單 <id> | 補建請假審批單 | 建立假單 7 |',
          '| 設定群組 | 設定請假通知群組 | |',
          '| 設定提醒 <時間> | 設定每日提醒時間 | 設定提醒 08:30 |',
          '| help / ? / 幫助 | 顯示此說明 | |',
        ].join('\n'),
      },
    ],
  });
}

export function buildTodoListCard(dateLabel: string, todos: TodoItem[]): string {
  const lines = todos.map((t, i) => {
    const prefix = t.isLeave ? `🏖️ [${t.leaveType || '請假'}]` : `${i + 1}.`;
    return `${prefix} #${t.id} ${t.content}`;
  });

  return JSON.stringify({
    header: {
      template: 'blue',
      title: { content: `📋 ${dateLabel} 的工作項目`, tag: 'plain_text' },
    },
    elements: [
      {
        tag: 'markdown',
        content: lines.join('\n'),
      },
    ],
  });
}

export function buildLeaveTypeCard(date: string, reason: string, recordId: string): string {
  const leaveTypes = ['事假', '病假', '特休', '其他'];
  return JSON.stringify({
    header: {
      template: 'orange',
      title: { content: '請選擇假別', tag: 'plain_text' },
    },
    elements: [
      {
        tag: 'markdown',
        content: `日期：${date}\n事由：${reason}`,
      },
      {
        tag: 'action',
        actions: leaveTypes.map((type) => ({
          tag: 'button',
          text: { tag: 'plain_text', content: type },
          type: 'primary',
          value: JSON.stringify({ action: 'select_leave_type', leaveType: type, recordId }),
        })),
      },
    ],
  });
}

export function buildLeaveConfirmCard(
  date: string,
  leaveType: string,
  reason: string,
  recordId: string
): string {
  return JSON.stringify({
    header: {
      template: 'orange',
      title: { content: '建立請假審批單', tag: 'plain_text' },
    },
    elements: [
      {
        tag: 'markdown',
        content: `日期：${date}\n假別：${leaveType}\n事由：${reason}`,
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '確認送出' },
            type: 'primary',
            value: JSON.stringify({ action: 'confirm_approval', recordId }),
          },
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '稍後再說' },
            type: 'default',
            value: JSON.stringify({ action: 'defer_approval', recordId }),
          },
        ],
      },
    ],
  });
}

export function buildLeaveNotifyCard(
  userName: string,
  dateStr: string,
  days: number,
  reason: string
): string {
  const daysText = days > 1 ? `請假 ${days} 天` : '請假一天';
  return JSON.stringify({
    header: {
      template: 'red',
      title: { content: '📢 請假通知', tag: 'plain_text' },
    },
    elements: [
      {
        tag: 'markdown',
        content: `${userName} 將於 ${dateStr} ${daysText}\n事由：${reason}\n如有需要請提前聯繫 🙏`,
      },
    ],
  });
}

export function buildSuccessCard(message: string): string {
  return JSON.stringify({
    header: {
      template: 'green',
      title: { content: '✅ 成功', tag: 'plain_text' },
    },
    elements: [{ tag: 'markdown', content: message }],
  });
}

export function buildErrorCard(message: string): string {
  return JSON.stringify({
    header: {
      template: 'red',
      title: { content: '❌ 錯誤', tag: 'plain_text' },
    },
    elements: [{ tag: 'markdown', content: message }],
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/lark/cards.test.ts
```
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/lark/cards.ts tests/lark/cards.test.ts
git commit -m "feat: add Message Card builders for help, todo list, leave flow"
```

---

## Chunk 3: Bitable TODO Module

### Task 7: TODO Module (Bitable CRUD)

**Files:**
- Create: `src/modules/todo.ts`

- [ ] **Step 1: Implement Bitable CRUD operations**

```typescript
// src/modules/todo.ts
import { client } from '../lark/client';
import { config } from '../config';

export interface TodoRecord {
  recordId: string;
  id: number;
  date: Date;
  content: string;
  isLeave: boolean;
  leaveReason: string;
  leaveType: string;
  leaveGroupId: string;
  approvalStatus: string;
  approvalId: string;
  notified: boolean;
  status: string;
}

interface BitableFields {
  id?: number;
  date?: number; // timestamp ms
  content?: string;
  is_leave?: boolean;
  leave_reason?: string;
  leave_type?: string;
  leave_group_id?: string;
  approval_status?: string;
  approval_id?: string;
  notified?: boolean;
  status?: string;
  created_at?: number;
}

function toTodoRecord(record: { record_id?: string; fields: BitableFields }): TodoRecord {
  const f = record.fields;
  return {
    recordId: record.record_id || '',
    id: f.id || 0,
    date: f.date ? new Date(f.date) : new Date(),
    content: f.content || '',
    isLeave: f.is_leave || false,
    leaveReason: f.leave_reason || '',
    leaveType: f.leave_type || '',
    leaveGroupId: f.leave_group_id || '',
    approvalStatus: f.approval_status || '未建立',
    approvalId: f.approval_id || '',
    notified: f.notified || false,
    status: f.status || '待辦',
  };
}

export async function createTodo(fields: {
  date: Date;
  content: string;
  isLeave: boolean;
  leaveReason?: string;
  leaveGroupId?: string;
}): Promise<TodoRecord> {
  const res = await client.bitable.appTableRecord.create({
    path: {
      app_token: config.bitable.appToken,
      table_id: config.bitable.todoTableId,
    },
    data: {
      fields: {
        date: fields.date.getTime(),
        content: fields.content,
        is_leave: fields.isLeave,
        leave_reason: fields.leaveReason || '',
        leave_group_id: fields.leaveGroupId || '',
        approval_status: '未建立',
        notified: false,
        status: '待辦',
        created_at: Date.now(),
      },
    },
  });
  return toTodoRecord(res.data?.record as any);
}

export async function getTodosByDate(date: Date): Promise<TodoRecord[]> {
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const endOfDay = startOfDay + 86400000 - 1;

  const res = await client.bitable.appTableRecord.search({
    path: {
      app_token: config.bitable.appToken,
      table_id: config.bitable.todoTableId,
    },
    data: {
      filter: {
        conjunction: 'and',
        conditions: [
          { field_name: 'date', operator: 'isGreater', value: [String(startOfDay - 1)] },
          { field_name: 'date', operator: 'isLess', value: [String(endOfDay + 1)] },
          { field_name: 'status', operator: 'is', value: ['待辦'] },
        ],
      },
    },
  });

  return (res.data?.items || []).map((r: any) => toTodoRecord(r));
}

export async function getTodosByDateRange(start: Date, end: Date): Promise<TodoRecord[]> {
  const startTs = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const endTs = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime() + 86400000 - 1;

  const res = await client.bitable.appTableRecord.search({
    path: {
      app_token: config.bitable.appToken,
      table_id: config.bitable.todoTableId,
    },
    data: {
      filter: {
        conjunction: 'and',
        conditions: [
          { field_name: 'date', operator: 'isGreater', value: [String(startTs - 1)] },
          { field_name: 'date', operator: 'isLess', value: [String(endTs + 1)] },
          { field_name: 'status', operator: 'is', value: ['待辦'] },
        ],
      },
      sort: [{ field_name: 'date', order: 'asc' }],
    },
  });

  return (res.data?.items || []).map((r: any) => toTodoRecord(r));
}

export async function getLeavesByDate(date: Date): Promise<TodoRecord[]> {
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const endOfDay = startOfDay + 86400000 - 1;

  const res = await client.bitable.appTableRecord.search({
    path: {
      app_token: config.bitable.appToken,
      table_id: config.bitable.todoTableId,
    },
    data: {
      filter: {
        conjunction: 'and',
        conditions: [
          { field_name: 'date', operator: 'isGreater', value: [String(startOfDay - 1)] },
          { field_name: 'date', operator: 'isLess', value: [String(endOfDay + 1)] },
          { field_name: 'is_leave', operator: 'is', value: ['true'] },
          { field_name: 'notified', operator: 'is', value: ['false'] },
        ],
      },
    },
  });

  return (res.data?.items || []).map((r: any) => toTodoRecord(r));
}

export async function updateTodo(
  recordId: string,
  fields: Partial<BitableFields>
): Promise<void> {
  await client.bitable.appTableRecord.update({
    path: {
      app_token: config.bitable.appToken,
      table_id: config.bitable.todoTableId,
      record_id: recordId,
    },
    data: { fields },
  });
}

export async function findTodoById(id: number): Promise<TodoRecord | null> {
  const res = await client.bitable.appTableRecord.search({
    path: {
      app_token: config.bitable.appToken,
      table_id: config.bitable.todoTableId,
    },
    data: {
      filter: {
        conjunction: 'and',
        conditions: [
          { field_name: 'id', operator: 'is', value: [String(id)] },
        ],
      },
    },
  });

  const items = res.data?.items || [];
  if (items.length === 0) return null;
  return toTodoRecord(items[0] as any);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/todo.ts
git commit -m "feat: add TODO module with Bitable CRUD operations"
```

---

### Task 8: Notify Module

**Files:**
- Create: `src/modules/notify.ts`

- [ ] **Step 1: Implement notification module**

```typescript
// src/modules/notify.ts
import { client } from '../lark/client';

export async function sendPrivateMessage(
  userId: string,
  content: string,
  msgType: 'text' | 'interactive' = 'interactive'
): Promise<void> {
  await client.im.message.create({
    params: { receive_id_type: 'user_id' },
    data: {
      receive_id: userId,
      content: msgType === 'text' ? JSON.stringify({ text: content }) : content,
      msg_type: msgType,
    },
  });
}

export async function sendGroupMessage(
  chatId: string,
  content: string,
  msgType: 'text' | 'interactive' = 'interactive'
): Promise<void> {
  await client.im.message.create({
    params: { receive_id_type: 'chat_id' },
    data: {
      receive_id: chatId,
      content: msgType === 'text' ? JSON.stringify({ text: content }) : content,
      msg_type: msgType,
    },
  });
}

export async function replyMessage(
  messageId: string,
  content: string,
  msgType: 'text' | 'interactive' = 'interactive'
): Promise<void> {
  await client.im.message.reply({
    path: { message_id: messageId },
    data: {
      content: msgType === 'text' ? JSON.stringify({ text: content }) : content,
      msg_type: msgType,
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/notify.ts
git commit -m "feat: add notify module for private and group messages"
```

---

### Task 9: Config Store Module

**Files:**
- Create: `src/modules/config-store.ts`

- [ ] **Step 1: Implement config store with startup seed logic**

```typescript
// src/modules/config-store.ts
import { client } from '../lark/client';
import { config } from '../config';

interface ConfigRecord {
  recordId: string;
  userId: string;
  notifyGroupId: string;
  morningRemindTime: string;
  notifyDaysBefore: number;
  approvalCode: string;
}

export async function loadOrSeedConfig(): Promise<ConfigRecord> {
  const res = await client.bitable.appTableRecord.search({
    path: {
      app_token: config.bitable.appToken,
      table_id: config.bitable.configTableId,
    },
    data: {},
  });

  const items = res.data?.items || [];

  if (items.length > 0) {
    const fields = (items[0] as any).fields;
    // Sync runtime config with Bitable values
    if (fields.notify_group_id) config.defaults.notifyGroupId = fields.notify_group_id;
    if (fields.approval_code) config.defaults.approvalCode = fields.approval_code;
    return {
      recordId: (items[0] as any).record_id,
      userId: fields.user_id || config.defaults.userId,
      notifyGroupId: fields.notify_group_id || config.defaults.notifyGroupId,
      morningRemindTime: fields.morning_remind_time || '09:00',
      notifyDaysBefore: fields.notify_days_before || 2,
      approvalCode: fields.approval_code || config.defaults.approvalCode,
    };
  }

  // Seed with defaults from env vars
  const seedRes = await client.bitable.appTableRecord.create({
    path: {
      app_token: config.bitable.appToken,
      table_id: config.bitable.configTableId,
    },
    data: {
      fields: {
        user_id: config.defaults.userId,
        notify_group_id: config.defaults.notifyGroupId,
        morning_remind_time: '09:00',
        notify_days_before: 2,
        approval_code: config.defaults.approvalCode,
      },
    },
  });

  return {
    recordId: (seedRes.data?.record as any)?.record_id || '',
    userId: config.defaults.userId,
    notifyGroupId: config.defaults.notifyGroupId,
    morningRemindTime: '09:00',
    notifyDaysBefore: 2,
    approvalCode: config.defaults.approvalCode,
  };
}

export async function updateConfigField(
  field: string,
  value: string | number
): Promise<void> {
  const res = await client.bitable.appTableRecord.search({
    path: {
      app_token: config.bitable.appToken,
      table_id: config.bitable.configTableId,
    },
    data: {},
  });

  const items = res.data?.items || [];
  if (items.length > 0) {
    await client.bitable.appTableRecord.update({
      path: {
        app_token: config.bitable.appToken,
        table_id: config.bitable.configTableId,
        record_id: (items[0] as any).record_id,
      },
      data: { fields: { [field]: value } },
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/config-store.ts
git commit -m "feat: add config store with Bitable seed logic"
```

---

### Task 10: Approval Module

> **Note:** This task imports `findByApprovalId` from `todo.ts`, which is added in Step 2 below. Complete Step 2 before running type checks on Step 1.

**Files:**
- Create: `src/modules/approval.ts`

- [ ] **Step 1: Implement approval module**

```typescript
// src/modules/approval.ts
import { client } from '../lark/client';
import { config } from '../config';
import { updateTodo, findByApprovalId, TodoRecord } from './todo';
import { sendPrivateMessage } from './notify';
import { buildSuccessCard, buildErrorCard } from '../lark/cards';

export async function createLeaveApproval(
  record: TodoRecord,
  leaveType: string,
  userId: string
): Promise<string> {
  const approvalCode = config.defaults.approvalCode;

  const res = await client.approval.instance.create({
    data: {
      approval_code: approvalCode,
      user_id: userId,
      form: JSON.stringify([
        { id: 'leave_type', type: 'input', value: leaveType },
        { id: 'leave_start', type: 'date', value: record.date.getTime() },
        { id: 'leave_reason', type: 'textarea', value: record.leaveReason },
      ]),
    },
  });

  const instanceCode = res.data?.instance_code || '';

  // Update ALL records with same leave_group_id (for multi-day leave)
  if (record.leaveGroupId) {
    const allRecords = await findByLeaveGroupId(record.leaveGroupId);
    for (const r of allRecords) {
      await updateTodo(r.recordId, {
        approval_status: '已送出',
        approval_id: instanceCode,
        leave_type: leaveType,
      });
    }
  } else {
    await updateTodo(record.recordId, {
      approval_status: '已送出',
      approval_id: instanceCode,
      leave_type: leaveType,
    });
  }

  return instanceCode;
}

export async function handleApprovalStatusChange(
  instanceCode: string,
  status: string
): Promise<void> {
  let approvalStatus = '已送出';
  if (status === 'APPROVED') approvalStatus = '已通過';
  if (status === 'REJECTED') approvalStatus = '已拒絕';

  const records = await findByApprovalId(instanceCode);
  for (const record of records) {
    await updateTodo(record.recordId, { approval_status: approvalStatus });
  }

  // Notify user of approval result
  if (records.length > 0 && approvalStatus !== '已送出') {
    const emoji = approvalStatus === '已通過' ? '✅' : '❌';
    const card = buildSuccessCard(
      `${emoji} 你的請假申請（${records[0].leaveReason}）${approvalStatus}`
    );
    await sendPrivateMessage(config.defaults.userId, card);
  }
}

// Helper: find records by leave_group_id
async function findByLeaveGroupId(leaveGroupId: string): Promise<TodoRecord[]> {
  const res = await client.bitable.appTableRecord.search({
    path: {
      app_token: config.bitable.appToken,
      table_id: config.bitable.todoTableId,
    },
    data: {
      filter: {
        conjunction: 'and',
        conditions: [
          { field_name: 'leave_group_id', operator: 'is', value: [leaveGroupId] },
        ],
      },
    },
  });
  return (res.data?.items || []).map((r: any) => ({
    recordId: r.record_id || '',
    id: r.fields?.id || 0,
    date: r.fields?.date ? new Date(r.fields.date) : new Date(),
    content: r.fields?.content || '',
    isLeave: r.fields?.is_leave || false,
    leaveReason: r.fields?.leave_reason || '',
    leaveType: r.fields?.leave_type || '',
    leaveGroupId: r.fields?.leave_group_id || '',
    approvalStatus: r.fields?.approval_status || '未建立',
    approvalId: r.fields?.approval_id || '',
    notified: r.fields?.notified || false,
    status: r.fields?.status || '待辦',
  }));
}
```

- [ ] **Step 2: Add findByApprovalId to todo.ts**

Append to `src/modules/todo.ts`:

```typescript
export async function findByApprovalId(approvalId: string): Promise<TodoRecord[]> {
  const res = await client.bitable.appTableRecord.search({
    path: {
      app_token: config.bitable.appToken,
      table_id: config.bitable.todoTableId,
    },
    data: {
      filter: {
        conjunction: 'and',
        conditions: [
          { field_name: 'approval_id', operator: 'is', value: [approvalId] },
        ],
      },
    },
  });

  return (res.data?.items || []).map((r: any) => toTodoRecord(r));
}
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/approval.ts src/modules/todo.ts
git commit -m "feat: add approval module and findByApprovalId"
```

---

## Chunk 4: Bot Router & Schedulers

### Task 11: Bot Command Router

**Files:**
- Create: `src/lark/bot.ts`

- [ ] **Step 1: Implement bot command router**

```typescript
// src/lark/bot.ts
import { v4 as uuidv4 } from 'uuid';
import { parseCommand, CommandType } from '../utils/parser';
import { parseDate, parseDateRange, formatDate, formatDateWithWeekday, isToday, isTomorrow, isDayAfterTomorrow } from '../utils/date';
import { createTodo, getTodosByDate, getTodosByDateRange, findTodoById, updateTodo, getLeavesByDate } from '../modules/todo';
import { replyMessage, sendGroupMessage } from '../modules/notify';
import { createLeaveApproval } from '../modules/approval';
import { updateConfigField } from '../modules/config-store';
import { sendLeaveNotification } from '../scheduler/leave-notify';
import { buildHelpCard, buildTodoListCard, buildLeaveTypeCard, buildLeaveConfirmCard, buildSuccessCard, buildErrorCard } from './cards';
import { config } from '../config';

export async function handleMessage(
  messageId: string,
  text: string,
  chatId: string,
  chatType: string
): Promise<void> {
  const cmd = parseCommand(text);

  try {
    switch (cmd.type) {
      case CommandType.HELP:
        await replyMessage(messageId, buildHelpCard());
        break;

      case CommandType.TODAY: {
        const todos = await getTodosByDate(new Date());
        if (todos.length === 0) {
          await replyMessage(messageId, buildSuccessCard('今天沒有待辦項目 🎉'));
        } else {
          const items = todos.map((t) => ({
            id: t.id,
            content: t.content,
            date: formatDate(t.date),
            isLeave: t.isLeave,
            leaveType: t.leaveType,
          }));
          await replyMessage(messageId, buildTodoListCard('今天', items));
        }
        break;
      }

      case CommandType.THIS_WEEK: {
        const now = new Date();
        const day = now.getDay();
        const monday = new Date(now);
        monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        const todos = await getTodosByDateRange(monday, sunday);
        if (todos.length === 0) {
          await replyMessage(messageId, buildSuccessCard('本週沒有待辦項目 🎉'));
        } else {
          const items = todos.map((t) => ({
            id: t.id,
            content: t.content,
            date: formatDate(t.date),
            isLeave: t.isLeave,
            leaveType: t.leaveType,
          }));
          await replyMessage(messageId, buildTodoListCard('本週', items));
        }
        break;
      }

      case CommandType.ADD: {
        const dates = parseDateRange(cmd.date);
        if (!dates) {
          await replyMessage(messageId, buildErrorCard('無法解析日期格式，請參考 help 指令'));
          return;
        }
        const leaveGroupId = cmd.isLeave && dates.length > 1 ? uuidv4() : '';
        const records = [];
        for (const d of dates) {
          const record = await createTodo({
            date: d,
            content: cmd.content,
            isLeave: cmd.isLeave,
            leaveReason: cmd.isLeave ? cmd.content : undefined,
            leaveGroupId,
          });
          records.push(record);
        }
        if (cmd.isLeave) {
          await replyMessage(
            messageId,
            buildLeaveTypeCard(cmd.date, cmd.content, records[0].recordId)
          );
          // Check immediate notification needed
          for (const d of dates) {
            if (isToday(d) || isTomorrow(d)) {
              await sendImmediateLeaveNotification(records);
              break;
            }
          }
        } else {
          await replyMessage(
            messageId,
            buildSuccessCard(`已新增 TODO #${records[0].id}：${formatDate(dates[0])} ${cmd.content}`)
          );
        }
        break;
      }

      case CommandType.LEAVE: {
        const dates = parseDateRange(cmd.date);
        if (!dates) {
          await replyMessage(messageId, buildErrorCard('無法解析日期格式，請參考 help 指令'));
          return;
        }
        const leaveGroupId = dates.length > 1 ? uuidv4() : '';
        const records = [];
        for (const d of dates) {
          const record = await createTodo({
            date: d,
            content: cmd.content,
            isLeave: true,
            leaveReason: cmd.content,
            leaveGroupId,
          });
          records.push(record);
        }
        const dateLabel = dates.length > 1
          ? `${formatDate(dates[0])} ~ ${formatDate(dates[dates.length - 1])}`
          : formatDate(dates[0]);
        await replyMessage(
          messageId,
          buildLeaveTypeCard(dateLabel, cmd.content, records[0].recordId)
        );
        // Check immediate notification needed
        for (const d of dates) {
          if (isToday(d) || isTomorrow(d)) {
            await sendImmediateLeaveNotification(records);
            break;
          }
        }
        break;
      }

      case CommandType.COMPLETE: {
        const todo = await findTodoById(cmd.id);
        if (!todo) {
          await replyMessage(messageId, buildErrorCard(`找不到 TODO #${cmd.id}`));
          return;
        }
        await updateTodo(todo.recordId, { status: '完成' });
        await replyMessage(messageId, buildSuccessCard(`已完成 TODO #${cmd.id}`));
        break;
      }

      case CommandType.CANCEL: {
        const todo = await findTodoById(cmd.id);
        if (!todo) {
          await replyMessage(messageId, buildErrorCard(`找不到 TODO #${cmd.id}`));
          return;
        }
        await updateTodo(todo.recordId, { status: '取消' });
        let msg = `已取消 TODO #${cmd.id}`;
        if (todo.isLeave && todo.approvalStatus === '已送出') {
          msg += '\n⚠️ 假單已送出，請至 Lark 審批中手動撤回';
        }
        await replyMessage(messageId, buildSuccessCard(msg));
        break;
      }

      case CommandType.CREATE_APPROVAL: {
        const todo = await findTodoById(cmd.id);
        if (!todo) {
          await replyMessage(messageId, buildErrorCard(`找不到 TODO #${cmd.id}`));
          return;
        }
        if (!todo.isLeave) {
          await replyMessage(messageId, buildErrorCard(`TODO #${cmd.id} 不是請假項目`));
          return;
        }
        if (todo.approvalStatus !== '未建立') {
          await replyMessage(messageId, buildErrorCard(`TODO #${cmd.id} 的假單已經${todo.approvalStatus}`));
          return;
        }
        await replyMessage(
          messageId,
          buildLeaveConfirmCard(
            formatDate(todo.date),
            todo.leaveType || '未選擇',
            todo.leaveReason,
            todo.recordId
          )
        );
        break;
      }

      case CommandType.SET_GROUP:
        await replyMessage(
          messageId,
          buildSuccessCard('請將我（Bot）加入你要通知的群組，然後在該群組中輸入「綁定通知」即可完成設定。')
        );
        break;

      case CommandType.BIND_GROUP:
        if (chatType === 'group') {
          // Update config table with this group's chat_id
          await updateConfigGroupId(chatId);
          await replyMessage(messageId, buildSuccessCard('已將此群組設為請假通知群組'));
        } else {
          await replyMessage(messageId, buildErrorCard('請在群組中使用此指令'));
        }
        break;

      case CommandType.SET_REMIND: {
        await updateConfigRemindTime(cmd.time);
        await replyMessage(messageId, buildSuccessCard(`已將每日提醒時間設為 ${cmd.time}`));
        break;
      }

      case CommandType.UNKNOWN:
        await replyMessage(
          messageId,
          buildErrorCard('無法識別的指令，請輸入 help 或 ? 查看可用指令')
        );
        break;
    }
  } catch (error) {
    console.error('Bot handler error:', error);
    await replyMessage(messageId, buildErrorCard('操作失敗，請稍後再試。若持續發生請檢查 Bot 服務狀態。'));
  }
}

async function sendImmediateLeaveNotification(records: any[]): Promise<void> {
  const groupId = config.defaults.notifyGroupId;
  if (!groupId) return;
  await sendLeaveNotification(records, groupId);
}

async function updateConfigGroupId(chatId: string): Promise<void> {
  await updateConfigField('notify_group_id', chatId);
  config.defaults.notifyGroupId = chatId; // sync runtime
}

async function updateConfigRemindTime(time: string): Promise<void> {
  await updateConfigField('morning_remind_time', time);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lark/bot.ts
git commit -m "feat: add bot command router with all command handlers"
```

---

### Task 12: Card Action Handler

**Files:**
- Modify: `src/lark/client.ts`

- [ ] **Step 1: Update client.ts to wire card action handler with bot logic**

Replace the placeholder `cardActionHandler` in `src/lark/client.ts` with a proper implementation that imports and delegates to a dedicated handler:

```typescript
// src/lark/client.ts
import * as lark from '@larksuiteoapi/node-sdk';
import type { InteractiveCardActionEvent } from '@larksuiteoapi/node-sdk';
import { config } from '../config';

export const client = new lark.Client({
  appId: config.lark.appId,
  appSecret: config.lark.appSecret,
});

export const eventDispatcher = new lark.EventDispatcher({
  encryptKey: config.lark.encryptKey,
  verificationToken: config.lark.verificationToken,
});

export async function handleCardAction(data: InteractiveCardActionEvent): Promise<object> {
  const value = typeof data.action?.value === 'string'
    ? JSON.parse(data.action.value)
    : data.action?.value || {};
  const { action: actionType, recordId, leaveType } = value;

  const { updateTodo, findTodoById } = await import('../modules/todo');
  const { createLeaveApproval } = await import('../modules/approval');
  const { formatDate } = await import('../utils/date');
  const { buildLeaveConfirmCard, buildSuccessCard } = await import('./cards');

  if (actionType === 'select_leave_type' && recordId && leaveType) {
    // User selected leave type → update record and show confirm card
    await updateTodo(recordId, { leave_type: leaveType });

    // Get record to show confirm card
    // We need to search by record_id directly
    const res = await client.bitable.appTableRecord.get({
      path: {
        app_token: config.bitable.appToken,
        table_id: config.bitable.todoTableId,
        record_id: recordId,
      },
    });
    const fields = (res.data?.record?.fields || {}) as any;
    return JSON.parse(
      buildLeaveConfirmCard(
        formatDate(new Date(fields.date)),
        leaveType,
        fields.leave_reason || fields.content || '',
        recordId
      )
    );
  }

  if (actionType === 'confirm_approval' && recordId) {
    // Get the record
    const res = await client.bitable.appTableRecord.get({
      path: {
        app_token: config.bitable.appToken,
        table_id: config.bitable.todoTableId,
        record_id: recordId,
      },
    });
    const fields = (res.data?.record?.fields || {}) as any;
    const record = {
      recordId,
      date: new Date(fields.date),
      leaveReason: fields.leave_reason || '',
      leaveGroupId: fields.leave_group_id || '',
    } as any;

    await createLeaveApproval(record, fields.leave_type || '事假', config.defaults.userId);
    return JSON.parse(buildSuccessCard('假單已送出，審批進行中'));
  }

  if (actionType === 'defer_approval') {
    return JSON.parse(buildSuccessCard('好的，你可以稍後使用「建立假單 <id>」指令來建立假單'));
  }

  return {};
}

export const cardActionHandler = new lark.CardActionHandler(
  {
    encryptKey: config.lark.encryptKey,
    verificationToken: config.lark.verificationToken,
  },
  handleCardAction
);
```

- [ ] **Step 2: Commit**

```bash
git add src/lark/client.ts
git commit -m "feat: implement card action handler for leave type selection and approval"
```

---

### Task 13: Daily Remind Scheduler

**Files:**
- Create: `src/scheduler/daily-remind.ts`

- [ ] **Step 1: Implement daily remind scheduler**

```typescript
// src/scheduler/daily-remind.ts
import cron from 'node-cron';
import { getTodosByDate, getLeavesByDate } from '../modules/todo';
import { sendPrivateMessage } from '../modules/notify';
import { buildTodoListCard } from '../lark/cards';
import { formatDate } from '../utils/date';
import { config } from '../config';

export async function runDailyRemind(): Promise<void> {
  const today = new Date();
  const todos = await getTodosByDate(today);

  // Also fetch tomorrow and day-after-tomorrow leave items for preview
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const dayAfter = new Date(today);
  dayAfter.setDate(today.getDate() + 2);

  const tomorrowLeaves = await getTodosByDate(tomorrow);
  const dayAfterLeaves = await getTodosByDate(dayAfter);
  const upcomingLeaves = [...tomorrowLeaves, ...dayAfterLeaves].filter((t) => t.isLeave);

  if (todos.length === 0 && upcomingLeaves.length === 0) return;

  const items = todos.map((t) => ({
    id: t.id,
    content: t.content,
    date: formatDate(t.date),
    isLeave: t.isLeave,
    leaveType: t.leaveType,
  }));

  // Append upcoming leave preview items
  const upcomingItems = upcomingLeaves.map((t) => ({
    id: t.id,
    content: `[即將請假] ${t.leaveReason}（${t.leaveType}）`,
    date: formatDate(t.date),
    isLeave: true,
    leaveType: t.leaveType,
  }));

  const allItems = [...items, ...upcomingItems];
  const card = buildTodoListCard(`早安！今天 ${formatDate(today)}`, allItems);
  await sendPrivateMessage(config.defaults.userId, card);
}

export function scheduleDailyRemind(): void {
  // Default 09:00 Asia/Taipei = 01:00 UTC
  const cronExpr = '0 1 * * *'; // UTC
  cron.schedule(cronExpr, async () => {
    try {
      console.log('[daily-remind] Running...');
      await runDailyRemind();
      console.log('[daily-remind] Done');
    } catch (error) {
      console.error('[daily-remind] Error:', error);
    }
  });
  console.log('[daily-remind] Scheduled at 09:00 Asia/Taipei');
}
```

- [ ] **Step 2: Commit**

```bash
git add src/scheduler/daily-remind.ts
git commit -m "feat: add daily TODO remind scheduler"
```

---

### Task 14: Leave Notify Scheduler

**Files:**
- Create: `src/scheduler/leave-notify.ts`

- [ ] **Step 1: Implement leave notify scheduler**

```typescript
// src/scheduler/leave-notify.ts
import cron from 'node-cron';
import { client } from '../lark/client';
import { getLeavesByDate, updateTodo, TodoRecord } from '../modules/todo';
import { sendGroupMessage } from '../modules/notify';
import { buildLeaveNotifyCard } from '../lark/cards';
import { formatDateWithWeekday } from '../utils/date';
import { config } from '../config';

export async function sendLeaveNotification(
  records: TodoRecord[],
  groupId: string
): Promise<void> {
  // Group by leave_group_id to merge multi-day leaves
  const groups = new Map<string, TodoRecord[]>();
  for (const r of records) {
    const key = r.leaveGroupId || r.recordId; // fallback to recordId if no group
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  for (const [, group] of groups) {
    const sorted = group.sort((a, b) => a.date.getTime() - b.date.getTime());
    const first = sorted[0];
    const days = sorted.length;
    const dateStr = days > 1
      ? `${formatDateWithWeekday(first.date)} ~ ${formatDateWithWeekday(sorted[days - 1].date)}`
      : formatDateWithWeekday(first.date);

    // Fetch user name from Lark contact API
    const userRes = await client.contact.user.get({
      path: { user_id: config.defaults.userId },
      params: { user_id_type: 'user_id' },
    });
    const userName = userRes.data?.user?.name || 'Unknown';
    const card = buildLeaveNotifyCard(userName, dateStr, days, first.leaveReason);
    await sendGroupMessage(groupId, card);

    // Mark all as notified
    for (const r of sorted) {
      await updateTodo(r.recordId, { notified: true });
    }
  }
}

export async function runLeaveNotify(): Promise<void> {
  const groupId = config.defaults.notifyGroupId;
  if (!groupId) {
    console.log('[leave-notify] No group configured, skipping');
    return;
  }

  // Check day after tomorrow
  const dayAfterTomorrow = new Date();
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

  const leaves = await getLeavesByDate(dayAfterTomorrow);
  if (leaves.length === 0) return;

  await sendLeaveNotification(leaves, groupId);
}

export function scheduleLeaveNotify(): void {
  // Default 10:00 Asia/Taipei = 02:00 UTC
  const cronExpr = '0 2 * * *'; // UTC
  cron.schedule(cronExpr, async () => {
    try {
      console.log('[leave-notify] Running...');
      await runLeaveNotify();
      console.log('[leave-notify] Done');
    } catch (error) {
      console.error('[leave-notify] Error:', error);
    }
  });
  console.log('[leave-notify] Scheduled at 10:00 Asia/Taipei');
}
```

- [ ] **Step 2: Commit**

```bash
git add src/scheduler/leave-notify.ts
git commit -m "feat: add leave group notification scheduler"
```

---

## Chunk 5: Entry Point & Deployment

### Task 15: Express Server Entry Point

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Implement entry point**

```typescript
// src/index.ts
import express from 'express';
import * as lark from '@larksuiteoapi/node-sdk';
import { config } from './config';
import { client, eventDispatcher, cardActionHandler } from './lark/client';
import { handleMessage } from './lark/bot';
import { handleApprovalStatusChange } from './modules/approval';
import { loadOrSeedConfig } from './modules/config-store';
import { scheduleDailyRemind } from './scheduler/daily-remind';
import { scheduleLeaveNotify } from './scheduler/leave-notify';

const app = express();

// Health check endpoint (required for UptimeRobot keep-alive)
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Register event handlers
eventDispatcher.register({
  'im.message.receive_v1': async (data) => {
    const message = data.message;
    if (!message) return;

    // Only handle text messages
    const msgType = message.message_type;
    if (msgType !== 'text') return;

    const content = JSON.parse(message.content || '{}');
    const text = content.text || '';
    const messageId = message.message_id || '';
    const chatId = message.chat_id || '';
    const chatType = message.chat_type || '';

    await handleMessage(messageId, text, chatId, chatType);
  },
});

// Register approval status change event
(eventDispatcher as any).register({
  'approval.instance.status_changed': async (data: any) => {
    const instanceCode = data?.instance_code || '';
    const status = data?.status || '';
    if (instanceCode && status) {
      await handleApprovalStatusChange(instanceCode, status);
    }
  },
});

// Mount Lark webhook endpoints
app.use('/webhook/event', lark.adaptExpress(eventDispatcher, { autoChallenge: true }));
app.use('/webhook/card', lark.adaptExpress(cardActionHandler));

// Start schedulers
scheduleDailyRemind();
scheduleLeaveNotify();

// Initialize and start server
async function main() {
  // Load or seed config from Bitable
  await loadOrSeedConfig();
  console.log('✅ Config loaded from Bitable');

  app.listen(config.port, () => {
    console.log(`🚀 Lark TODO Bot running on port ${config.port}`);
    console.log(`📋 Health check: http://localhost:${config.port}/health`);
  });
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify the project builds**

```bash
npx tsc --noEmit
```
Expected: no errors (fix any type errors if found)

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: add Express server entry point with event handlers and schedulers"
```

---

### Task 16: Deployment Configuration

**Files:**
- Create: `render.yaml`
- Modify: `package.json` (add engines field)

- [ ] **Step 1: Create render.yaml**

```yaml
services:
  - type: web
    name: lark-todo-bot
    runtime: node
    plan: free
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: TZ
        value: Asia/Taipei
      - key: LARK_APP_ID
        sync: false
      - key: LARK_APP_SECRET
        sync: false
      - key: LARK_VERIFICATION_TOKEN
        sync: false
      - key: LARK_ENCRYPT_KEY
        sync: false
      - key: BITABLE_APP_TOKEN
        sync: false
      - key: BITABLE_TODO_TABLE_ID
        sync: false
      - key: BITABLE_CONFIG_TABLE_ID
        sync: false
      - key: DEFAULT_USER_ID
        sync: false
      - key: DEFAULT_NOTIFY_GROUP_ID
        sync: false
      - key: DEFAULT_APPROVAL_CODE
        sync: false
```

- [ ] **Step 2: Add engines to package.json**

Add to `package.json`:
```json
{
  "engines": {
    "node": ">=18.0.0"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add render.yaml package.json
git commit -m "chore: add Render deployment config"
```

---

### Task 17: Final Integration Test

- [ ] **Step 1: Build the project**

```bash
npm run build
```
Expected: builds successfully to `dist/`

- [ ] **Step 2: Run all tests**

```bash
npm test
```
Expected: all tests pass

- [ ] **Step 3: Verify .env.example has all required variables**

Cross-check `.env.example` against `src/config.ts` to ensure nothing is missing.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: finalize project setup and verify build"
```

---

## Design Decisions

- **Bitable `id` field is an auto-number.** When creating the Bitable table, the `id` column must be configured as "自動編號" (auto-number) type. Bitable auto-generates sequential integers — the code does NOT need to compute or set the `id` value. The `createTodo` function omits `id` intentionally.
- **Runtime config mutation is intentional.** `config.defaults` properties (e.g., `notifyGroupId`) are mutated at runtime after loading from Bitable via `config-store.ts`. This is a deliberate in-memory cache pattern — `config.ts` provides env-var defaults, `config-store.ts` overrides them from Bitable on startup and on user updates. Both `config-store.ts` and `bot.ts` may mutate `config.defaults`.

---

## Known Limitations

- **Cron schedule is fixed at startup.** The `設定提醒` command updates the Bitable config but does not dynamically re-register cron jobs. A server restart is needed for time changes to take effect. This is acceptable for a personal tool — dynamic cron re-registration can be added as a future enhancement.

---

## Post-Implementation Checklist

After code is deployed, these manual steps are needed:

1. **Create Lark App** at https://open.larksuite.com — get App ID + Secret
2. **Enable Bot** capability in the app settings
3. **Subscribe events**: `im.message.receive_v1`, `approval.instance.status_changed`
4. **Request permissions**: `bitable:record:read`, `bitable:record:write`, `im:message:send`, `approval:instance:create`, `approval:instance:read`, `contact:user.id:readonly`
5. **Create Bitable** with TODO table and Config table matching the schema
6. **Deploy to Render** — push to GitHub, connect repo in Render dashboard
7. **Set webhook URL** in Lark App: `https://<render-url>/webhook/event` and `https://<render-url>/webhook/card`
8. **Set up UptimeRobot** to ping `https://<render-url>/health` every 5 minutes
9. **Add Bot to a group** and type `綁定通知` to set notification target
