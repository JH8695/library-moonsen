import { useEffect, useMemo, useState } from 'react';
import { LIBRARIES } from '../data/libraries';

const KEY = 'libcourse:libs:v1';

const baseFields = (l) => ({
  driveMin: l.driveMin ?? null,
  stationName: l.station?.name ?? '',
  walkMin: l.station?.walkMin ?? null,
  dong: l.dong ?? '',
});
const num = (x) => (x === null || x === undefined || x === '' ? null : Number.isFinite(+x) && +x >= 0 ? +x : null);

// 사용자가 고친 값(차 시간·역·동)은 이 기기의 브라우저에만 저장됩니다.
// 기본값은 src/data/libraries.js, 고친 값은 그 위에 덮어씁니다.
export function useLibraries() {
  const [ov, setOv] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(ov)); } catch { /* ignore */ }
  }, [ov]);

  const libs = useMemo(
    () =>
      LIBRARIES.map((l) => {
        const o = ov[l.id];
        if (!o) return l;
        return {
          ...l,
          driveMin: num(o.driveMin),
          station: o.stationName ? { name: o.stationName, walkMin: num(o.walkMin) } : null,
          dong: o.dong || null,
          edited: true,
        };
      }),
    [ov],
  );
  const byId = useMemo(() => Object.fromEntries(libs.map((l) => [l.id, l])), [libs]);

  const update = (id, patch) =>
    setOv((prev) => {
      const base = LIBRARIES.find((x) => x.id === id);
      return { ...prev, [id]: { ...(prev[id] ?? baseFields(base)), ...patch } };
    });
  const reset = (id) => setOv((prev) => { const n = { ...prev }; delete n[id]; return n; });
  const resetAll = () => setOv({});
  const exportJson = () => JSON.stringify(ov);
  // 외부(붙여넣기·클라우드)에서 들어온 값은 항상 이 함수로 검증해서 사용
  const sanitize = (o) => {
    const clean = {};
    if (!o || typeof o !== 'object' || Array.isArray(o)) return clean;
    for (const [id, v] of Object.entries(o)) {
      if (!LIBRARIES.some((l) => l.id === id) || !v || typeof v !== 'object') continue;
      clean[id] = {
        driveMin: num(v.driveMin),
        stationName: String(v.stationName ?? '').slice(0, 30),
        walkMin: num(v.walkMin),
        dong: String(v.dong ?? '').slice(0, 20),
      };
    }
    return clean;
  };
  const setOverrides = (v) => setOv(sanitize(v));
  const importJson = (text) => {
    try {
      const o = JSON.parse(text);
      if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('bad');
      setOv(sanitize(o));
      return null;
    } catch {
      return '형식이 올바르지 않아요. "복사" 버튼으로 복사한 내용을 그대로 붙여넣어 주세요.';
    }
  };

  return { libs, byId, update, reset, resetAll, exportJson, importJson, baseFields, overrides: ov, setOverrides };
}
