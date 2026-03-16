import { v4 as uuidv4 } from 'uuid';
import { parseCommand, CommandType } from '../utils/parser';
import { parseDateRange, formatDate, isToday, isTomorrow } from '../utils/date';
import { createTodo, getTodosByDate, getTodosByDateRange, findTodoById, updateTodo } from '../modules/todo';
import { replyMessage } from '../modules/notify';
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
  // Strip Lark @mention tags (e.g. "@_user_1 ") that appear in group chat messages
  const cleanedText = text.replace(/@_\w+\s?/g, '').trim();
  const cmd = parseCommand(cleanedText);

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
            id: t.id, content: t.content, date: formatDate(t.date),
            isLeave: t.isLeave, leaveType: t.leaveType,
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
            id: t.id, content: t.content, date: formatDate(t.date),
            isLeave: t.isLeave, leaveType: t.leaveType,
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
            date: d, content: cmd.content, isLeave: cmd.isLeave,
            leaveReason: cmd.isLeave ? cmd.content : undefined, leaveGroupId,
          });
          records.push(record);
        }
        if (cmd.isLeave) {
          await replyMessage(messageId, buildLeaveTypeCard(cmd.date, cmd.content, records[0].recordId));
          await checkImmediateNotification(dates, records);
        } else {
          await replyMessage(messageId, buildSuccessCard(`已新增 TODO #${records[0].id}：${formatDate(dates[0])} ${cmd.content}`));
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
            date: d, content: cmd.content, isLeave: true,
            leaveReason: cmd.content, leaveGroupId,
          });
          records.push(record);
        }
        const dateLabel = dates.length > 1
          ? `${formatDate(dates[0])} ~ ${formatDate(dates[dates.length - 1])}`
          : formatDate(dates[0]);
        await replyMessage(messageId, buildLeaveTypeCard(dateLabel, cmd.content, records[0].recordId));
        await checkImmediateNotification(dates, records);
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
        await replyMessage(messageId, buildLeaveConfirmCard(
          formatDate(todo.date), todo.leaveType || '未選擇', todo.leaveReason, todo.recordId
        ));
        break;
      }

      case CommandType.SET_GROUP:
        await replyMessage(messageId, buildSuccessCard('請將我（Bot）加入你要通知的群組，然後在該群組中輸入「綁定通知」即可完成設定。'));
        break;

      case CommandType.BIND_GROUP:
        if (chatType === 'group') {
          await updateConfigField('notify_group_id', chatId);
          config.defaults.notifyGroupId = chatId;
          await replyMessage(messageId, buildSuccessCard('已將此群組設為請假通知群組'));
        } else {
          await replyMessage(messageId, buildErrorCard('請在群組中使用此指令'));
        }
        break;

      case CommandType.SET_REMIND: {
        await updateConfigField('morning_remind_time', cmd.time);
        await replyMessage(messageId, buildSuccessCard(`已將每日提醒時間設為 ${cmd.time}`));
        break;
      }

      case CommandType.UNKNOWN:
        await replyMessage(messageId, buildErrorCard('無法識別的指令，請輸入 help 或 ? 查看可用指令'));
        break;
    }
  } catch (error) {
    console.error('Bot handler error:', error);
    await replyMessage(messageId, buildErrorCard('操作失敗，請稍後再試。若持續發生請檢查 Bot 服務狀態。'));
  }
}

async function checkImmediateNotification(dates: Date[], records: any[]): Promise<void> {
  const groupId = config.defaults.notifyGroupId;
  if (!groupId) return;
  for (const d of dates) {
    if (isToday(d) || isTomorrow(d)) {
      await sendLeaveNotification(records, groupId);
      break;
    }
  }
}
