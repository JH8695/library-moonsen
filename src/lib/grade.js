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

// 학년 숫자 → 사람이 읽는 말 (0=유치원 나이, 음수=그 이전, 1~6 초, 7~9 중, 10~12 고)
export function stageLabel(g) {
  if (g > 12) return '성인';
  if (g >= 10) return `고${g - 9}`;
  if (g >= 7) return `중${g - 6}`;
  if (g >= 1) return `초${g}`;
  if (g === 0) return '유치원';
  return '유치원 전';
}

const RANGE_SEP = '[~\\-～–]';

/**
 * 모집대상 원문 → 이 아이에게 맞는지 판정.
 * 반환: { result: 'match' | 'nomatch' | 'check', tags: string[] }
 *  - match  : 대상에 해당
 *  - nomatch: 명확히 해당하지 않음
 *  - check  : 판단 불가 (만 N세, 보호자 동반인데 자녀 나이 불명, 원문 없음 등) → "대상 확인 필요"
 *
 * grade 는 학년 숫자(1~6 초등, 7~9 중등, 10~12 고등, 0 이하 = 취학 전), age 는 세는나이, birthYear 는 출생연도.
 * 판정 순서: ① 명시된 조건(출생연도·학년·나이) → ② 없을 때만 "유아/초등/어린이/가족/누구나" 같은 말
 *           → ③ 다른 연령대 단어(성인·다른 학교급) → ④ 보호자 전용 여부
 */
const LV = '초등학교|초등|초|중학교|중등|중|고등학교|고등|고';
const LEVEL_OFFSET = [0, 6, 9]; // 초1~6 → 1~6, 중1~3 → 7~9, 고1~3 → 10~12
const LEVEL_MAX = [6, 3, 3];
const levelOf = (p) => (p ? (p[0] === '초' ? 0 : p[0] === '중' ? 1 : 2) : null);

const ADULT_WORDS = /시니어|노인|어르신|중년|장년|청년|성인|직장인|일반인|대학생|교사|선생님|예비부모|임산부|신혼|조부모|할머니|할아버지/;
const PRE_WORDS = /영유아|유아|미취학|유치원|어린이집|영아|취학전/;
const ELEM_WORDS = /초등(?:학생|생)?|초등학교/;
const MID_WORDS = /중학생|중등|중학교/;
const HIGH_WORDS = /고등학생|고등|고교생|고등학교/;
const TEEN_WORDS = /청소년|10대/;
const CHILD_WORDS = /어린이|아동/; // 유아~초등 범위의 아이
const FAMILY_WORDS = /온가족|가족/;
const ALL_AGES_WORDS = /전연령|모든연령|누구나/; // "성인 누구나"처럼 다른 연령대와 같이 쓰이면 그쪽만 뜻함
const PARENT_WORDS = /아빠|엄마|아버지|어머니|부모|양육자|학부모|보호자|맘|대디|자녀를둔|자녀가있는|자녀를키우는|자녀를양육/;
// 보호자와 아이가 함께 참여하는 프로그램이라는 단서
const PAIR_WORDS = /동반|함께|와같이|과같이|자녀와|아이와|아동과|부모와|엄마와|아빠와|가족/;

