import { useEffect, useState } from 'react';
import { LIBRARIES } from '../data/libraries';

const KEY = 'libcourse:settings:v1';
export const MAX_KIDS = 5;

const DEFAULTS = {
  kids: [{ id: 'k1', name: '큰아이', birthYear: 2017 }], // 아이마다 이름(구분용)과 출생연도
  days: [], // 선택한 수업 요일(0=일 … 6=토), 비어 있으면 전체
  exLibs: [], // 보기에서 뺀 도서관 id (비어 있으면 전체 도서관)
};

const validYear = (y) => Number.isInteger(y) && y >= 2005 && y <= 2026;

function cleanKids(list) {
  if (!Array.isArray(list)) return null;
  const out = [];
  const seen = new Set();
  for (const k of list) {
    if (!k || typeof k !== 'object' || !validYear(k.birthYear)) continue;
    let id = String(k.id ?? '').slice(0, 24) || `k${out.length + 1}`;
    while (seen.has(id)) id += 'x';
    seen.add(id);
    out.push({ id, name: String(k.name ?? '').trim().slice(0, 8) || `아이${out.length + 1}`, birthYear: k.birthYear });
    if (out.length >= MAX_KIDS) break;
  }
  return out.length ? out : null;
}

const cleanLibs = (v) => (Array.isArray(v) ? [...new Set(v)].filter((id) => LIBRARIES.some((l) => l.id === id)) : []);

// 예전 형식({birthYear}) → 새 형식({kids})으로 자동 변환
function normalize(raw) {
  const kids =
    cleanKids(raw?.kids) ??
    (validYear(raw?.birthYear) ? [{ id: 'k1', name: '큰아이', birthYear: raw.birthYear }] : DEFAULTS.kids);
  const days = Array.isArray(raw?.days) ? raw.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : [];
  return { kids, days, exLibs: cleanLibs(raw?.exLibs) };
}

// 아이·요일 같은 개인 설정은 이 기기(localStorage)에 저장되고, 로그인하면 계정과도 동기화돼요.
export function useSettings() {
  const [settings, setSettings] = useState(() => {
    try { return normalize(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { return normalize({}); }
  });
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* 저장 불가 환경 */ }
  }, [settings]);
  return [settings, setSettings];
}

// 클라우드에서 받은 설정값 검증 (알려진 항목만, 범위 안의 값만 반영). 예전 형식도 받아줌.
export function pickPrefs(v) {
  const o = {};
  if (v && typeof v === 'object') {
    const kids = cleanKids(v.kids) ?? (validYear(v.birthYear) ? [{ id: 'k1', name: '큰아이', birthYear: v.birthYear }] : null);
    if (kids) o.kids = kids;
    if (Array.isArray(v.days)) o.days = v.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    if (Array.isArray(v.exLibs)) o.exLibs = cleanLibs(v.exLibs);
  }
  return o;
}
