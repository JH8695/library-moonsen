import { useState } from 'react';

function Row({ lib, onChange, onReset }) {
  const station = lib.station?.name ?? '';
  const walk = lib.station?.walkMin ?? '';
  const setNum = (key) => (e) => onChange(lib.id, { [key]: e.target.value === '' ? null : Number(e.target.value) });
  const setText = (key) => (e) => onChange(lib.id, { [key]: e.target.value });
  return (
    <div className="ed-row">
      <div className="ed-head">
        <strong>{lib.name}</strong>
        {lib.edited && <span className="pill">수정함</span>}
        <span className="grow" />
        {lib.edited && <button className="link-btn" onClick={() => onReset(lib.id)}>기본값으로</button>}
      </div>
      <div className="ed-grid">
        <label>
          <span>🚗 차로 (분)</span>
          <input type="number" inputMode="numeric" min="0" value={lib.driveMin ?? ''} onChange={setNum('driveMin')} placeholder="예: 15" />
        </label>
        <label>
          <span>📍 동 이름</span>
          <input type="text" value={lib.dong ?? ''} onChange={setText('dong')} placeholder="예: 논현2동" />
        </label>
        <label>
          <span>🚇 지하철역</span>
          <input type="text" value={station} onChange={setText('stationName')} placeholder="예: 학동역" />
        </label>
        <label>
          <span>도보 (분)</span>
          <input type="number" inputMode="numeric" min="0" value={walk} onChange={setNum('walkMin')} placeholder="예: 10" disabled={!station} />
        </label>
      </div>
    </div>
  );
}

export default function LibraryEditor({ libs, focusId, onFocus, onChange, onReset, onResetAll, exportJson, importJson, onClose }) {
  const [q, setQ] = useState('');
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const shown = focusId
    ? libs.filter((l) => l.id === focusId)
    : libs.filter((l) => !q || l.name.includes(q) || (l.dong ?? '').includes(q));

  const copy = async () => {
    const json = exportJson();
    try { await navigator.clipboard.writeText(json); setMsg('복사했어요. 다른 기기에서 "붙여넣어 적용"을 누르세요.'); }
    catch { setText(json); setMsg('아래 칸의 내용을 직접 복사하세요.'); }
  };
  const apply = () => {
    const err = importJson(text);
    setMsg(err ?? '적용했어요.');
    if (!err) setText('');
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet tall" role="dialog" aria-label="도서관 정보 수정" onClick={(e) => e.stopPropagation()}>
        <div className="ed-top">
          <h2>도서관 정보 수정</h2>
          <button className="link-btn" onClick={onClose}>닫기</button>
        </div>
        <p className="hint">
          차 시간·가까운 역·동 이름을 직접 고칠 수 있어요. 고친 값은 이 기기에만 저장돼요.
          {' '}기본 차 시간은 미검증 참고값이에요.
        </p>

        {focusId ? (
          <button className="lib-chip" onClick={() => onFocus(null)}>모든 도서관 보기</button>
        ) : (
          <input className="ed-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="도서관·동 이름 검색" />
        )}

        <div className="ed-list">
          {shown.map((l) => (
            <Row key={l.id} lib={l} onChange={onChange} onReset={onReset} />
          ))}
          {shown.length === 0 && <p className="hint">검색 결과가 없어요.</p>}
        </div>

        {!focusId && (
          <details className="ed-backup">
            <summary>다른 기기(PC↔폰)로 옮기기 · 전체 초기화</summary>
            <div className="ed-backup-body">
              <button className="primary" onClick={copy}>수정한 내용 복사</button>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="다른 기기에서 복사한 내용을 여기에 붙여넣기" />
              <button className="primary" onClick={apply} disabled={!text.trim()}>붙여넣어 적용</button>
              <button className="link-btn danger" onClick={() => { if (confirm('수정한 내용을 모두 지우고 기본값으로 되돌릴까요?')) onResetAll(); }}>전체 기본값으로 되돌리기</button>
              {msg && <p className="hint">{msg}</p>}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
