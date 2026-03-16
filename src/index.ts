// src/index.ts
import express from 'express';
import * as lark from '@larksuiteoapi/node-sdk';
import { config } from './config';
import { eventDispatcher, cardActionHandler } from './lark/client';
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

// Register message event handler
eventDispatcher.register({
  'im.message.receive_v1': async (data) => {
    const message = data.message;
    if (!message) return;
    if (message.message_type !== 'text') return;

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
