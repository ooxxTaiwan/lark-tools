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
