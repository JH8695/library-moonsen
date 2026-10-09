// 학년·연령 계산과 모집대상 문구 해석. 모두 한국 시간(Asia/Seoul) 기준.

export const TZ = 'Asia/Seoul';

export function seoulParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

// 학년도: 3월~12월은 해당 연도, 1~2월은 전년도
export function academicYear(date) {
  const { year, month } = seoulParts(date);
  return month >= 3 ? year : year - 1;
}

// 2017년생 → 2024학년도 초1 → 2026학년도 초3
export function gradeOn(birthYear, date) {
  return academicYear(date) - birthYear - 6;
}

// 세는나이 (2017년생 → 2026년 10살)
export function koreanAge(birthYear, date) {
  return seoulParts(date).year - birthYear + 1;
}

export function gradeLabel(g) {
  if (g >= 1 && g <= 6) return `초${g}`;
  if (g < 1) return g === 0 ? '취학 전' : '취학 전';
  return '초등 이후';
}

const RANGE_SEP = '[~\\-～–]';

/**
 * 모집대상 원문 → 아이에게 맞는지 판정.
 * 반환: { result: 'match' | 'nomatch' | 'check', tags: string[] }
 *  - match  : 대상에 해당
 *  - nomatch: 명확히 해당하지 않음
 *  - check  : 판단 불가 (만 N세, 원문 없음 등) → "대상 확인 필요"
 */
export function matchTarget(text, grade, age, birthYear = null) {
  const tags = [];
  if (!text || !text.trim()) return { result: 'check', tags };

  let t = text.replace(/\s+/g, '');
  let pos = false;
  let neg = false;
  let check = false;

  const inGrade = (a, b) => grade >= Math.min(a, b) && grade <= Math.max(a, b);

  // 0) 출생연도: 2018~19년생, 2017년생~2014년생, 2017년생
  t = t.replace(new RegExp(`(\\d{4})(?:년생)?(?:${RANGE_SEP}(\\d{2,4}))?년생`, 'g'), (m, a, b) => {
    if (birthYear == null) { check = true; return ''; }
    const lo = +a;
    const hi = b ? (b.length === 2 ? +(a.slice(0, 2) + b) : +b) : lo;
    birthYear >= Math.min(lo, hi) && birthYear <= Math.max(lo, hi) ? (pos = true) : (neg = true);
    return '';
  });

  // 1) 학년 범위: 초3~6, 초등3~6학년, 초3~초6, 3~6학년
  t = t.replace(
    new RegExp(`(?:초등학교|초등|초)?(\\d)(?:학년)?${RANGE_SEP}(?:초등학교|초등|초)?(\\d)학년?`, 'g'),
    (m, a, b) => {
      if (!/학년|초/.test(m)) return m; // "5~7세" 같은 나이 표기는 건드리지 않음
      inGrade(+a, +b) ? (pos = true) : (neg = true);
      return '';
    },
  );

  // 2) 단일 학년: 초3, 초등3학년, 3학년
  t = t.replace(/(?:초등학교|초등|초)(\d)(?:학년)?|(\d)학년/g, (m, a, b) => {
    const n = +(a || b);
    n === grade ? (pos = true) : (neg = true);
    return '';
  });

  // 3) 나이: 9~13세 / 만9~13세 / 만9세이상
  //    "N세"는 세는나이로 비교. "만 N세"는 생일에 따라 (세는나이-2) 또는 (세는나이-1) 이므로
  //    두 값이 모두 범위 안이면 해당, 모두 밖이면 비해당, 걸치면 "확인 필요".
  t = t.replace(
    new RegExp(`(만)?(\\d{1,2})(?:${RANGE_SEP}(\\d{1,2}))?세(이상|이하)?`, 'g'),
    (m, man, a, b, dir) => {
      const lo = +a;
      const hi = b ? +b : dir === '이상' ? 99 : dir === '이하' ? 0 : lo;
      const [min, max] = dir === '이하' ? [0, lo] : [lo, hi];
      if (man) {
        const inA = age - 2 >= min && age - 2 <= max;
        const inB = age - 1 >= min && age - 1 <= max;
        if (inA && inB) pos = true;
        else if (!inA && !inB) neg = true;
        else check = true;
        return '';
      }
      age >= min && age <= max ? (pos = true) : (neg = true);
      return '';
    },
  );

  // 4) 키워드
  if (/저학년/.test(t)) (grade <= 3 ? (pos = true) : (neg = true));
  if (/고학년/.test(t)) (grade >= 4 ? (pos = true) : (neg = true));
  if (/초등(학생|생)?|초등학교/.test(t) && !/저학년|고학년/.test(t)) pos = true;
  if (/어린이|전연령|모든연령|누구나|가족|온가족/.test(t)) { pos = true; tags.push('가족·누구나'); }
  if (/유아|영유아|미취학|중학생|중등|청소년|고등|성인|일반인/.test(t)) neg = true;
  if (/보호자|학부모|부모님?만/.test(t)) tags.push('보호자 대상 포함');

  if (pos) return { result: 'match', tags };
  if (check) return { result: 'check', tags };
  if (neg) return { result: 'nomatch', tags };
  return { result: 'check', tags };
}
