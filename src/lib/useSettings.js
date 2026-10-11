import { useCallback, useEffect, useState } from 'react';
import { academicYear } from './grade';
import { bumpStamps } from './sync';

const KEY = 'libcourse:settings:v1';
const DEFAULTS = {
  kids: [{ id: 'k1', label: '아이', birthYear: 2017 }], // 아이 여러 명 (이름은 구분용)
  activeKids: [], // 비어 있으면 아이 전체
  days: [], // 선택한 수업 요일(0=일 … 6=토), 비어 있으면 전체
  favs: [], // 찜한 강좌 id
  hidden: [], // "관심 없어요"로 숨긴 강좌 id
  notes: {}, // 강좌 id별 메모: { id: { text } }
  _stamps: {}, // 항목별 마지막으로 고친 시각 (기기 간 동기화용)
  _linked: null, // 이 기기가 연결한 구글 계정(uid)
};

function load() {
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { stored = {}; }
  const next = { ...DEFAULTS, ...stored };
  // 예전 설정(출생연도 하나 / 학년 직접 선택)을 아이 목록으로 옮김
  if (!Array.isArray(stored.kids) && (stored.birthYear || stored.gradeOverride)) {
    const birth = stored.gradeOverride ? academicYear(new Date()) - stored.gradeOverride - 6 : stored.birthYear;
    next.kids = [{ id: 'k1', label: '아이', birthYear: birth }];
  }
  delete next.birthYear;
  delete next.gradeOverride;
  return next;
}

// 개인 설정은 이 기기(localStorage)에 저장하고, 구글 로그인을 하면 계정에도 동기화돼요.
// setSettings 는 값이 바뀐 항목의 "고친 시각"을 같이 기록하고, applyRemote 는 서버에서 받은 값을 적용해요.
export function useSettings() {
  const [settings, setState] = useState(load);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* 저장 불가 환경 */ }
  }, [settings]);

  const setSettings = useCallback(
    (update) =>
      setState((prev) => {
        const next = typeof update === 'function' ? update(prev) : update;
        return bumpStamps(prev, next, Date.now());
      }),
    [],
  );
  const applyRemote = useCallback(
    (values, stamps, uid) => setState((prev) => ({ ...prev, ...values, _stamps: stamps, _linked: uid ?? prev._linked })),
    [],
  );
  return [settings, setSettings, applyRemote];
}
