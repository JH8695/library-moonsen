// 도서관 선택 (여러 곳 체크). 체크 = 보기에 포함. 기본은 전부 체크(= 전체).
// 저장은 "빼 둔 도서관" 목록으로 해서, 새 도서관이 추가돼도 자동으로 포함돼요.
const GROUP = { gangnam: '강남구립', seocho: '양재', national: '국립' };

export default function LibraryPicker({ libs, excluded, counts, onChange, onClose }) {
  const ex = new Set(excluded);
  // 가까운 순(차 시간) → 시간 모르는 곳은 뒤로
  const sorted = [...libs].sort(
    (a, b) => (a.driveMin ?? 999) - (b.driveMin ?? 999) || a.name.localeCompare(b.name, 'ko'),
  );
  const toggle = (id) => onChange(ex.has(id) ? excluded.filter((x) => x !== id) : [...excluded, id]);
  const groupOf = (l) => (l.id === 'nlcy' ? GROUP.national : GROUP[l.region] ?? '');

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet tall" role="dialog" aria-label="도서관 선택" onClick={(e) => e.stopPropagation()}>
        <div className="ed-top">
          <h2>도서관 선택</h2>
          <button className="link-btn" onClick={onClose}>닫기</button>
        </div>
        <p className="hint">체크한 도서관의 강좌만 목록·달력·지도에 보여요. 가까운 순으로 정렬돼 있어요.</p>
        <div className="acct-btns">
          <button className="outline" onClick={() => onChange([])}>전체 선택</button>
          <button className="outline" onClick={() => onChange(libs.map((l) => l.id))}>모두 해제</button>
        </div>
        <div className="pick-list">
          {sorted.map((l) => (
            <label key={l.id} className={`pick-row${ex.has(l.id) ? ' off' : ''}`}>
              <input type="checkbox" checked={!ex.has(l.id)} onChange={() => toggle(l.id)} />
              <span className="pick-name">{l.name}</span>
              <span className="pick-meta">
                {groupOf(l)}
                {l.driveMin != null ? ` · 🚗 ${l.driveMin}분` : ''}
              </span>
              <span className="pick-n">{counts[l.id] ?? 0}</span>
            </label>
          ))}
        </div>
        <button className="primary" onClick={onClose}>확인</button>
      </div>
    </div>
  );
}
