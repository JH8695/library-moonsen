import { useState } from 'react';
import { gradeOn, stageLabel } from '../lib/grade';
import { MAX_KIDS } from '../lib/useSettings';

const thisYear = new Date().getFullYear();
const YEARS = [];
for (let y = thisYear; y >= thisYear - 19; y--) YEARS.push(y);

const timeText = (d) =>
  d ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: 'numeric', minute: '2-digit' }).format(d) : '';

export default function Settings({ settings, setSettings, onClose, onOpenLibs, account, hiddenTotal, onUnhideAll, onImportKids }) {
  const [kidMsg, setKidMsg] = useState('');
  const kids = settings.kids;
  const now = new Date();
  const setKids = (next) => setSettings({ ...settings, kids: next });
  const update = (id, patch) => setKids(kids.map((k) => (k.id === id ? { ...k, ...patch } : k)));
  const add = () => {
    if (kids.length >= MAX_KIDS) return;
    setKids([...kids, { id: `k${Date.now().toString(36)}`, name: `아이${kids.length + 1}`, birthYear: thisYear - 6 }]);
  };
  const remove = (id) => {
    if (kids.length <= 1) return;
    setKids(kids.filter((k) => k.id !== id));
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet tall" role="dialog" aria-label="설정" onClick={(e) => e.stopPropagation()}>
        <div className="ed-top">
          <h2>우리 아이 설정</h2>
          <button className="link-btn" onClick={onClose}>닫기</button>
        </div>

        {account && (
          <section className="acct" aria-label="폰·PC 동기화">
            <h3>☁ 폰·PC 동기화 (Google)</h3>
            {!account.configured ? (
              <p className="hint">Firebase 설정이 없어서 로그인 기능이 꺼져 있어요. 설정은 이 기기에서만 저장돼요.</p>
            ) : account.user ? (
              <>
                <p className="acct-who">
                  <strong>{account.user.name || '로그인됨'}</strong> <span>{account.user.email}</span>
                </p>
                <p className="hint">
                  {account.status === 'synced'
                    ? `동기화됨${account.lastSyncedAt ? ` · ${timeText(account.lastSyncedAt)}` : ''}`
                    : account.status === 'error' ? '동기화 오류' : '연결 중…'}
                </p>
                <div className="acct-btns">
                  <button className="outline" onClick={account.syncNow}>지금 동기화</button>
                  <button className="outline" onClick={account.signOut}>로그아웃</button>
                </div>
              </>
            ) : (
              <button className="primary" onClick={account.signIn}>Google로 로그인</button>
            )}
            {account.error && <p className="hint err">{account.error}</p>}
            <p className="hint">동기화되는 것: 아이 정보, 요일 선택, 숨긴 강좌, 찜, 메모, 도서관 정보 수정(차 시간·역·동)</p>
          </section>
        )}

        {kids.map((k) => {
          const g = gradeOn(k.birthYear, now);
          return (
            <section className="kid" key={k.id}>
              <div className="kid-grid">
                <label className="field">
                  <span>이름(구분용)</span>
                  <input type="text" value={k.name} maxLength={8} onChange={(e) => update(k.id, { name: e.target.value })} />
                </label>
                <label className="field">
                  <span>출생연도</span>
                  <select value={k.birthYear} onChange={(e) => update(k.id, { birthYear: Number(e.target.value) })}>
                    {YEARS.map((y) => (<option key={y} value={y}>{y}년생</option>))}
                  </select>
                </label>
              </div>
              <div className="kid-foot">
                <span className="hint">
                  지금 <strong>{stageLabel(g)}</strong> · 다음 학년도(3월)에는 <strong>{stageLabel(g + 1)}</strong>
                </span>
                {kids.length > 1 && <button className="link-btn danger" onClick={() => remove(k.id)}>삭제</button>}
              </div>
            </section>
          );
        })}

        {kids.length < MAX_KIDS && <button className="outline" onClick={add}>+ 아이 추가</button>}
        <p className="hint">학년은 3월에 올라가요. 각 강좌는 <strong>수업이 시작되는 날의 학년</strong>으로 대상을 판단해요.</p>
        {account?.user && onImportKids && (
          <>
            <button className="outline" onClick={async () => setKidMsg((await onImportKids()) || '')}>체험 앱에서 아이 정보 가져오기</button>
            {kidMsg && <p className="hint">{kidMsg}</p>}
          </>
        )}

        <button className="outline" onClick={onOpenLibs}>도서관 정보 수정 (차 시간 · 지하철역 · 동)</button>
        {hiddenTotal > 0 && (
          <button className="outline" onClick={() => { if (confirm(`숨긴 강좌 ${hiddenTotal}개를 모두 다시 보이게 할까요?`)) onUnhideAll(); }}>
            숨긴 강좌 모두 다시 보이게 하기 ({hiddenTotal})
          </button>
        )}
        <p className="hint">설정은 이 기기의 브라우저에 저장되고, 로그인하면 내 계정과만 동기화돼요.</p>
      </div>
    </div>
  );
}
