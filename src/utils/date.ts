const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return startOfDay(result);
}

export function parseDate(input: string): Date | null {
  const trimmed = input.trim();
  const now = new Date();
  const today = startOfDay(now);

  if (trimmed === '今天') return today;
  if (trimmed === '明天') return addDays(today, 1);
  if (trimmed === '後天') return addDays(today, 2);

  const weekdayMatch = trimmed.match(/^下週([一二三四五六日])$/);
  if (weekdayMatch) {
    const targetDay = DAY_NAMES.indexOf(weekdayMatch[1]);
    const currentDay = today.getDay();
    const daysUntilNextMonday = (8 - currentDay) % 7 || 7;
    const nextMonday = addDays(today, daysUntilNextMonday);
    const targetOffset = targetDay === 0 ? 6 : targetDay - 1;
    return addDays(nextMonday, targetOffset);
  }

  const fullMatch = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (fullMatch) {
    const [, y, m, d] = fullMatch;
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  }

  const shortMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (shortMatch) {
    const [, m, d] = shortMatch;
    let date = new Date(today.getFullYear(), parseInt(m) - 1, parseInt(d));
    if (date < today) {
      date = new Date(today.getFullYear() + 1, parseInt(m) - 1, parseInt(d));
    }
    return date;
  }

  const cnMatch = trimmed.match(/^(\d{1,2})月(\d{1,2})日$/);
  if (cnMatch) {
    const [, m, d] = cnMatch;
    let date = new Date(today.getFullYear(), parseInt(m) - 1, parseInt(d));
    if (date < today) {
      date = new Date(today.getFullYear() + 1, parseInt(m) - 1, parseInt(d));
    }
    return date;
  }

  return null;
}

export function parseDateRange(input: string): Date[] | null {
  const trimmed = input.trim();
  const rangeMatch = trimmed.match(/^(.+)~(.+)$/);
  if (rangeMatch) {
    const start = parseDate(rangeMatch[1]);
    const end = parseDate(rangeMatch[2]);
    if (!start || !end || end < start) return null;
    const dates: Date[] = [];
    const current = new Date(start);
    while (current <= end) {
      dates.push(startOfDay(new Date(current)));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }
  const single = parseDate(trimmed);
  if (single) return [single];
  return null;
}

export function formatDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function formatDateWithWeekday(d: Date): string {
  const weekday = DAY_NAMES[d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()}（${weekday}）`;
}

export function isToday(d: Date): boolean {
  const today = startOfDay(new Date());
  return startOfDay(d).getTime() === today.getTime();
}

export function isTomorrow(d: Date): boolean {
  return startOfDay(d).getTime() === addDays(startOfDay(new Date()), 1).getTime();
}

export function isDayAfterTomorrow(d: Date): boolean {
  return startOfDay(d).getTime() === addDays(startOfDay(new Date()), 2).getTime();
}
