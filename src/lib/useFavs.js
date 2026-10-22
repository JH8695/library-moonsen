import { useEffect, useState } from 'react';

const KEY = 'libcourse:favs:v1';

const clean = (o) => {
  const out = {};
  if (o && typeof o === 'object' && !Array.isArray(o)) {
    for (const [id, ts] of Object.entries(o)) if (typeof id === 'string' && Number.isFinite(+ts)) out[id] = +ts;
  }
  return out;
};

// 찜한 강좌 { 강좌id: 찜한시각 }. 이 기기에 저장되고, 로그인하면 계정과도 동기화돼요.
export function useFavs() {
  const [favs, setFavsRaw] = useState(() => {
    try { return clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(favs)); } catch { /* ignore */ }
  }, [favs]);

  const setFavs = (v) => setFavsRaw(clean(v));
  const toggle = (id) =>
    setFavsRaw((f) => {
      if (id in f) { const n = { ...f }; delete n[id]; return n; }
      return { ...f, [id]: Date.now() };
    });
  const remove = (id) =>
    setFavsRaw((f) => {
      if (!(id in f)) return f;
      const n = { ...f };
      delete n[id];
      return n;
    });
  return { favs, setFavs, toggle, remove };
}
