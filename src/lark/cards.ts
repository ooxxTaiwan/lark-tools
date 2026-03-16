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
      { tag: 'markdown', content: lines.join('\n') },
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
      { tag: 'markdown', content: `日期：${date}\n事由：${reason}` },
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
  date: string, leaveType: string, reason: string, recordId: string
): string {
  return JSON.stringify({
    header: {
      template: 'orange',
      title: { content: '建立請假審批單', tag: 'plain_text' },
    },
    elements: [
      { tag: 'markdown', content: `日期：${date}\n假別：${leaveType}\n事由：${reason}` },
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
  userName: string, dateStr: string, days: number, reason: string
): string {
  const daysText = days > 1 ? `請假 ${days} 天` : '請假一天';
  return JSON.stringify({
    header: {
      template: 'red',
      title: { content: '📢 請假通知', tag: 'plain_text' },
    },
    elements: [
      { tag: 'markdown', content: `${userName} 將於 ${dateStr} ${daysText}\n事由：${reason}\n如有需要請提前聯繫 🙏` },
    ],
  });
}

export function buildSuccessCard(message: string): string {
  return JSON.stringify({
    header: { template: 'green', title: { content: '✅ 成功', tag: 'plain_text' } },
    elements: [{ tag: 'markdown', content: message }],
  });
}

export function buildErrorCard(message: string): string {
  return JSON.stringify({
    header: { template: 'red', title: { content: '❌ 錯誤', tag: 'plain_text' } },
    elements: [{ tag: 'markdown', content: message }],
  });
}
