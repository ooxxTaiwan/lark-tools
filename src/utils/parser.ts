export enum CommandType {
  ADD = 'ADD',
  LEAVE = 'LEAVE',
  TODAY = 'TODAY',
  THIS_WEEK = 'THIS_WEEK',
  COMPLETE = 'COMPLETE',
  CANCEL = 'CANCEL',
  CREATE_APPROVAL = 'CREATE_APPROVAL',
  HELP = 'HELP',
  SET_GROUP = 'SET_GROUP',
  BIND_GROUP = 'BIND_GROUP',
  SET_REMIND = 'SET_REMIND',
  UNKNOWN = 'UNKNOWN',
}

export type ParsedCommand =
  | { type: CommandType.ADD; date: string; content: string; isLeave: boolean }
  | { type: CommandType.LEAVE; date: string; content: string; isLeave: true }
  | { type: CommandType.TODAY }
  | { type: CommandType.THIS_WEEK }
  | { type: CommandType.COMPLETE; id: number }
  | { type: CommandType.CANCEL; id: number }
  | { type: CommandType.CREATE_APPROVAL; id: number }
  | { type: CommandType.HELP }
  | { type: CommandType.SET_GROUP }
  | { type: CommandType.BIND_GROUP }
  | { type: CommandType.SET_REMIND; time: string }
  | { type: CommandType.UNKNOWN };

export function parseCommand(text: string): ParsedCommand {
  const trimmed = text.trim();

  if (/^(help|\?|幫助)$/i.test(trimmed)) {
    return { type: CommandType.HELP };
  }
  if (trimmed === '今天') return { type: CommandType.TODAY };
  if (trimmed === '本週') return { type: CommandType.THIS_WEEK };
  if (trimmed === '設定群組') return { type: CommandType.SET_GROUP };
  if (trimmed === '綁定通知') return { type: CommandType.BIND_GROUP };

  const completeMatch = trimmed.match(/^完成\s+(\d+)$/);
  if (completeMatch) return { type: CommandType.COMPLETE, id: parseInt(completeMatch[1]) };

  const cancelMatch = trimmed.match(/^取消\s+(\d+)$/);
  if (cancelMatch) return { type: CommandType.CANCEL, id: parseInt(cancelMatch[1]) };

  const approvalMatch = trimmed.match(/^建立假單\s+(\d+)$/);
  if (approvalMatch) return { type: CommandType.CREATE_APPROVAL, id: parseInt(approvalMatch[1]) };

  const remindMatch = trimmed.match(/^設定提醒\s+(\d{1,2}:\d{2})$/);
  if (remindMatch) return { type: CommandType.SET_REMIND, time: remindMatch[1] };

  const leaveMatch = trimmed.match(/^請假\s+(\S+)\s+(.+)$/);
  if (leaveMatch) {
    return { type: CommandType.LEAVE, date: leaveMatch[1], content: leaveMatch[2], isLeave: true };
  }

  const addMatch = trimmed.match(/^新增\s+(\S+)\s+(.+)$/);
  if (addMatch) {
    const content = addMatch[2];
    const isLeave = content.includes('請假');
    return { type: CommandType.ADD, date: addMatch[1], content, isLeave };
  }

  return { type: CommandType.UNKNOWN };
}
