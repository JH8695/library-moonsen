import { useEffect, useMemo, useState } from 'react';
import { REGIONS } from './data/libraries';
import { gradeOn, koreanAge, gradeLabel, matchTarget } from './lib/grade';
import { fmtFetchedAt, fmtStartTime } from './lib/format';
import { useSettings } from './lib/useSettings';
import { useSync } from './lib/useSync';
import { parseShareHash } from './lib/backup';
import { mergeUnion, pickSync } from './lib/sync';
import { useCourses } from './lib/useCourses';
import { useLibraries } from './lib/useLibraries';
import { DAY_LABELS, DAY_ORDER, classWeekdays, passesDays } from './lib/weekdays';
import CourseCard, { KidPills } from './components/CourseCard';
import MapView from './components/MapView';
import Settings from './components/Settings';
import LibraryEditor from './components/LibraryEditor';
import CalendarView from './components/CalendarView';
import AppSwitcher from './components/AppSwitcher';
import NoteSheet from './components/NoteSheet';

const TABS = [
  { id: 'all', label: '전체' },
  { id: 'open', label: '접수가능' },
  { id: 'upcoming', label: '접수예정' },
];

const SORTS = [
  { id: 'applyStart', label: '접수 시작 빠른 순' },
  { id: 'classDate', label: '수업일 빠른 순' },
  { id: 'drive', label: '가까운 순 (차)' },
];

function useMedia(query) {
  const [m, setM] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return m;
}

const t = (iso) => (iso ? new Date(iso).getTime() : Infinity);