export function matchTarget(text, grade, age, birthYear = null) {
  const tags = [];
  if (!text || !text.trim()) return { result: 'check', tags };

  const stage = grade <= 0 ? 'pre' : grade <= 6 ? 'elem' : grade <= 9 ? 'mid' : grade <= 12 ? 'high' : 'adult';
  let t = text.replace(/\s+/g, '');
  let pos = false;
  let neg = false;
  let check = false;

  // "예비초등", "예비 초등 1학년"은 취학 전 아이용 → 초등 학년 표기로 읽지 않도록 먼저 빼 둠
  let prepHit = false;
  t = t.replace(/예비초등?(?:\d학년?)?/g, () => { prepHit = true; return ''; });

  // 0) 출생연도: 2018~19년생, 2017년생~2014년생, 2017년생
  t = t.replace(new RegExp(`(\\d{4})(?:년생)?(?:${RANGE_SEP}(\\d{2,4}))?년생`, 'g'), (m, a, b) => {
    if (birthYear == null) { check = true; return ''; }
    const lo = +a;
    const hi = b ? (b.length === 2 ? +(a.slice(0, 2) + b) : +b) : lo;
    birthYear >= Math.min(lo, hi) && birthYear <= Math.max(lo, hi) ? (pos = true) : (neg = true);
    return '';
  });

  // 1) 학년 (학교급 구분): 초3, 초등3~6학년, 3~6학년, 중1~3, 초등5학년~고등3학년
  //    학교급 표시가 없으면 초등으로 간주. 오른쪽에 학교급이 없으면 왼쪽 학교급을 따름.
  t = t.replace(
    new RegExp(
      `(?:(?<![가-힣])(${LV}))?(\\d{1,2})(?:학년)?(?:${RANGE_SEP}(?:(?<![가-힣])(${LV}))?(\\d{1,2})(?:학년)?)?`,
      'g',
    ),
    (m, p1, a, p2, b) => {
      if (!p1 && !p2 && !/학년/.test(m)) return m; // 학교급도 "학년"도 없으면 학년 표기가 아님 (예: 5~7세, 12명)
      const l1 = levelOf(p1) ?? 0;
      const l2 = p2 ? levelOf(p2) : l1;
      const A = +a;
      const B = b ? +b : null;
      if (A < 1 || A > LEVEL_MAX[l1]) return m;
      if (B != null && (B < 1 || B > LEVEL_MAX[l2])) return m;
      const lo = LEVEL_OFFSET[l1] + A;
      const hi = B != null ? LEVEL_OFFSET[l2] + B : lo;
      grade >= Math.min(lo, hi) && grade <= Math.max(lo, hi) ? (pos = true) : (neg = true);
      return '';
    },
  );

  // 2) 나이: 9~13세 / 만9~13세 / 만9세이상
  //    "만 N세"는 생일에 따라 (세는나이-2) 또는 (세는나이-1) 이므로
  //    두 값이 모두 범위 안이면 해당, 모두 밖이면 비해당, 걸치면 "확인 필요".
  t = t.replace(
    new RegExp(`(만)?(\\d{1,2})(?:세)?(?:${RANGE_SEP}(?:만)?(\\d{1,2}))?세(이상|이하)?`, 'g'),
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
      // 만 표기가 없는 "N세"는 세는나이(옛 방식)일 수도, 만 나이(현재 공식)일 수도 있음 → 둘 다 보고 판정
      //   만 나이로는 확실히 해당(생일 전후 모두 범위 안) → 해당
      //   만 나이로 일부 해당 + 세는나이로도 해당 → 해당
      //   한쪽 방식으로만 가능성이 있으면 → 확인 필요 / 어느 쪽도 아니면 → 비해당
      const se = age >= min && age <= max;
      const mA = age - 2 >= min && age - 2 <= max;
      const mB = age - 1 >= min && age - 1 <= max;
      if (mA && mB) pos = true;
      else if ((mA || mB) && se) pos = true;
      else if (mA || mB || se) check = true;
      else neg = true;
      return '';
    },
  );

  // 3) 초등 학년군 단어 (명시 조건으로 취급): 초등 아이에게만 해당될 수 있음
  const isElem = stage === 'elem';
  if (/저학년/.test(t)) (isElem && grade <= 3 ? (pos = true) : (neg = true));
  if (/중학년/.test(t)) (isElem && grade >= 3 && grade <= 4 ? (pos = true) : (neg = true));
  if (/고학년/.test(t)) (isElem && grade >= 4 ? (pos = true) : (neg = true));

  const explicit = pos || neg || check;

  // 4) 학교급·연령대 단어
  const hits = {
    pre: PRE_WORDS.test(t) || prepHit,
    elem: ELEM_WORDS.test(t),
    mid: MID_WORDS.test(t),
    high: HIGH_WORDS.test(t),
    teen: TEEN_WORDS.test(t),
  };
  if (/초중등|초중고/.test(t)) { hits.elem = true; hits.mid = true; if (/초중고/.test(t)) hits.high = true; }
  const midHigh = stage === 'mid' || stage === 'high';
  const own =
    (stage === 'pre' && hits.pre) ||
    (isElem && hits.elem) ||
    (stage === 'mid' && (hits.mid || hits.teen)) ||
    (stage === 'high' && (hits.high || hits.teen));
  const otherStage =
    (hits.pre && stage !== 'pre') ||
    (hits.elem && !isElem) ||
    (hits.mid && stage !== 'mid') ||
    (hits.high && stage !== 'high') ||
    (hits.teen && !midHigh);
  const adultHit = ADULT_WORDS.test(t);
  if (adultHit || otherStage) neg = true;
  if (CHILD_WORDS.test(t) && !(stage === 'pre' || isElem)) neg = true; // "어린이"는 중·고등 아이에게는 해당 없음

  // 5) 일반 단어는 명시 조건(학년·나이·출생연도)이 없을 때만 "해당"으로 인정
  //    - 우리 아이 학교급 단어: 해당
  //    - 어린이/아동: 취학 전~초등 아이에게 해당
  //    - 가족: 해당
  //    - 누구나/전연령: 다른 연령대 단어가 같이 있으면(예: "성인 누구나") 해당으로 보지 않음
  if (!explicit) {
    if (own) {
      pos = true;
    } else if (CHILD_WORDS.test(t) && (stage === 'pre' || isElem)) {
      pos = true;
      tags.push('가족·누구나');
    } else if (FAMILY_WORDS.test(t)) {
      pos = true;
      tags.push('가족·누구나');
    } else if (ALL_AGES_WORDS.test(t) && !adultHit && !otherStage) {
      pos = true;
      tags.push('가족·누구나');
    }
  }

  // 팀·가족 단위 신청("4팀 (대표자 1명만 신청)")은 나이가 적혀 있지 않으면 확인 대상으로 둠
  if (/\d+팀/.test(t) && !(pos || neg || check)) {
    check = true;
    tags.push('팀 신청 · 나이 직접 확인');
  }

  // 6) 보호자 전용 여부: 보호자 단어가 있는데 "함께/동반/가족" 같은 단서가 없으면
  //    학년 조건이 있어도 그건 "자녀의 학년"이므로 참석자는 보호자 → 제외
  if (PARENT_WORDS.test(t)) {
    if (!PAIR_WORDS.test(t)) {
      tags.push('보호자·성인 대상');
      return { result: 'nomatch', tags };
    }
    tags.push('보호자 동반');
  }

  if (pos) return { result: 'match', tags };
  if (check) return { result: 'check', tags };
  if (neg) return { result: 'nomatch', tags };
  return { result: 'check', tags };
}
