// src/scheduler/daily-remind.ts
import cron from 'node-cron';
import { getTodosByDate } from '../modules/todo';
import { sendPrivateMessage } from '../modules/notify';
import { buildTodoListCard } from '../lark/cards';
import { formatDate } from '../utils/date';
import { config } from '../config';

export async function runDailyRemind(): Promise<void> {
  const today = new Date();
  const todos = await getTodosByDate(today);

  // Also fetch tomorrow and day-after-tomorrow for upcoming leave preview
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const dayAfter = new Date(today);
  dayAfter.setDate(today.getDate() + 2);

  const tomorrowTodos = await getTodosByDate(tomorrow);
  const dayAfterTodos = await getTodosByDate(dayAfter);
  const upcomingLeaves = [...tomorrowTodos, ...dayAfterTodos].filter((t) => t.isLeave);

  if (todos.length === 0 && upcomingLeaves.length === 0) return;

  const items = todos.map((t) => ({
    id: t.id,
    content: t.content,
    date: formatDate(t.date),
    isLeave: t.isLeave,
    leaveType: t.leaveType,
  }));

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
  // 09:00 Asia/Taipei = 01:00 UTC
  const cronExpr = '0 1 * * *';
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
