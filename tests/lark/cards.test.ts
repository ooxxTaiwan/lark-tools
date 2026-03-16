import { describe, it, expect } from 'vitest';
import {
  buildHelpCard,
  buildTodoListCard,
  buildLeaveTypeCard,
  buildLeaveConfirmCard,
  buildLeaveNotifyCard,
} from '../../src/lark/cards';

describe('buildHelpCard', () => {
  it('returns valid card JSON string', () => {
    const card = buildHelpCard();
    const parsed = JSON.parse(card);
    expect(parsed.header.title.content).toContain('指令說明');
  });
});

describe('buildTodoListCard', () => {
  it('builds card with todo items', () => {
    const todos = [
      { id: 1, content: '準備週會', date: '3/20', isLeave: false },
      { id: 2, content: '家中有事', date: '3/21', isLeave: true, leaveType: '事假' },
    ];
    const card = buildTodoListCard('3/20', todos);
    const parsed = JSON.parse(card);
    expect(parsed.header.title.content).toContain('3/20');
  });
});

describe('buildLeaveTypeCard', () => {
  it('builds card with leave type buttons', () => {
    const card = buildLeaveTypeCard('3/21', '家中有事', 'record_123');
    const parsed = JSON.parse(card);
    expect(parsed.elements).toBeDefined();
  });
});

describe('buildLeaveConfirmCard', () => {
  it('builds card with confirm/defer buttons', () => {
    const card = buildLeaveConfirmCard('3/21', '事假', '家中有事', 'record_123');
    const parsed = JSON.parse(card);
    expect(parsed.elements).toBeDefined();
  });
});

describe('buildLeaveNotifyCard', () => {
  it('builds group notification card', () => {
    const card = buildLeaveNotifyCard('Jay', '3/21（五）', 1, '家中有事');
    const parsed = JSON.parse(card);
    expect(parsed.header.title.content).toContain('請假通知');
  });
});
