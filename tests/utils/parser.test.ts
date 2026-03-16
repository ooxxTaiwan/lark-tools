import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseCommand, CommandType } from '../../src/utils/parser';

describe('parseCommand', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-16T10:00:00+08:00'));
  });

  it('parses 新增 command', () => {
    const result = parseCommand('新增 3/20 準備週會簡報');
    expect(result).toEqual({
      type: CommandType.ADD,
      date: '3/20',
      content: '準備週會簡報',
      isLeave: false,
    });
  });

  it('parses 請假 command', () => {
    const result = parseCommand('請假 3/21 家中有事');
    expect(result).toEqual({
      type: CommandType.LEAVE,
      date: '3/21',
      content: '家中有事',
      isLeave: true,
    });
  });

  it('parses 新增 with 請假 keyword detection', () => {
    const result = parseCommand('新增 3/25 請假 搬家');
    expect(result).toEqual({
      type: CommandType.ADD,
      date: '3/25',
      content: '請假 搬家',
      isLeave: true,
    });
  });

  it('parses 今天 command', () => {
    const result = parseCommand('今天');
    expect(result).toEqual({ type: CommandType.TODAY });
  });

  it('parses 本週 command', () => {
    const result = parseCommand('本週');
    expect(result).toEqual({ type: CommandType.THIS_WEEK });
  });

  it('parses 完成 command', () => {
    const result = parseCommand('完成 3');
    expect(result).toEqual({ type: CommandType.COMPLETE, id: 3 });
  });

  it('parses 取消 command', () => {
    const result = parseCommand('取消 5');
    expect(result).toEqual({ type: CommandType.CANCEL, id: 5 });
  });

  it('parses 建立假單 command', () => {
    const result = parseCommand('建立假單 7');
    expect(result).toEqual({ type: CommandType.CREATE_APPROVAL, id: 7 });
  });

  it('parses help command', () => {
    expect(parseCommand('help')).toEqual({ type: CommandType.HELP });
    expect(parseCommand('?')).toEqual({ type: CommandType.HELP });
    expect(parseCommand('幫助')).toEqual({ type: CommandType.HELP });
  });

  it('parses 設定群組 command', () => {
    const result = parseCommand('設定群組');
    expect(result).toEqual({ type: CommandType.SET_GROUP });
  });

  it('parses 綁定通知 command', () => {
    const result = parseCommand('綁定通知');
    expect(result).toEqual({ type: CommandType.BIND_GROUP });
  });

  it('parses 設定提醒 command', () => {
    const result = parseCommand('設定提醒 08:30');
    expect(result).toEqual({ type: CommandType.SET_REMIND, time: '08:30' });
  });

  it('parses 請假 with date range', () => {
    const result = parseCommand('請假 3/21~3/23 搬家');
    expect(result).toEqual({
      type: CommandType.LEAVE,
      date: '3/21~3/23',
      content: '搬家',
      isLeave: true,
    });
  });

  it('returns UNKNOWN for unrecognized input', () => {
    const result = parseCommand('隨便說說');
    expect(result).toEqual({ type: CommandType.UNKNOWN });
  });
});
