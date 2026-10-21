import { useEffect, useMemo, useState } from 'react';
import { gradeOn, koreanAge, matchTarget } from './lib/grade';
import { fmtFetchedAt, fmtStartTime } from './lib/format';
import { useSettings, pickPrefs } from './lib/useSettings';
import { useCourses } from './lib/useCourses';
import { useLibraries } from './lib/useLibraries';
import { useHidden } from './lib/useHidden';
import { useCloudSync } from './lib/useCloudSync';
import { DAY_LABELS, DAY_ORDER, classWeekdays, passesDays } from './lib/weekdays';
import CourseCard from './components/CourseCard';
import MapView from './components/MapView';
import Settings from './components/Settings';
import LibraryEditor from './components/LibraryEditor';
import LibraryPicker from './components/LibraryPicker';
import CalendarView from './components/CalendarView';

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
  const [settings, setSettings] = useSettings();
  const { courses, meta } = useCourses();
  const L = useLibraries();
  const { libs, byId } = L;
  const H = useHidden();
  const cloud = useCloudSync({
    hidden: [H.hidden, H.setHidden],
    prefs: [settings, (v) => setSettings((prev) => ({ ...prev, ...pickPrefs(v) }))],
    libs: [L.overrides, L.setOverrides],
  });
  const isDesktop = useMedia('(min-width: 900px)');

  const [tab, setTab] = useState('all');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sort, setSort] = useState('applyStart');
  const [view, setView] = useState('calendar'); // 폰 하단 탭: calendar | list | map (PC는 사용 안 함)
  const [selectedLib, setSelectedLib] = useState(null);
  const [showClosed, setShowClosed] = useState(false);
  const [showAllTargets, setShowAllTargets] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editor, setEditor] = useState(null); // null | { focusId: string | null }
  const days = settings.days ?? [];
  const phoneCalendar = !isDesktop && view === 'calendar';
  const effDays = useMemo(() => (phoneCalendar ? [] : days), [phoneCalendar, days]);
  const toggleDay = (d) =>
    setSettings({ ...settings, days: days.includes(d) ? days.filter((x) => x !== d) : [...days, d] });

  const now = useMemo(() => new Date(), []);
  const kids = settings.kids;
  const exLibs = settings.exLibs ?? [];
  const exSet = useMemo(() => new Set(exLibs), [exLibs]);

  // 강좌별·아이별 대상 판정 (수업 시작일 기준 학년). 한 명이라도 해당이면 해당, 아니면 확인 필요, 아니면 비해당.
  const enriched = useMemo(() => {
    return courses.map((c) => {
      const ref = c.classStart ? new Date(c.classStart) : now;
      const kidResults = kids.map((kid) => {
        const gradeAtClass = gradeOn(kid.birthYear, ref);
        const age = koreanAge(kid.birthYear, ref);
        return { kid, gradeAtClass, match: matchTarget(c.targetText, gradeAtClass, age, kid.birthYear) };
      });
      const result = kidResults.some((r) => r.match.result === 'match')
        ? 'match'
        : kidResults.some((r) => r.match.result === 'check')
        ? 'check'
        : 'nomatch';
      const tags = [...new Set(kidResults.flatMap((r) => r.match.tags))];
      return { course: c, kidResults, match: { result, tags }, daySet: classWeekdays(c) };
    });
  }, [courses, kids, now]);

  // 대상 + 상태 필터 (도서관/지역 선택 전) → 지도 핀 개수의 기준
  const base = useMemo(() => {
    return enriched.filter(({ course, match, daySet }) => {
      if (!showAllTargets && match.result === 'nomatch') return false;
      if (!showHidden && H.hidden[course.id]) return false;
      if (!passesDays(effDays, daySet)) return false;
      const s = course.status;
      if (tab === 'open') return s === 'open';
      if (tab === 'upcoming') return s === 'upcoming';
      return s === 'open' || s === 'upcoming' || showClosed;
    });
  }, [enriched, tab, showClosed, showAllTargets, showHidden, H.hidden, effDays]);

  // 도서관 선택 창에 보여줄 도서관별 강좌 수 (도서관 선택 전 기준)
  const baseCounts = useMemo(() => {
    const m = {};
    base.forEach(({ course }) => { m[course.libraryId] = (m[course.libraryId] ?? 0) + 1; });
    return m;
  }, [base]);

  // 고른 도서관만 남긴 목록 → 목록·달력·지도 핀·탭 숫자가 모두 같은 기준
  const baseSel = useMemo(() => base.filter(({ course }) => !exSet.has(course.libraryId)), [base, exSet]);

  const counts = useMemo(() => {
    const m = {};
    baseSel.forEach(({ course }) => { m[course.libraryId] = (m[course.libraryId] ?? 0) + 1; });
    return m;
  }, [baseSel]);

  const tabCounts = useMemo(() => {
    const ok = enriched.filter(
      (e) =>
        (showAllTargets || e.match.result !== 'nomatch') &&
        (showHidden || !H.hidden[e.course.id]) &&
        !exSet.has(e.course.libraryId) &&
        passesDays(effDays, e.daySet),
    );
    return {
      all: ok.filter((e) => ['open', 'upcoming'].includes(e.course.status) || showClosed).length,
      open: ok.filter((e) => e.course.status === 'open').length,
      upcoming: ok.filter((e) => e.course.status === 'upcoming').length,
    };
  }, [enriched, showClosed, showAllTargets, showHidden, H.hidden, effDays, exSet]);

  const list = useMemo(() => {
    const rows = baseSel.filter(({ course }) => !selectedLib || course.libraryId === selectedLib);
    const key = {
      applyStart: ({ course: c }) => t(c.applyStart),
      classDate: ({ course: c }) => t(c.classStart),
      drive: ({ course: c }) => byId[c.libraryId]?.driveMin ?? Infinity,
    }[sort];
    return [...rows].sort((a, b) => key(a) - key(b) || t(a.course.classStart) - t(b.course.classStart));
  }, [baseSel, selectedLib, sort, byId]);

  const collectedByLib = useMemo(() => {
    const m = {};
    courses.forEach((c) => { const k = c.libraryId ?? '__none'; m[k] = (m[k] ?? 0) + 1; });
    return m;
  }, [courses]);

  const hiddenCount = useMemo(() => courses.filter((c) => H.hidden[c.id]).length, [courses, H.hidden]);
  const toggleHide = (id) => (H.hidden[id] ? H.unhide(id) : H.hide(id));

  const renderCard = ({ course, match, kidResults }) => (
    <CourseCard
      key={course.id}
      course={course}
      lib={byId[course.libraryId]}
      match={match}
      kidResults={kidResults}
      onEditLib={(id) => setEditor({ focusId: id })}
      isHidden={!!H.hidden[course.id]}
      onToggleHide={toggleHide}
    />
  );

  const statusCounts = useMemo(() => {
    const m = {};
    courses.forEach((c) => { m[c.status] = (m[c.status] ?? 0) + 1; });
    return m;
  }, [courses]);

  const STATUS_LABEL = { open: '접수가능', upcoming: '접수예정', waitlist: '대기', closed: '마감' };
  const renderCompact = ({ course }) => {
    const time = fmtStartTime(course);
    const hid = !!H.hidden[course.id];
    return (
      <div key={course.id} className={`cal-row ${course.status}${hid ? ' is-hidden' : ''}`}>
        <a className="cal-row-main" href={course.url} target="_blank" rel="noopener noreferrer">
          <span className={`badge ${course.status === 'open' ? 'open' : course.status === 'upcoming' ? 'upcoming' : 'closed'}`}>
            {STATUS_LABEL[course.status] ?? ''}
          </span>
          <span className="cal-row-title">{course.title}</span>
          <span className="cal-row-sub">
            {time && `${time} · `}{byId[course.libraryId]?.name ?? ''}
          </span>
        </a>
        <button
          type="button"
          className="cal-hide"
          onClick={() => toggleHide(course.id)}
          aria-label={hid ? '숨김 해제' : '숨기기'}
          title={hid ? '숨김 해제' : '관심 없어요 (숨기기)'}
        >
          {hid ? '↺' : '✕'}
        </button>
      </div>
    );
  };

  const selected = selectedLib ? byId[selectedLib] : null;
  const hasErrors = meta.errors?.length > 0;

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>도서관 강좌</h1>
          <p className="sub">강남구립 · 양재도서관 문화강좌</p>
        </div>
        <div className="top-right">
          {cloud.configured && (
            <button
              className={`icon-btn sync ${cloud.status}`}
              onClick={() => setSettingsOpen(true)}
              aria-label={`동기화: ${cloud.status === 'synced' ? '동기화됨' : cloud.status === 'error' ? '오류' : cloud.status === 'signedOut' ? '로그인 필요' : '연결 중'}`}
              title={cloud.status === 'synced' ? '동기화됨' : cloud.status === 'error' ? '동기화 오류' : cloud.status === 'signedOut' ? '로그인하면 폰·PC가 연동돼요' : '연결 중…'}
            >
              ☁<i className="sync-dot" />
            </button>
          )}
          <button className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="설정" title="설정">⚙</button>
        </div>
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

        <div className="row">
          <button type="button" className="lib-pick" onClick={() => setPickerOpen(true)}>
            {exLibs.length === 0 ? '도서관 전체' : `도서관 ${libs.length - exLibs.length}/${libs.length}곳`} ▾
          </button>
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
            <label><input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} /> 숨긴 강좌 다시 보기 ({hiddenCount})</label>
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
                {days.length > 0 && ' 선택한 수업 요일을 해제하면 더 보여요.'}
                {!showAllTargets && ' 위의 "대상 안 맞는 강좌 포함"을 켜면 전체를 볼 수 있어요.'}
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

      {!meta.isSample && meta.fetchedAt && (
        <footer className="updated">
          마지막 업데이트 {fmtFetchedAt(meta.fetchedAt)} · 수집된 강좌 {courses.length}건
        </footer>
      )}

      {!isDesktop && (
        <div className="viewbar">
          <button className={view === 'calendar' ? 'on' : ''} onClick={() => setView('calendar')}>달력</button>
          <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>강좌 목록</button>
          <button className={view === 'map' ? 'on' : ''} onClick={() => setView('map')}>지도 보기</button>
        </div>
      )}

      {settingsOpen && (
        <Settings
          settings={settings}
          setSettings={setSettings}
          hiddenTotal={Object.keys(H.hidden).length}
          onUnhideAll={() => H.setHidden({})}
          onClose={() => setSettingsOpen(false)}
          onOpenLibs={() => { setSettingsOpen(false); setEditor({ focusId: null }); }}
          account={cloud}
        />
      )}

      {pickerOpen && (
        <LibraryPicker
          libs={libs}
          excluded={exLibs}
          counts={baseCounts}
          onChange={(next) => setSettings({ ...settings, exLibs: next })}
          onClose={() => setPickerOpen(false)}
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
