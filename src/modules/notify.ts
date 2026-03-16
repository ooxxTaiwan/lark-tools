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
