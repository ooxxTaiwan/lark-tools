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

/**
 * 透過 Webhook URL 發送訊息到公司群組（跨組織）
 * Webhook Bot 支援 text 和 interactive (card) 兩種格式
 */
export async function sendWebhookMessage(
  webhookUrl: string,
  content: string,
  msgType: 'text' | 'interactive' = 'interactive'
): Promise<void> {
  const body = msgType === 'text'
    ? { msg_type: 'text', content: { text: content } }
    : { msg_type: 'interactive', card: JSON.parse(content) };

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Webhook send failed: ${res.status} ${await res.text()}`);
  }
}
