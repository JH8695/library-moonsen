import { useEffect, useState } from 'react';
import { SAMPLE_COURSES, SAMPLE_META } from '../data/sampleCourses';

// public/data/courses.json 이 있으면 실데이터, 없으면 샘플을 사용합니다.
// courses.json 형태: { meta: { fetchedAt, errors: [{source, message}] }, courses: [...] }
export function useCourses() {
  const [state, setState] = useState({ courses: SAMPLE_COURSES, meta: SAMPLE_META, loading: true });

  useEffect(() => {
    let alive = true;
    fetch(`${import.meta.env.BASE_URL}data/courses.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('no file'))))
      .then((json) => {
        if (!alive || !Array.isArray(json.courses)) throw new Error('bad format');
        setState({ courses: json.courses, meta: { isSample: false, ...json.meta }, loading: false });
      })
      .catch(() => alive && setState({ courses: SAMPLE_COURSES, meta: SAMPLE_META, loading: false }));
    return () => { alive = false; };
  }, []);

  return state;
}
