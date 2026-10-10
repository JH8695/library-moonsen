import { TZ } from './grade';

const ymdFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const pad = (n) => String(n).padStart(2, '0');

// 한국 시간 기준 'YYYY-MM-DD'
export const toYmd = (v) => ymdFmt.format(new Date(v));

const parse = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const fmt = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

/**
 * 강좌가 열리는 날짜 목록 (행사일 기준, 'YYYY-MM-DD').
 * - 하루짜리: 그 날
 * - 기간이 있고 요일 규칙을 알면(daySet): 기간 안에서 그 요일인 날마다
 * - 요일 규칙을 모르는 긴 기간: 시작일과 종료일만 표시
 * estimated: 기간 강좌인데 "매주 ○" 같은 명시가 없어 요일 반복을 추정한 경우
 */
export function occurrenceDates(course, daySet) {
  if (!course.classStart) return { dates: [], estimated: false };
  const s = toYmd(course.classStart);
  const e = course.classEnd ? toYmd(course.classEnd) : s;
  if (e <= s) return { dates: [s], estimated: false };
  const estimated = !course.recurrence;
  if (!daySet) return { dates: [s, e], estimated: true };
  const dates = [];
  let t = parse(s);
  const end = parse(e);
  for (let i = 0; t <= end && i < 400; i++, t += 86400000) {
    if (daySet.has(new Date(t).getUTCDay())) dates.push(fmt(t));
  }
  return { dates: dates.length ? dates : [s], estimated };
}

// 일요일 시작 달력 칸. 빈 칸은 null, 날짜는 'YYYY-MM-DD'. m 은 1~12.
export function monthGrid(y, m) {
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); // 0=일
  const offset = first; // 일요일이 첫 칸
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = Array(offset).fill(null);
  for (let d = 1; d <= days; d++) cells.push(`${y}-${pad(m)}-${pad(d)}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}

export const monthKey = (y, m) => `${y}-${pad(m)}`;
export const dowOfYmd = (ymd) => new Date(parse(ymd)).getUTCDay();
