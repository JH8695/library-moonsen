// 사용법: node scripts/collect.mjs   → public/data/courses.json 생성
// 개인용으로 1시간에 한 번, 소수의 페이지만, 요청 사이에 간격을 두고 읽습니다.
import fs from 'node:fs/promises';
import { LIST_URL, parseGangnamList } from './gangnam.mjs';
import { API_URL as YJ_API, parseYangjae } from './yangjae.mjs';

const UA = 'library-courses-personal/0.1 (personal, hourly)';
const DELAY_MS = 1500;
const MAX_PAGES = 4;          // 상태별 최대 페이지
const STATUSES = [['ready', 'upcoming'], ['apply', 'open'], ['wait', 'waitlist'], ['finish', 'closed']];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const describe = (e) =>
  `${e.message || e}${e.cause ? ` (${e.cause.code || e.cause.message})` : ''}`;

async function getHtml(url) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, 'Accept-Language': 'ko' },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      console.warn(`요청 실패(${attempt}/2): ${url} → ${describe(e)}`);
      if (attempt === 2) throw e;
      await sleep(3000);
    }
  }
}

async function collectGangnam() {
  const byId = new Map();
  const warnings = [];
  let okStatuses = 0;
  const failures = [];
  for (const [code, expected] of STATUSES) {
    let firstIdPrev = null;
    try {
      for (let page = 1; page <= MAX_PAGES; page++) {
        const url = `${LIST_URL}?manageCd=ALL&searchStatusCd=${code}&searchCondition=title&searchKeyword=&searchCategory=&currentPageNo=${page}`;
        let html;
        try {
          html = await getHtml(url);
        } catch (e) {
          if (page === 1) throw e;           // 첫 페이지 실패 = 이 상태는 실패
          warnings.push(`${code} ${page}페이지 실패: ${describe(e)} (앞 페이지까지만 사용)`);
          break;
        }
        const { courses, warnings: w, lastPage } = parseGangnamList(html);
        warnings.push(...w);
        if (courses.length === 0) break;
        if (page > 1 && courses[0].id === firstIdPrev) {
          warnings.push(`페이지 파라미터(currentPageNo)가 먹히지 않는 것 같아요 (${code}) — 확인 필요`);
          break;
        }
        firstIdPrev = courses[0].id;
        for (const c of courses) {
          if (c.status !== expected) warnings.push(`상태 필터 불일치: ${c.id} ${c.status} (요청 ${expected})`);
          byId.set(c.id, c);
        }
        if (lastPage && page >= lastPage) break;
        await sleep(DELAY_MS);
      }
      okStatuses++;
    } catch (e) {
      failures.push(`${code}: ${describe(e)}`);
    }
    await sleep(DELAY_MS);
  }
  if (okStatuses === 0) throw new Error(failures.join(' / '));
  if (failures.length) warnings.push(`일부 상태 수집 실패 → ${failures.join(' / ')}`);
  return { courses: [...byId.values()], warnings };
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

const meta = { fetchedAt: new Date().toISOString(), errors: [], warnings: [] };
let courses = [];

try {
  const g = await collectGangnam();
  courses.push(...g.courses);
  meta.warnings.push(...g.warnings);
  console.log(`강남구: ${g.courses.length}건, 경고 ${g.warnings.length}건`);
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

await fs.mkdir('public/data', { recursive: true });
await fs.writeFile('public/data/courses.json', JSON.stringify({ meta, courses }, null, 1));
if (meta.warnings.length) console.warn('경고:\n' + meta.warnings.join('\n'));
console.log(`저장 완료: ${courses.length}건`);
