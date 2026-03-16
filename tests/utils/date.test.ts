import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseDate, parseDateRange } from '../../src/utils/date';

describe('parseDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-16T10:00:00+08:00'));
  });

  it('parses M/D format', () => {
    expect(parseDate('3/20')).toEqual(new Date(2026, 2, 20));
  });

  it('parses M月D日 format', () => {
    expect(parseDate('3月20日')).toEqual(new Date(2026, 2, 20));
  });

  it('parses YYYY/M/D format', () => {
    expect(parseDate('2026/3/20')).toEqual(new Date(2026, 2, 20));
  });

  it('parses 今天', () => {
    expect(parseDate('今天')).toEqual(new Date(2026, 2, 16));
  });

  it('parses 明天', () => {
    expect(parseDate('明天')).toEqual(new Date(2026, 2, 17));
  });

  it('parses 後天', () => {
    expect(parseDate('後天')).toEqual(new Date(2026, 2, 18));
  });

  it('parses 下週一 (2026-03-16 is Monday, so 下週一 = 2026-03-23)', () => {
    expect(parseDate('下週一')).toEqual(new Date(2026, 2, 23));
  });

  it('parses 下週日', () => {
    expect(parseDate('下週日')).toEqual(new Date(2026, 2, 29));
  });

  it('rolls to next year if date has passed', () => {
    expect(parseDate('1/1')).toEqual(new Date(2027, 0, 1));
  });

  it('returns null for invalid input', () => {
    expect(parseDate('abc')).toBeNull();
  });
});

describe('parseDateRange', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-16T10:00:00+08:00'));
  });

  it('parses M/D~M/D range', () => {
    const result = parseDateRange('3/21~3/23');
    expect(result).toEqual([
      new Date(2026, 2, 21),
      new Date(2026, 2, 22),
      new Date(2026, 2, 23),
    ]);
  });

  it('returns single-element array for non-range date', () => {
    const result = parseDateRange('3/20');
    expect(result).toEqual([new Date(2026, 2, 20)]);
  });

  it('returns null for invalid input', () => {
    expect(parseDateRange('abc')).toBeNull();
  });
});
