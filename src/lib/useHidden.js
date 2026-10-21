import { useEffect, useState } from 'react';

const KEY = 'libcourse:hidden:v1';

const clean = (o) => {
  const out = {};
  if (o && typeof o === 'object' && !Array.isArray(o)) {
    for (const [id, ts] of Object.entries(o)) if (typeof id === 'string' && Number.isFinite(+ts)) out[id] = +ts;
  }
  return out;
};

// 숨긴 강좌 { 강좌id: 숨긴시각 }. 이 기기에 저장되고, 로그인하면 계정과도 동기화돼요.
// 강좌 고유번호 기준이라 도서관이 목록을 새로 올려도 숨긴 상태가 유지돼요.
export function useHidden() {
  const [hidden, setHiddenRaw] = useState(() => {
    try { return clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(hidden)); } catch { /* ignore */ }
  }, [hidden]);

  const setHidden = (v) => setHiddenRaw(clean(v)); // 클라우드에서 받은 값도 검증해서 사용
  const hide = (id) => setHiddenRaw((h) => (h[id] ? h : { ...h, [id]: Date.now() }));
  const unhide = (id) =>
    setHiddenRaw((h) => {
      if (!(id in h)) return h;
      const n = { ...h };
      delete n[id];
      return n;
    });
  return { hidden, setHidden, hide, unhide };
}
