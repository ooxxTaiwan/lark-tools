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

  const { updateTodo } = await import('../modules/todo');
  const { createLeaveApproval } = await import('../modules/approval');
  const { formatDate } = await import('../utils/date');
  const { buildLeaveConfirmCard, buildSuccessCard } = await import('./cards');

  if (actionType === 'select_leave_type' && recordId && leaveType) {
    await updateTodo(recordId, { leave_type: leaveType });

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
    const { buildSuccessCard: buildSuccess } = await import('./cards');
    return JSON.parse(buildSuccess('好的，你可以稍後使用「建立假單 <id>」指令來建立假單'));
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
