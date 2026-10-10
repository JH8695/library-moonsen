import { useEffect, useState } from 'react';

const KEY = 'libcourse:settings:v1';
const DEFAULTS = { birthYear: 2017, gradeOverride: null, days: [] }; // days: 선택한 수업 요일(0=일 … 6=토), 비어 있으면 전체

// 출생연도 같은 개인 설정은 이 브라우저(localStorage)에만 저장됩니다.
export function useSettings() {
  const [settings, setSettings] = useState(() => {
    try {
      return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    } catch {
      return DEFAULTS;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* 저장 불가 환경 */ }
  }, [settings]);
  return [settings, setSettings];
}
