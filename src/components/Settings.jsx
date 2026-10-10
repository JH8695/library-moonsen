import { gradeLabel } from '../lib/grade';

export default function Settings({ settings, setSettings, currentGrade, onClose, onOpenLibs }) {
  const years = [];
  for (let y = 2010; y <= 2023; y++) years.push(y);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="설정" onClick={(e) => e.stopPropagation()}>
        <h2>우리 아이 설정</h2>

        <label className="field">
          <span>출생연도</span>
          <select
            value={settings.birthYear}
            onChange={(e) => setSettings({ ...settings, birthYear: Number(e.target.value) })}
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}년생</option>
            ))}
          </select>
        </label>
        <p className="hint">
          지금 학년: <strong>{gradeLabel(currentGrade)}</strong> (3월 기준으로 학년이 올라가요).
          각 강좌는 <strong>수업이 시작하는 날의 학년</strong>으로 판단해요.
        </p>

        <label className="field">
          <span>학년 직접 선택</span>
          <select
            value={settings.gradeOverride ?? ''}
            onChange={(e) =>
              setSettings({ ...settings, gradeOverride: e.target.value ? Number(e.target.value) : null })
            }
          >
            <option value="">출생연도로 자동 계산</option>
            {[1, 2, 3, 4, 5, 6].map((g) => (
              <option key={g} value={g}>초{g}로 고정해서 보기</option>
            ))}
          </select>
        </label>

        <button className="outline" onClick={onOpenLibs}>도서관 정보 수정 (차 시간 · 지하철역 · 동)</button>

        <p className="hint">설정은 이 기기의 브라우저에만 저장되고 어디로도 전송되지 않아요.</p>
        <button className="primary" onClick={onClose}>닫기</button>
      </div>
    </div>
  );
}
