// 사용법: node scripts/collect.mjs   → public/data/courses.json 생성
// 개인용으로 1시간에 한 번, 소수의 페이지만, 요청 사이에 간격을 두고 읽습니다.
import fs from 'node:fs/promises';
import { collectGangnamWith } from './gangnam.mjs';
import { collectNlcyWith } from './nlcy.mjs';
import { API_URL as YJ_API, parseYangjae } from './yangjae.mjs';

const UA = 'library-courses-personal/0.1 (personal, hourly)';
const DELAY_MS = 1200;
// [상태코드, 기대 상태, 전체조회로 부족할 때 도서관별 재조회 허용]
const PLAN = [['ready', 'upcoming', true], ['apply', 'open', true], ['wait', 'waitlist', true], ['finish', 'closed', false]];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const describe = (e) =>
  `${e.message || e}${e.cause ? ` (${e.cause.code || e.cause.message})` : ''}`;

async function getHtml(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, 'Accept-Language': 'ko' },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      console.warn(`요청 실패(${attempt}/3): ${url} → ${describe(e)}`);
      if (attempt === 3) throw e;
      await sleep(attempt * 4000);
    }
  }
}

async function collectGangnam() {
  return collectGangnamWith({ getHtml, sleep, delayMs: DELAY_MS, plan: PLAN });
}

// 양재: JSON API. 최신순이라 앞쪽 페이지만 읽고, 수업이 이미 끝난 강좌뿐인 페이지가 나오면 멈춤.
// 접수중·접수예정·대기는 모두 남기고, 접수마감은 "수업이 아직 안 끝난 것"만 남김
// (앱에서 "접수종료·대기 포함"을 켜면 보이도록). "이전프로그램" 분류는 제외.
async function collectYangjae() {
  const out = [];
  const warnings = [];
  for (let page = 1; page <= 6; page++) {
    const url = `${YJ_API}?libCode=MH&pageIndex=${page}&pageSize=20&leLPart=&leLName=`;
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { courses, warnings: w, totalPage, rawClassEnds } = parseYangjae(await res.json());
    warnings.push(...w);
    out.push(...courses);
    const anyUpcoming = rawClassEnds.some((t) => t >= Date.now());
    if (courses.length === 0 || (page >= 2 && !anyUpcoming) || (totalPage && page >= totalPage)) break;
    await sleep(DELAY_MS);
  }
  const now = Date.now();
  const keep = out.filter(
    (c) =>
      c.category !== '이전프로그램' &&
      (['open', 'upcoming', 'waitlist'].includes(c.status) ||
        (c.status === 'closed' && c.classEnd && new Date(c.classEnd).getTime() >= now)),
  );
  return { courses: keep, warnings };
}

// 국립어린이청소년도서관: 문체부 어린이누리집 목록 경유 (nlcy.go.kr 은 자동 접근 불허)
// 접수중·접수예정·대기는 모두 남기고, 접수마감은 수업이 아직 안 끝난 것만 남김
async function collectNlcy() {
  const r = await collectNlcyWith({ getHtml, sleep, delayMs: DELAY_MS });
  const now = Date.now();
  const keep = r.courses.filter(
    (c) =>
      ['open', 'upcoming', 'waitlist'].includes(c.status) ||
      (c.status === 'closed' && c.classEnd && new Date(c.classEnd).getTime() + 86400000 >= now),
  );
  return { courses: keep, warnings: r.warnings, total: r.courses.length };
}

const meta = { fetchedAt: new Date().toISOString(), errors: [], warnings: [] };
let courses = [];

try {
  const g = await collectGangnam();
  courses.push(...g.courses);
  meta.warnings.push(...g.warnings);
  if (g.failedParts?.length) {
    // 일부만 실패해도 화면 배너로 알림 (목록에서 강좌가 빠졌을 수 있음)
    const shown = g.failedParts.slice(0, 4).join(', ');
    const more = g.failedParts.length > 4 ? ` 외 ${g.failedParts.length - 4}건` : '';
    meta.errors.push({ source: '강남구립도서관 일부', message: shown + more });
  }
  console.log(`강남구: ${g.courses.length}건, 경고 ${g.warnings.length}건`, JSON.stringify(g.stats));
  const perLib = {};
  g.courses.forEach((c) => { perLib[c.libraryId ?? '미분류'] = (perLib[c.libraryId ?? '미분류'] ?? 0) + 1; });
  console.log('도서관별 수집 건수:', JSON.stringify(perLib));
} catch (e) {
  // 실패한 출처의 옛 데이터는 남기지 않음 (현재 정보처럼 보이면 안 되므로)
  meta.errors.push({ source: '강남구립도서관', message: describe(e) });
  console.error('강남구 수집 실패:', e);
}

try {
  const y = await collectYangjae();
  courses.push(...y.courses);
  meta.warnings.push(...y.warnings);
  console.log(`양재: ${y.courses.length}건, 경고 ${y.warnings.length}건`);
} catch (e) {
  meta.errors.push({ source: '양재도서관', message: describe(e) });
  console.error('양재 수집 실패:', e);
}

try {
  const n = await collectNlcy();
  courses.push(...n.courses);
  meta.warnings.push(...n.warnings);
  console.log(`국립어린이청소년도서관(문체부 경유): ${n.courses.length}건 (읽은 ${n.total}건), 경고 ${n.warnings.length}건`);
  if (n.total === 0) meta.errors.push({ source: '국립어린이청소년도서관', message: '목록을 읽지 못했어요' });
} catch (e) {
  meta.errors.push({ source: '국립어린이청소년도서관', message: describe(e) });
  console.error('국립어린이청소년도서관 수집 실패:', e);
}

await fs.mkdir('public/data', { recursive: true });
await fs.writeFile('public/data/courses.json', JSON.stringify({ meta, courses }, null, 1));
if (meta.warnings.length) console.warn('경고:\n' + meta.warnings.join('\n'));
console.log(`저장 완료: ${courses.length}건`);