export default function App() {
  const [settings, setSettings, applyRemote] = useSettings();
  const sync = useSync(settings, applyRemote); // 구글 로그인 동기화 (로그인 전에는 아무것도 불러오지 않음)
  const { courses, meta } = useCourses();
  const L = useLibraries();
  const { libs, byId } = L;
  const isDesktop = useMedia('(min-width: 900px)');

  const [tab, setTab] = useState('all');
  const [region, setRegion] = useState('all');
  const [sort, setSort] = useState('applyStart');
  const [view, setView] = useState('calendar'); // 폰 하단 탭: calendar | list | map (PC는 사용 안 함)
  const [selectedLib, setSelectedLib] = useState(null);
  const [showClosed, setShowClosed] = useState(false);
  const [showAllTargets, setShowAllTargets] = useState(false);
  const [showHidden, setShowHidden] = useState(false); // 숨긴 강좌만 보기(다시 보이게 하려고)
  const [query, setQuery] = useState('');
  const [favOnly, setFavOnly] = useState(false);
  const [noteFor, setNoteFor] = useState(null); // 메모 창을 연 강좌 id
  const [toast, setToast] = useState(null); // 방금 숨긴 강좌 { id, text } — 되돌리기 안내
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editor, setEditor] = useState(null); // null | { focusId: string | null }
  const days = settings.days ?? [];
  const phoneCalendar = !isDesktop && view === 'calendar';
  const effDays = useMemo(() => (phoneCalendar ? [] : days), [phoneCalendar, days]);
  const toggleDay = (d) =>
    setSettings({ ...settings, days: days.includes(d) ? days.filter((x) => x !== d) : [...days, d] });

  const now = useMemo(() => new Date(), []);
  const kids = settings.kids;
  const activeIds = useMemo(() => {
    const ids = kids.map((k) => k.id);
    const picked = (settings.activeKids ?? []).filter((id) => ids.includes(id));
    return picked.length ? picked : ids;
  }, [kids, settings.activeKids]);
  const toggleKid = (id) => {
    const next = activeIds.includes(id) ? activeIds.filter((x) => x !== id) : [...activeIds, id];
    setSettings({ ...settings, activeKids: next.length === kids.length || next.length === 0 ? [] : next });
  };
  const notes = settings.notes ?? {};
  const hiddenSet = useMemo(() => new Set(settings.hidden ?? []), [settings.hidden]);
  const favs = useMemo(() => new Set(settings.favs ?? []), [settings.favs]);

  // 합치기 링크(#import=...)로 열었으면: 이 기기의 찜·숨김·메모에 합침 (지금 있는 내용은 지우지 않음)
  useEffect(() => {
    if (!window.location.hash.startsWith('#import=')) return;
    const r = parseShareHash(window.location.hash);
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    if (r.error) { window.alert(r.error); return; }
    if (!window.confirm('링크에 담긴 찜·숨김·메모를 이 기기에 합칠까요?\n(지금 있는 내용은 지워지지 않아요)')) return;
    setSettings((cur) => ({ ...cur, ...mergeUnion(pickSync(cur), r.settings, { prefs: 'local' }) }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(id);
  }, [toast]);

  // 강좌별 아이마다 학년/대상 판정 (수업 시작일 기준)
  const enriched = useMemo(() => {
    return courses.map((c) => {
      const ref = c.classStart ? new Date(c.classStart) : now;
      const kidMatches = kids.map((kid) => {
        const g = gradeOn(kid.birthYear, ref);
        const age = koreanAge(kid.birthYear, ref);
        return { kid, grade: g, nowGrade: gradeOn(kid.birthYear, now), match: matchTarget(c.targetText, g, age, kid.birthYear) };
      });
      return { course: c, kidMatches, daySet: classWeekdays(c), note: notes[c.id] ?? null };
    });
  }, [courses, kids, now, notes]);

  // 검색어: 강좌명·도서관 이름에서 찾음 (띄어쓰기·대소문자 무시)
  const norm = (x) => (x ?? '').toLowerCase().replace(/\s+/g, '');
  const q = norm(query);
  const matchesKids = (e) => e.kidMatches.some((k) => activeIds.includes(k.kid.id) && k.match.result !== 'nomatch');

  // 상태 탭을 뺀 공통 조건
  const passBase = (e) => {
    const c = e.course;
    if (q && !norm(`${c.title} ${byId[c.libraryId]?.name ?? ''}`).includes(q)) return false;
    const hidden = hiddenSet.has(c.id);
    if (showHidden) return hidden; // 숨긴 것만 보여줌
    if (hidden) return false;
    if (favOnly) return favs.has(c.id); // 찜 목록은 대상·요일 조건과 상관없이 보여줌
    if (!showAllTargets && !matchesKids(e)) return false;
    return passesDays(effDays, e.daySet);
  };
  const statusOk = (e, t) => {
    const st = e.course.status;
    if (t === 'open') return st === 'open';
    if (t === 'upcoming') return st === 'upcoming';
    return st === 'open' || st === 'upcoming' || showClosed || favOnly || showHidden;
  };

  // 조건 + 상태 필터 (도서관/지역 선택 전) → 지도 핀 개수의 기준
  const base = useMemo(
    () => enriched.filter((e) => passBase(e) && statusOk(e, tab)),
    [enriched, tab, showClosed, showAllTargets, effDays, q, favOnly, favs, hiddenSet, showHidden, activeIds], // eslint-disable-line
  );

  const counts = useMemo(() => {
    const m = {};
    base.forEach(({ course }) => { m[course.libraryId] = (m[course.libraryId] ?? 0) + 1; });
    return m;
  }, [base]);

  const tabCounts = useMemo(() => {
    const ok = enriched.filter(passBase);
    return {
      all: ok.filter((e) => statusOk(e, 'all')).length,
      open: ok.filter((e) => e.course.status === 'open').length,
      upcoming: ok.filter((e) => e.course.status === 'upcoming').length,
    };
  }, [enriched, showClosed, showAllTargets, effDays, q, favOnly, favs, hiddenSet, showHidden, activeIds]); // eslint-disable-line

  const list = useMemo(() => {
    const rows = base.filter(({ course }) => {
      const lib = byId[course.libraryId];
      if (region !== 'all' && lib?.region !== region) return false;
      if (selectedLib && course.libraryId !== selectedLib) return false;
      return true;
    });
    const key = {
      applyStart: ({ course: c }) => t(c.applyStart),
      classDate: ({ course: c }) => t(c.classStart),
      drive: ({ course: c }) => byId[c.libraryId]?.driveMin ?? Infinity,
    }[sort];
    return [...rows].sort((a, b) => key(a) - key(b) || t(a.course.classStart) - t(b.course.classStart));
  }, [base, region, selectedLib, sort, byId]);

  const favCount = useMemo(() => courses.filter((c) => favs.has(c.id)).length, [courses, favs]);
  const hiddenCount = useMemo(() => courses.filter((c) => hiddenSet.has(c.id)).length, [courses, hiddenSet]);

  const collectedByLib = useMemo(() => {
    const m = {};
    courses.forEach((c) => { const k = c.libraryId ?? '__none'; m[k] = (m[k] ?? 0) + 1; });
    return m;
  }, [courses]);

  // "관심 없어요": 강좌를 목록과 달력에서 숨김. 찜해 둔 것이면 찜도 풀림
  const hide = (c) => {
    setSettings((s0) => ({ ...s0, hidden: [...new Set([...(s0.hidden ?? []), c.id])], favs: (s0.favs ?? []).filter((x) => x !== c.id) }));
    setToast({ id: c.id, text: `숨겼어요 · ${c.title}` });
  };
  const unhide = (id) => setSettings((s0) => ({ ...s0, hidden: (s0.hidden ?? []).filter((x) => x !== id) }));
  const toggleFav = (id) =>
    setSettings((s0) => ({ ...s0, favs: (s0.favs ?? []).includes(id) ? s0.favs.filter((x) => x !== id) : [...(s0.favs ?? []), id] }));
  const saveNote = (id, note) =>
    setSettings((s0) => {
      const n = { ...(s0.notes ?? {}) };
      if (note) n[id] = note; else delete n[id];
      return { ...s0, notes: n };
    });
  const actionsFor = (c) =>
    showHidden
      ? [{ label: '다시 보이게 하기', onClick: () => unhide(c.id) }]
      : [{ label: '관심 없어요 (숨기기)', onClick: () => hide(c) }];

  const renderCard = ({ course, kidMatches, note }) => (
    <CourseCard
      key={course.id}
      course={course}
      lib={byId[course.libraryId]}
      kidMatches={kidMatches}
      onEditLib={(id) => setEditor({ focusId: id })}
      fav={favs.has(course.id)}
      onToggleFav={() => toggleFav(course.id)}
      note={note}
      onNote={() => setNoteFor(course.id)}
      actions={actionsFor(course)}
    />
  );

  const statusCounts = useMemo(() => {
    const m = {};
    courses.forEach((c) => { m[c.status] = (m[c.status] ?? 0) + 1; });
    return m;
  }, [courses]);

  const STATUS_LABEL = { open: '접수가능', upcoming: '접수예정', waitlist: '대기', closed: '마감' };
  const renderCompact = ({ course, kidMatches, note }) => {
    const time = fmtStartTime(course);
    return (
      <div key={course.id} className="cal-row-wrap">
        <a className={`cal-row ${course.status}`} href={course.url} target="_blank" rel="noopener noreferrer">
          <span className={`badge ${course.status === 'open' ? 'open' : course.status === 'upcoming' ? 'upcoming' : 'closed'}`}>
            {STATUS_LABEL[course.status] ?? ''}
          </span>
          <span className="cal-row-title">{course.title}</span>
          <span className="cal-row-sub">
            {time && `${time} · `}{byId[course.libraryId]?.name ?? ''}
          </span>
          {note?.text && <span className="cal-row-note">📝 {note.text}</span>}
          <span className="cal-row-target">
            대상 {course.targetText || '원문 없음'}
            <KidPills kidMatches={kidMatches} />
          </span>
        </a>
        {/* 링크 바깥에 둔 버튼들: 눌러도 도서관 사이트로 넘어가지 않아요 */}
        <button type="button" className="cal-note" aria-label="메모" title="메모" onClick={() => setNoteFor(course.id)}>
          {note ? '📝' : '✎'}
        </button>
        <button
          type="button"
          className="cal-hide"
          aria-label={showHidden ? '다시 보이게 하기' : '관심 없어요 (숨기기)'}
          title={showHidden ? '다시 보이게 하기' : '관심 없어요 · 이 강좌를 숨겨요'}
          onClick={() => (showHidden ? unhide(course.id) : hide(course))}
        >
          {showHidden ? '↺' : '✕'}
        </button>
      </div>
    );
  };

  const selected = selectedLib ? byId[selectedLib] : null;
  const hasErrors = meta.errors?.length > 0;

  return (
    <div className="app">
      <header className="top">
        <AppSwitcher current="library" title="도서관 강좌" sub="강남구립 · 양재도서관 문화강좌" />
        <button className="grade-chip" onClick={() => setSettingsOpen(true)} aria-label="설정">
          설정{sync.user ? ' ☁' : ''}
        </button>
      </header>

      {meta.isSample && (
        <div className="banner">
          지금 보이는 강좌는 <strong>화면 확인용 샘플</strong>이에요. 실제 도서관 데이터는 아직 연결 전입니다.
        </div>
      )}
      {hasErrors && (
        <div className="banner err">
          일부 정보를 가져오지 못했어요:{' '}
          {meta.errors.map((e) => `${e.source}${e.message ? ` (${e.message})` : ''}`).join(', ')}.
          목록에 빠진 강좌가 있을 수 있어요. 잠시 뒤 다시 확인해 주세요.
        </div>
      )}

      <nav className="filters" aria-label="필터">
        <div className="searchrow">
          <input
            type="search"
            className="search"
            placeholder="강좌명·도서관 검색"
            aria-label="강좌명·도서관 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="button" className={`fav-toggle${favOnly ? ' on' : ''}`} aria-pressed={favOnly} onClick={() => setFavOnly((v) => !v)}>
            {favOnly ? '♥' : '♡'} 찜 {favCount}
          </button>
        </div>

        <div className="tabs" role="tablist">
          {TABS.map((x) => (
            <button
              key={x.id}
              role="tab"
              aria-selected={tab === x.id}
              className={tab === x.id ? 'on' : ''}
              onClick={() => setTab(x.id)}
            >
              {x.label} <span className="n">{tabCounts[x.id]}</span>
            </button>
          ))}
        </div>

        <div className="kids" role="group" aria-label="아이">
          <span className="days-label">아이</span>
          {kids.map((k) => (
            <button
              key={k.id}
              type="button"
              aria-pressed={activeIds.includes(k.id)}
              className={`chip kid${activeIds.includes(k.id) ? ' on' : ''}`}
              onClick={() => toggleKid(k.id)}
            >
              {k.label} · {gradeLabel(gradeOn(k.birthYear, now))}
            </button>
          ))}
        </div>

        <div className="row">
          <div className="seg" role="group" aria-label="지역">
            {REGIONS.map((r) => (
              <button key={r.id} className={region === r.id ? 'on' : ''} onClick={() => setRegion(r.id)}>
                {r.label}
              </button>
            ))}
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="정렬">
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>

        {!phoneCalendar && (
        <div className="days" role="group" aria-label="수업 요일">
          <span className="days-label">수업 요일</span>
          {DAY_ORDER.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={days.includes(d)}
              className={`day${days.includes(d) ? ' on' : ''}${d === 0 ? ' sun' : d === 6 ? ' sat' : ''}`}
              onClick={() => toggleDay(d)}
            >
              {DAY_LABELS[d]}
            </button>
          ))}
          {days.length > 0 && (
            <button type="button" className="link-btn" onClick={() => setSettings({ ...settings, days: [] })}>전체</button>
          )}
        </div>
        )}

        <div className="row checks">
          <label><input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> 접수종료·대기 포함</label>
          <label><input type="checkbox" checked={showAllTargets} onChange={(e) => setShowAllTargets(e.target.checked)} /> 대상 안 맞는 강좌 포함</label>
          {(hiddenCount > 0 || showHidden) && (
            <label><input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} /> 숨긴 것만 보기 ({hiddenCount})</label>
          )}
        </div>

        {selected && (
          <button className="lib-chip" onClick={() => setSelectedLib(null)}>
            {selected.name}만 보는 중 <span aria-hidden>✕</span>
            <span className="sr-only">선택 해제</span>
          </button>
        )}
      </nav>

      <main className="panes">
        <section className="pane-list" hidden={!isDesktop && view !== 'list'}>
          {list.length === 0 ? (
            <div className="empty">
              <h3>조건에 맞는 강좌가 없어요</h3>
              <p>
                수집된 강좌 {courses.length}건 중 지금 조건에 맞는 게 없어요.
                {showHidden && ' 숨긴 강좌가 없어요.'}
                {favOnly && ' 찜한 강좌가 없거나 검색어에 맞는 게 없어요.'}
                {q && ' 검색어를 지워 보세요.'}
                {days.length > 0 && ' 선택한 수업 요일을 해제하면 더 보여요.'}
                {!showAllTargets && !favOnly && ' 위의 "대상 안 맞는 강좌 포함"을 켜면 전체를 볼 수 있어요.'}
              </p>
            </div>
          ) : (
            list.map(renderCard)
          )}
          <details className="foot">
            <summary>도서관별 수집 현황 (총 {courses.length}건)</summary>
            <p>
              {libs.map((l) => `${l.name} ${collectedByLib[l.id] ?? 0}`).join(' · ')}
              {collectedByLib.__none ? ` · 도서관 미분류 ${collectedByLib.__none}` : ''}
            </p>
            <p>
              상태별: 접수중 {statusCounts.open ?? 0} · 접수예정 {statusCounts.upcoming ?? 0} · 대기 {statusCounts.waitlist ?? 0} · 접수마감 {statusCounts.closed ?? 0}
            </p>
            <p>접수예정·접수중·대기·접수마감(수업 전) 강좌를 모두 센 값이에요. 0인 도서관은 지금 해당 강좌가 없거나 수집이 안 된 거예요.</p>
          </details>
          <p className="foot">
            주소·차량 시간은 참고용(미검증) 값이에요. 신청은 각 도서관 사이트에서 직접 하고,
            이 앱은 로그인 정보를 받지 않아요.
          </p>
          {isDesktop && !meta.isSample && meta.fetchedAt && (
            <p className="foot data-stamp">마지막 업데이트 {fmtFetchedAt(meta.fetchedAt)} · 수집된 강좌 {courses.length}건</p>
          )}
        </section>

        {isDesktop ? (
          <div className="pane-right">
            <section className="pane-cal" aria-label="행사일 달력">
              <CalendarView rows={list} renderItem={renderCompact} compact />
            </section>
            <section className="pane-map">
              <MapView counts={counts} selectedId={selectedLib} onSelect={setSelectedLib} />
            </section>
          </div>
        ) : (
          <>
            {view === 'calendar' && (
              <section className="pane-cal-m" aria-label="행사일 달력">
                <CalendarView rows={list} renderItem={renderCard} />
              </section>
            )}
            <section className="pane-map" hidden={view !== 'map'}>
              {view === 'map' && (
                <MapView counts={counts} selectedId={selectedLib} onSelect={setSelectedLib} />
              )}
            </section>
          </>
        )}
      </main>

      {!isDesktop && !meta.isSample && meta.fetchedAt && (
        <p className="foot data-stamp">마지막 업데이트 {fmtFetchedAt(meta.fetchedAt)} · 수집된 강좌 {courses.length}건</p>
      )}

      {!isDesktop && (
        <div className="viewbar">
          <button className={view === 'calendar' ? 'on' : ''} onClick={() => setView('calendar')}>달력</button>
          <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>강좌 목록</button>
          <button className={view === 'map' ? 'on' : ''} onClick={() => setView('map')}>지도 보기</button>
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          <span className="toast-text">{toast.text}</span>
          <button type="button" onClick={() => { unhide(toast.id); setToast(null); }}>되돌리기</button>
        </div>
      )}

      {noteFor && (
        <NoteSheet
          key={noteFor}
          title={courses.find((c) => c.id === noteFor)?.title ?? ''}
          note={notes[noteFor] ?? null}
          onSave={(n) => saveNote(noteFor, n)}
          onClose={() => setNoteFor(null)}
        />
      )}

      {settingsOpen && (
        <Settings
          settings={settings}
          setSettings={setSettings}
          now={now}
          sync={sync}
          onClose={() => setSettingsOpen(false)}
          onOpenLibs={() => { setSettingsOpen(false); setEditor({ focusId: null }); }}
        />
      )}

      {editor && (
        <LibraryEditor
          libs={libs}
          focusId={editor.focusId}
          onFocus={(id) => setEditor({ focusId: id })}
          onChange={L.update}
          onReset={L.reset}
          onResetAll={L.resetAll}
          exportJson={L.exportJson}
          importJson={L.importJson}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}
