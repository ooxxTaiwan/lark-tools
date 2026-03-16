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
  date?: number;
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
