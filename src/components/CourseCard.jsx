import { fmtClassSchedule, fmtDateTime, daysUntil } from '../lib/format';
import { gradeOn, stageLabel } from '../lib/grade';

const STATUS = {
  open: { label: '접수가능', cls: 'open' },
  upcoming: { label: '접수예정', cls: 'upcoming' },
  waitlist: { label: '대기접수', cls: 'closed' },
  closed: { label: '접수종료', cls: 'closed' },
};

export function DriveInfo({ lib, onEdit }) {
  if (!lib) return null;
  return (
    <span className="meta-line">
      {lib.driveMin != null ? (
        <span title={lib.driveRange && !lib.edited ? `참고 범위 ${lib.driveRange[0]}~${lib.driveRange[1]}분 (미검증)` : ''}>
          🚗 약 {lib.driveMin}분
        </span>
      ) : (
        <span className="muted">🚗 시간 미입력</span>
      )}
      {lib.station && (
        <span>🚇 {lib.station.name}{lib.station.walkMin != null ? ` 도보 ${lib.station.walkMin}분` : ''}</span>
      )}
      {lib.dong && <span>📍 {lib.dong}</span>}
      {onEdit && (
        <button type="button" className="edit-mini" onClick={() => onEdit(lib.id)} aria-label={`${lib.name} 차 시간·역·동 수정`}>
          수정
        </button>
      )}
    </span>
  );
}

export default function CourseCard({ course, lib, match, kidResults = [], onEditLib, isHidden = false, onToggleHide }) {
  const st = STATUS[course.status] ?? STATUS.closed;
  const dday =
    course.status === 'upcoming' && course.applyStart ? daysUntil(course.applyStart) : null;
  const now = new Date();

  return (
    <article className={`card ${st.cls}${isHidden ? ' is-hidden' : ''}`}>
      <div className="card-top">
        <span className={`badge ${st.cls}`}>{st.label}</span>
        {dday != null && dday >= 0 && (
          <span className="dday">{dday === 0 ? '오늘 접수 시작' : `${dday}일 뒤 접수 시작`}</span>
        )}
        <span className="grow" />
        {course.capacity != null && (
          <span className="count">
            {course.applied != null ? `${course.applied}/${course.capacity}명` : `정원 ${course.capacity}명`}
            {course.waitCapacity ? ` (대기 ${course.waitApplied ?? 0}/${course.waitCapacity})` : ''}
          </span>
        )}
      </div>

      <h3 className="card-title">{course.title}</h3>

      <div className="card-lib">
        <strong>{lib?.name ?? course.libraryId}</strong>
        <DriveInfo lib={lib} onEdit={onEditLib} />
      </div>

      <dl className="rows">
        <div>
          <dt>대상</dt>
          <dd>
            {course.targetText || '원문 없음'}
            {match.result === 'check' && <span className="pill warn">대상 확인 필요</span>}
            {match.tags.map((t) => (
              <span className="pill" key={t}>{t}</span>
            ))}
            {kidResults.map(({ kid, match: m, gradeAtClass }) => {
              const mark = m.result === 'match' ? '✓' : m.result === 'check' ? '?' : '✗';
              const tone = m.result === 'match' ? 'ok' : m.result === 'check' ? 'maybe' : 'no';
              const nowG = gradeOn(kid.birthYear, now);
              // 수업이 시작될 때 학년이 달라지면(3월 이후 수업 등) 표시
              const shift = gradeAtClass !== nowG ? ` · 수업일 ${stageLabel(gradeAtClass)}` : '';
              const tip = `${kid.name}: ${m.result === 'match' ? '대상' : m.result === 'check' ? '대상 확인 필요' : '대상 아님'} (수업일 기준 ${stageLabel(gradeAtClass)})`;
              return (
                <span key={kid.id} className={`kid-chip ${tone}`} title={tip}>
                  {mark} {kid.name}{shift}
                </span>
              );
            })}
          </dd>
        </div>
        <div>
          <dt>수업</dt>
          <dd>{fmtClassSchedule(course)}</dd>
        </div>
        <div>
          <dt>접수</dt>
          <dd>
            {course.applyStart ? fmtDateTime(course.applyStart) : '?'}
            {' ~ '}
            {course.applyEnd ? fmtDateTime(course.applyEnd) : '?'}
          </dd>
        </div>
      </dl>
      {course.sourceNote && <p className="src-note">{course.sourceNote}</p>}

      <a className="apply" href={course.url} target="_blank" rel="noopener noreferrer">
        도서관 사이트에서 보기·신청
      </a>
      {onToggleHide && (
        <button type="button" className="hide-link" onClick={() => onToggleHide(course.id)}>
          {isHidden ? '숨김 해제 (다시 보기)' : '관심 없어요 (숨기기)'}
        </button>
      )}
    </article>
  );
}
