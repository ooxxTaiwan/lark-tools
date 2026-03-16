// src/scheduler/leave-notify.ts
import cron from 'node-cron';
import { client } from '../lark/client';
import { getLeavesByDate, updateTodo, TodoRecord } from '../modules/todo';
import { sendGroupMessage, sendWebhookMessage } from '../modules/notify';
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
    const key = r.leaveGroupId || r.recordId;
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

    // Use configured name or fetch from Lark contact API
    let userName = config.webhook.notifyUserName || 'Unknown';
    if (userName === 'Unknown') {
      try {
        const userRes = await client.contact.user.get({
          path: { user_id: config.defaults.userId },
          params: { user_id_type: 'user_id' },
        });
        userName = userRes.data?.user?.name || 'Unknown';
      } catch {
        // fallback
      }
    }

    const card = buildLeaveNotifyCard(userName, dateStr, days, first.leaveReason);

    // Send to company group via Webhook (cross-org)
    if (config.webhook.companyGroupUrl) {
      try {
        await sendWebhookMessage(config.webhook.companyGroupUrl, card);
      } catch (error) {
        console.error('[leave-notify] Webhook send failed:', error);
      }
    }

    // Also send to personal org group if configured
    if (groupId && groupId !== 'webhook') {
      await sendGroupMessage(groupId, card);
    }

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

  const dayAfterTomorrow = new Date();
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

  const leaves = await getLeavesByDate(dayAfterTomorrow);
  if (leaves.length === 0) return;

  await sendLeaveNotification(leaves, groupId);
}

export function scheduleLeaveNotify(): void {
  // 10:00 Asia/Taipei = 02:00 UTC
  const cronExpr = '0 2 * * *';
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
