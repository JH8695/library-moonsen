import { fmtClassSchedule, fmtDateTime, daysUntil } from '../lib/format';
import { gradeLabel } from '../lib/grade';

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

// 아이별 대상 여부 (수업 시작일의 학년이 지금과 다르면 학년도 같이 보여줌)
export function KidPills({ kidMatches }) {
  return (
    <span className="kid-pills">
      {kidMatches.map(({ kid, grade, nowGrade, match }) => {
        const mark = match.result === 'match' ? '✓' : match.result === 'check' ? '?' : '✕';
        const title = match.result === 'match' ? '대상에 해당' : match.result === 'check' ? '대상 확인 필요' : '대상이 아님';
        const differs = grade !== nowGrade;
        return (
          <span key={kid.id} className={`kid-pill ${match.result}`} title={title}>
            {mark} {kid.label}{differs ? ` · ${gradeLabel(grade)}` : ''}
          </span>
        );
      })}
    </span>
  );
}

export default function CourseCard({ course, lib, kidMatches, onEditLib, fav, onToggleFav, note, onNote, actions }) {
  const st = STATUS[course.status] ?? STATUS.closed;
  const dday = course.status === 'upcoming' && course.applyStart ? daysUntil(course.applyStart) : null;
  const tags = [...new Set(kidMatches.flatMap((k) => k.match.tags ?? []))];
  const anyCheck = kidMatches.some((k) => k.match.result === 'check');

  return (
    <article className={`card ${st.cls}`}>
      <div className="card-top">
        <span className={`badge ${st.cls}`}>{st.label}</span>
        {onNote && (
          <button type="button" className={`note-btn${note ? ' has' : ''}`} onClick={onNote} aria-label={note ? '메모 보기·수정' : '메모 추가'}>
            📝 메모
          </button>
        )}
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
        {onToggleFav && (
          <button type="button" className={`heart${fav ? ' on' : ''}`} aria-pressed={!!fav} aria-label={fav ? '찜 해제' : '찜하기'} onClick={onToggleFav}>
            {fav ? '♥' : '♡'}
          </button>
        )}
      </div>

      <h3 className="card-title">{course.title}</h3>

      <div className="card-lib">
        <strong>{lib?.name ?? course.libraryId}</strong>
        <DriveInfo lib={lib} onEdit={onEditLib} />
      </div>

      {note?.text && <p className="note-line">📝 {note.text}</p>}

      <dl className="rows">
        <div>
          <dt>대상</dt>
          <dd>
            {course.targetText || '원문 없음'}
            <KidPills kidMatches={kidMatches} />
            {anyCheck && <span className="pill warn">대상 확인 필요</span>}
            {tags.map((t) => (
              <span className="pill" key={t}>{t}</span>
            ))}
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

      <a className="apply" href={course.url} target="_blank" rel="noopener noreferrer">
        도서관 사이트에서 보기·신청
      </a>

      {actions?.length > 0 && (
        <div className="card-foot">
          {actions.map((a) => (
            <button key={a.label} type="button" className="hide-btn" onClick={a.onClick}>{a.label}</button>
          ))}
        </div>
      )}
    </article>
  );
}
