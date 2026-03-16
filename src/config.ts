// src/config.ts
import dotenv from 'dotenv';
dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

export const config = {
  lark: {
    appId: requireEnv('LARK_APP_ID'),
    appSecret: requireEnv('LARK_APP_SECRET'),
    verificationToken: optionalEnv('LARK_VERIFICATION_TOKEN', ''),
    encryptKey: optionalEnv('LARK_ENCRYPT_KEY', ''),
  },
  bitable: {
    appToken: requireEnv('BITABLE_APP_TOKEN'),
    todoTableId: requireEnv('BITABLE_TODO_TABLE_ID'),
    configTableId: requireEnv('BITABLE_CONFIG_TABLE_ID'),
  },
  defaults: {
    userId: requireEnv('DEFAULT_USER_ID'),
    notifyGroupId: optionalEnv('DEFAULT_NOTIFY_GROUP_ID', ''),
    approvalCode: optionalEnv('DEFAULT_APPROVAL_CODE', ''),
  },
  port: parseInt(optionalEnv('PORT', '3000'), 10),
};
