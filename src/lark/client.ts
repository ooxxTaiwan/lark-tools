import * as lark from '@larksuiteoapi/node-sdk';
import { config } from '../config';

export const client = new lark.Client({
  appId: config.lark.appId,
  appSecret: config.lark.appSecret,
});

export const eventDispatcher = new lark.EventDispatcher({
  encryptKey: config.lark.encryptKey,
  verificationToken: config.lark.verificationToken,
});

export const cardActionHandler = new lark.CardActionHandler(
  {
    encryptKey: config.lark.encryptKey,
    verificationToken: config.lark.verificationToken,
  },
  async (data) => {
    // Placeholder — actual handling is registered in Task 12
    return {};
  }
);
