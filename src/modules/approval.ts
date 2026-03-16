// src/modules/approval.ts
import { client } from '../lark/client';
import { config } from '../config';
import { updateTodo, findByApprovalId, TodoRecord } from './todo';
import { sendPrivateMessage } from './notify';
import { buildSuccessCard, buildErrorCard } from '../lark/cards';

export async function createLeaveApproval(
  record: TodoRecord,
  leaveType: string,
  userId: string,
  endDate?: Date
): Promise<string> {
  const approvalCode = config.defaults.approvalCode;

  // IMPORTANT: form field IDs (leave_type, leave_start, leave_end, leave_reason)
  // must match the field IDs defined in the company's Lark approval template.
  const formFields: object[] = [
    { id: 'leave_type', type: 'input', value: leaveType },
    { id: 'leave_start', type: 'date', value: record.date.getTime() },
    { id: 'leave_reason', type: 'textarea', value: record.leaveReason },
  ];
  if (endDate) {
    formFields.push({ id: 'leave_end', type: 'date', value: endDate.getTime() });
  }

  const res = await client.approval.instance.create({
    data: {
      approval_code: approvalCode,
      user_id: userId,
      form: JSON.stringify(formFields),
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
    const message = `你的請假申請（${records[0].leaveReason}）${approvalStatus}`;
    const card = approvalStatus === '已通過'
      ? buildSuccessCard(`✅ ${message}`)
      : buildErrorCard(`❌ ${message}`);
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
