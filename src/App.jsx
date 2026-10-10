import { useEffect, useMemo, useState } from 'react';
import { REGIONS } from './data/libraries';
import { gradeOn, koreanAge, gradeLabel, matchTarget, academicYear } from './lib/grade';
import { fmtFetchedAt } from './lib/format';
import { useSettings } from './lib/useSettings';
import { useCourses } from './lib/useCourses';
import { useLibraries } from './lib/useLibraries';
import { DAY_LABELS, DAY_ORDER, classWeekdays, passesDays } from './lib/weekdays';
import CourseCard from './components/CourseCard';
import MapView from './components/MapView';
import Settings from './components/Settings';
import LibraryEditor from './components/LibraryEditor';

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
  const isDesktop = useMedia('(min-width: 900px)');

  const [tab, setTab] = useState('all');
  const [region, setRegion] = useState('all');
  const [sort, setSort] = useState('applyStart');
  const [view, setView] = useState('list');
  const [selectedLib, setSelectedLib] = useState(null);
  const [showClosed, setShowClosed] = useState(false);
  const [showAllTargets, setShowAllTargets] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editor, setEditor] = useState(null); // null | { focusId: string | null }
  const days = settings.days ?? [];
  const toggleDay = (d) =>
    setSettings({ ...settings, days: days.includes(d) ? days.filter((x) => x !== d) : [...days, d] });

  const now = useMemo(() => new Date(), []);
  const currentGrade = settings.gradeOverride ?? gradeOn(settings.birthYear, now);

  // 강좌별 학년/대상 판정 (수업 시작일 기준)
  const enriched = useMemo(() => {
    return courses.map((c) => {
      const ref = c.classStart ? new Date(c.classStart) : now;
      const gradeAtClass = settings.gradeOverride ?? gradeOn(settings.birthYear, ref);
      const age = settings.gradeOverride ? gradeAtClass + 7 : koreanAge(settings.birthYear, ref);
      const birth = settings.gradeOverride
        ? academicYear(ref) - gradeAtClass - 6
        : settings.birthYear;
      return {
        course: c,
        gradeAtClass,
        match: matchTarget(c.targetText, gradeAtClass, age, birth),
        daySet: classWeekdays(c),
      };
    });
  }, [courses, settings, now]);

  // 대상 + 상태 필터 (도서관/지역 선택 전) → 지도 핀 개수의 기준
  const base = useMemo(() => {
    return enriched.filter(({ course, match, daySet }) => {
      if (!showAllTargets && match.result === 'nomatch') return false;
      if (!passesDays(days, daySet)) return false;
      const s = course.status;
      if (tab === 'open') return s === 'open';
      if (tab === 'upcoming') return s === 'upcoming';
      return s === 'open' || s === 'upcoming' || showClosed;
    });
  }, [enriched, tab, showClosed, showAllTargets, days]);

  const counts = useMemo(() => {
    const m = {};
    base.forEach(({ course }) => { m[course.libraryId] = (m[course.libraryId] ?? 0) + 1; });
    return m;
  }, [base]);

  const tabCounts = useMemo(() => {
    const ok = enriched.filter(
      (e) => (showAllTargets || e.match.result !== 'nomatch') && passesDays(days, e.daySet),
    );
    return {
      all: ok.filter((e) => ['open', 'upcoming'].includes(e.course.status) || showClosed).length,
      open: ok.filter((e) => e.course.status === 'open').length,
      upcoming: ok.filter((e) => e.course.status === 'upcoming').length,
    };
  }, [enriched, showClosed, showAllTargets, days]);

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

  const collectedByLib = useMemo(() => {
    const m = {};
    courses.forEach((c) => { const k = c.libraryId ?? '__none'; m[k] = (m[k] ?? 0) + 1; });
    return m;
  }, [courses]);

  const selected = selectedLib ? byId[selectedLib] : null;
  const showMap = isDesktop || view === 'map';
  const hasErrors = meta.errors?.length > 0;

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>도서관 강좌</h1>
          <p className="sub">강남구립 · 양재도서관 문화강좌</p>
        </div>
        <button className="grade-chip" onClick={() => setSettingsOpen(true)}>
          {gradeLabel(currentGrade)}
          <small>{settings.gradeOverride ? '직접 선택' : `${settings.birthYear}년생`}</small>
        </button>
      </header>

      {meta.isSample && (
        <div className="banner">
          지금 보이는 강좌는 <strong>화면 확인용 샘플</strong>이에요. 실제 도서관 데이터는 아직 연결 전입니다.
        </div>
      )}
      {!meta.isSample && meta.fetchedAt && (
        <div className="banner ok">
          마지막 업데이트 {fmtFetchedAt(meta.fetchedAt)} · 수집된 강좌 {courses.length}건
        </div>
      )}
      {hasErrors && (
        <div className="banner err">
          일부 도서관 정보를 가져오지 못했어요:{' '}
          {meta.errors.map((e) => `${e.source}${e.message ? ` (${e.message})` : ''}`).join(', ')}.
          해당 도서관 강좌는 표시되지 않아요.
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

        <div className="row checks">
          <label><input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> 접수종료·대기 포함</label>
          <label><input type="checkbox" checked={showAllTargets} onChange={(e) => setShowAllTargets(e.target.checked)} /> 대상 안 맞는 강좌 포함</label>
        </div>
      </nav>

      <main className={`panes ${showMap ? 'map-on' : ''}`}>
        <section className="pane-list" hidden={!isDesktop && view !== 'list'}>
          {selected && (
            <button className="lib-chip" onClick={() => setSelectedLib(null)}>
              {selected.name} <span aria-hidden>✕</span>
              <span className="sr-only">선택 해제</span>
            </button>
          )}
          {list.length === 0 ? (
            <div className="empty">
              <h3>조건에 맞는 강좌가 없어요</h3>
              <p>
                수집된 강좌 {courses.length}건 중 지금 조건에 맞는 게 없어요.
                {days.length > 0 && ' 선택한 수업 요일을 해제하면 더 보여요.'}
                {!showAllTargets && ' 아래 "대상 안 맞는 강좌 포함"을 켜면 전체를 볼 수 있어요.'}
              </p>
            </div>
          ) : (
            list.map(({ course, match, gradeAtClass }) => (
              <CourseCard
                key={course.id}
                course={course}
                lib={byId[course.libraryId]}
                match={match}
                gradeAtClass={gradeAtClass}
                currentGrade={currentGrade}
                onEditLib={(id) => setEditor({ focusId: id })}
              />
            ))
          )}
          <details className="foot">
            <summary>도서관별 수집 현황 (총 {courses.length}건)</summary>
            <p>
              {libs.map((l) => `${l.name} ${collectedByLib[l.id] ?? 0}`).join(' · ')}
              {collectedByLib.__none ? ` · 도서관 미분류 ${collectedByLib.__none}` : ''}
            </p>
            <p>접수예정·접수중·대기·접수마감(수업 전) 강좌를 모두 센 값이에요. 0인 도서관은 지금 해당 강좌가 없거나 수집이 안 된 거예요.</p>
          </details>
          <p className="foot">
            주소·차량 시간은 참고용(미검증) 값이에요. 신청은 각 도서관 사이트에서 직접 하고,
            이 앱은 로그인 정보를 받지 않아요.
          </p>
        </section>

        <section className="pane-map" hidden={!isDesktop && view !== 'map'}>
          {(isDesktop || view === 'map') && (
            <MapView counts={counts} selectedId={selectedLib} onSelect={setSelectedLib} />
          )}
        </section>
      </main>

      {!isDesktop && (
        <div className="viewbar">
          <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>강좌 목록</button>
          <button className={view === 'map' ? 'on' : ''} onClick={() => setView('map')}>지도 보기</button>
        </div>
      )}

      {settingsOpen && (
        <Settings
          settings={settings}
          setSettings={setSettings}
          currentGrade={gradeOn(settings.birthYear, now)}
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
