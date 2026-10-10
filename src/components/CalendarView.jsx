import { useMemo, useState } from 'react';
import { DAY_LABELS } from '../lib/weekdays';
import { monthGrid, monthKey, occurrenceDates, toYmd, dowOfYmd } from '../lib/calendar';

const HEAD = [0, 1, 2, 3, 4, 5, 6]; // 일~토

const timeKey = (c) => (c.classStart ? c.classStart.slice(11, 16) : '99:99');

export default function CalendarView({ rows, renderCard }) {
  const today = useMemo(() => toYmd(new Date()), []);
  const [cursor, setCursor] = useState(() => ({ y: +today.slice(0, 4), m: +today.slice(5, 7) }));
  const [sel, setSel] = useState(today);

  // 날짜 → 그날 열리는 강좌들
  const { byDate, anyEstimated } = useMemo(() => {
    const map = new Map();
    let est = false;
    for (const row of rows) {
      const { dates, estimated } = occurrenceDates(row.course, row.daySet);
      if (estimated && dates.length > 1) est = true;
      for (const d of dates) {
        if (!map.has(d)) map.set(d, []);
        map.get(d).push(row);
      }
    }
    return { byDate: map, anyEstimated: est };
  }, [rows]);

  const key = monthKey(cursor.y, cursor.m);
  const cells = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor]);

  const monthCount = useMemo(() => {
    const ids = new Set();
    for (const [d, items] of byDate) if (d.startsWith(key)) items.forEach((r) => ids.add(r.course.id));
    return ids.size;
  }, [byDate, key]);

  const move = (delta) =>
    setCursor(({ y, m }) => {
      const n = y * 12 + (m - 1) + delta;
      return { y: Math.floor(n / 12), m: (n % 12) + 1 };
    });

  // 이 달에 강좌가 없을 때: 가장 가까운 강좌가 있는 달 찾기
  const nearest = useMemo(() => {
    if (monthCount > 0 || byDate.size === 0) return null;
    const keys = [...byDate.keys()].sort();
    const next = keys.find((d) => d >= `${key}-01`) ?? keys[keys.length - 1];
    return { y: +next.slice(0, 4), m: +next.slice(5, 7) };
  }, [monthCount, byDate, key]);

  const dayItems = useMemo(
    () => [...(byDate.get(sel) ?? [])].sort((a, b) => timeKey(a.course).localeCompare(timeKey(b.course))),
    [byDate, sel],
  );
  const selDow = sel ? dowOfYmd(sel) : null;

  return (
    <div className="cal">
      <div className="cal-head">
        <button type="button" className="cal-nav" onClick={() => move(-1)} aria-label="이전 달">‹</button>
        <div className="cal-title">
          <strong>{cursor.y}년 {cursor.m}월</strong>
          <small>이 달 강좌 {monthCount}개</small>
        </div>
        <button type="button" className="cal-nav" onClick={() => move(1)} aria-label="다음 달">›</button>
        <button
          type="button"
          className="link-btn"
          onClick={() => { setCursor({ y: +today.slice(0, 4), m: +today.slice(5, 7) }); setSel(today); }}
        >
          오늘
        </button>
      </div>

      <div className="cal-grid cal-dow" aria-hidden="true">
        {HEAD.map((d) => (
          <span key={d} className={d === 6 ? 'sat' : d === 0 ? 'sun' : ''}>{DAY_LABELS[d]}</span>
        ))}
      </div>
      <div className="cal-grid" role="grid" aria-label={`${cursor.y}년 ${cursor.m}월 행사일 달력`}>
        {cells.map((ymd, i) => {
          if (!ymd) return <span key={`e${i}`} className="cal-cell empty" />;
          const items = byDate.get(ymd) ?? [];
          const tone = items.some((r) => r.course.status === 'open')
            ? 'open'
            : items.some((r) => r.course.status === 'upcoming')
            ? 'upcoming'
            : items.length
            ? 'closed'
            : '';
          const col = i % 7;
          return (
            <button
              key={ymd}
              type="button"
              className={`cal-cell${ymd === today ? ' today' : ''}${ymd === sel ? ' sel' : ''}${col === 6 ? ' sat' : col === 0 ? ' sun' : ''}`}
              onClick={() => setSel(ymd)}
              aria-label={`${+ymd.slice(5, 7)}월 ${+ymd.slice(8, 10)}일, 강좌 ${items.length}개`}
              aria-pressed={ymd === sel}
            >
              <span className="cal-num">{+ymd.slice(8, 10)}</span>
              {items.length > 0 && <span className={`cal-pill ${tone}`}>{items.length}</span>}
            </button>
          );
        })}
      </div>

      <div className="cal-legend">
        <span><i className="cal-pill open" /> 접수가능</span>
        <span><i className="cal-pill upcoming" /> 접수예정</span>
        <span><i className="cal-pill closed" /> 그 외</span>
      </div>

      {nearest && (
        <button type="button" className="outline" onClick={() => setCursor(nearest)}>
          이 달엔 강좌가 없어요 · 가장 가까운 {nearest.m}월로 이동
        </button>
      )}

      {sel && (
        <section className="cal-day" aria-live="polite">
          <h3>
            {+sel.slice(5, 7)}월 {+sel.slice(8, 10)}일({DAY_LABELS[selDow]}) · 강좌 {dayItems.length}개
          </h3>
          {dayItems.length === 0 ? (
            <p className="hint">이 날 열리는 강좌가 없어요.</p>
          ) : (
            <div className="cal-day-list">{dayItems.map(renderCard)}</div>
          )}
        </section>
      )}

      {anyEstimated && (
        <p className="hint">
          기간이 있는 강좌는 시작·종료 요일이 같으면 매주 그 요일에 열리는 것으로 표시해요(추정). 정확한 회차는 도서관 상세 페이지를 확인하세요.
        </p>
      )}
    </div>
  );
}
