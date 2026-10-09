// 강남구통합도서관 문화행사 목록(HTML) 파서. 네트워크 없이 테스트할 수 있게 분리.
import * as cheerio from 'cheerio';

export const DETAIL_URL = 'https://library.gangnam.go.kr/intro/menu/10045/program/30013/lectureDetail.do';
export const LIST_URL = 'https://library.gangnam.go.kr/intro/menu/10045/program/30013/lectureList.do';

// 목록 HTML 의 <i class="lib xxx"> 클래스 → libraries.js 의 id
const LIB_BY_CLASS = {
  dogoklib: 'dogok', hnkklib: 'gaepo', nhlib: 'nonhyeon', nmmlib: 'nonhyeon-maru',
  dch1lib: 'daechi1', dchlib: 'daechi', mglib: 'motgol', hchildlib: 'motgol-hanok',
  sslib: 'samsung', sklib: 'segok', segokmarulib: 'segok-maru', ys2lib: 'yeoksam2',
  yslib: 'yeoksam', ysplib: 'yeoksam-pureunsol', yllib: 'yeollin', englib: 'ilwon-raon',
  jdwlib: 'jeongdaun', jgwlib: 'jeulgeoun', cdlib: 'cheongdam', happylib: 'haengbokan',
};

// 검색 폼의 도서관 코드(manageCd) → libraries.js id
export const LIB_CODES = {
  MA: 'dogok', MM: 'gaepo', MB: 'nonhyeon', MN: 'nonhyeon-maru', SA: 'nonhyeon-maru-annex',
  SB: 'daechi1', MC: 'daechi', MD: 'motgol', ME: 'motgol-hanok', SC: 'samsung', SD: 'segok',
  SF: 'segok-maru', SE: 'yeoksam2', MF: 'yeoksam', MG: 'yeoksam-pureunsol', MH: 'yeollin',
  SH: 'ilwon-raon', MI: 'jeongdaun', MJ: 'jeulgeoun', MK: 'cheongdam', ML: 'haengbokan',
};

// 목록에 표시되는 줄임 이름(공백·줄바꿈 제거) → id. CSS 클래스로 못 찾을 때의 보조 수단.
const LIB_BY_NAME = {
  도곡정보: 'dogok', 도곡: 'dogok', 개포하늘꿈: 'gaepo', 개포: 'gaepo',
  논현문화마루: 'nonhyeon-maru', 논현: 'nonhyeon', 대치1작은: 'daechi1', 대치1: 'daechi1', 대치: 'daechi',
  못골한옥: 'motgol-hanok', 못골: 'motgol', 삼성: 'samsung', 세곡마루: 'segok-maru', 세곡: 'segok',
  역삼2동: 'yeoksam2', 역삼2: 'yeoksam2', 역삼푸른솔: 'yeoksam-pureunsol', 역삼: 'yeoksam',
  열린: 'yeollin', 일원라온영어: 'ilwon-raon', 일원: 'ilwon-raon', 정다운: 'jeongdaun',
  즐거운: 'jeulgeoun', 청담: 'cheongdam', 행복한: 'haengbokan',
};

const STATUS_BY_CLASS = {
  ready: 'upcoming', apply: 'open', wait: 'waitlist', finish: 'closed', end: 'closed',
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// "2026.10.17(토)" / "2026-10-17(토)" → { date: '2026-10-17', dow: '토' }
function parseDates(text) {
  const out = [];
  for (const m of text.matchAll(/(\d{4})[.\-](\d{2})[.\-](\d{2})\s*\(([일월화수목금토])\)/g)) {
    out.push({ date: `${m[1]}-${m[2]}-${m[3]}`, dow: m[4] });
  }
  return out;
}

function checkWeekday(d, warnings, title) {
  const real = WEEKDAYS[new Date(`${d.date}T12:00:00+09:00`).getUTCDay()];
  // 정오(+09:00)는 UTC 03:00 이라 같은 날짜 → getUTCDay 로 한국 날짜의 요일을 얻음
  if (real !== d.dow) warnings.push(`요일 불일치: ${title} ${d.date} 원문 ${d.dow} / 계산 ${real}`);
}

export function parseGangnamList(html, { libraryId: forcedLibraryId = null } = {}) {
  const $ = cheerio.load(html);
  const courses = [];
  const warnings = [];

  $('ul.lecture-list > li').each((_, li) => {
    const $li = $(li);
    const title = $li.find('p.title a').text().replace(/\s+/g, ' ').trim();
    const onclick = $li.find('p.title a').attr('onclick') || '';
    const idMatch = onclick.match(/fnDetail\('(\d+)'\)/);
    if (!title || !idMatch) { warnings.push('제목/ID 를 찾지 못한 항목 건너뜀'); return; }

    const libClass = ($li.find('i.lib').attr('class') || '').split(/\s+/).find((c) => c !== 'lib');
    const libName = $li.find('i.lib').text().replace(/\s+/g, '');
    const libraryId = forcedLibraryId ?? LIB_BY_CLASS[libClass] ?? LIB_BY_NAME[libName] ?? null;
    if (!libraryId) warnings.push(`알 수 없는 도서관 클래스: ${libClass} (${libName}) — ${title}`);

    const spans = $li.find('ul.info > li').first().find('span');
    let targetText = '';
    let applyText = '';
    let classText = '';
    spans.each((_, sp) => {
      const t = $(sp).text().replace(/\s+/g, ' ').trim();
      if (t.startsWith('대상')) targetText = t.replace(/^대상\s*:\s*/, '');
      else if (t.startsWith('접수기간')) applyText = t;
      else if (t.startsWith('행사기간')) classText = t;
    });

    const applyDates = parseDates(applyText);
    const classDates = parseDates(classText);
    [...applyDates, ...classDates].forEach((d) => checkWeekday(d, warnings, title));

    const timeM = classText.match(/(\d{1,2}):(\d{2})\s*~\s*(\d{1,2}):(\d{2})/);
    const pad = (n) => String(n).padStart(2, '0');
    const startT = timeM ? `${pad(timeM[1])}:${timeM[2]}` : null;
    const endT = timeM ? `${pad(timeM[3])}:${timeM[4]}` : null;
    const first = classDates[0]?.date;
    const last = classDates[classDates.length - 1]?.date;

    const applicantText = $li.find('li.applicant').text().replace(/\s+/g, ' ');
    const ap = applicantText.match(/신청\s*:\s*(\d+)\s*\/\s*(\d+)/);
    const waitM = applicantText.match(/대기\s*:\s*(\d+)\s*\/\s*(\d+)/);

    const statusClass = ($li.find('li.status').attr('class') || '').split(/\s+/).find((c) => c !== 'status');
    const status = STATUS_BY_CLASS[statusClass] ?? null;
    if (!status) warnings.push(`알 수 없는 상태 클래스: ${statusClass} — ${title}`);

    courses.push({
      id: `gn-${idMatch[1]}`,
      source: 'gangnam',
      libraryId,
      libraryNameRaw: libName,
      title,
      targetText,
      status: status ?? 'closed',
      statusText: $li.find('li.status b').text().trim(),
      applied: ap ? +ap[1] : null,
      capacity: ap ? +ap[2] : null,
      waitApplied: waitM ? +waitM[1] : null,
      waitCapacity: waitM ? +waitM[2] : null,
      // 목록에는 접수 "시각"이 없어 날짜만 저장 (시각은 상세 페이지에 있을 수 있음)
      applyStart: applyDates[0]?.date ?? null,
      applyEnd: applyDates[1]?.date ?? applyDates[0]?.date ?? null,
      classStart: first ? `${first}T${startT ?? '00:00'}:00+09:00` : null,
      classEnd: last ? `${last}T${endT ?? startT ?? '00:00'}:00+09:00` : null,
      timeKnown: !!startT,
      sessions: null,
      recurrence: null,
      url: `${DETAIL_URL}?currentPageNo=1&searchCategory=&manageCd=ALL&searchStatusCd=&lectureIdx=${idMatch[1]}`,
    });
  });

  const lastPage = Number(html.match(/fnList\((\d+)\);"\s+class="btn-paging last"/)?.[1]) || null;
  return { courses, warnings, lastPage };
}

// ---------------------------------------------------------------------------
// 수집: 상태(접수예정/접수중/대기/접수마감)별로 "전체 도서관" 목록을 페이지 넘기며 읽고,
// 페이지 넘김이 안 먹히거나 끝까지 못 읽었으면 도서관별로 다시 읽는다 (도서관마다 건수가 적어 첫 페이지로 충분).
// getHtml / sleep 은 밖에서 주입 → 네트워크 없이 테스트 가능.
export const PAGE_SIZE = 10;

async function queryPages({ getHtml, sleep, delayMs, status, expected, manageCd, libraryId, maxPages }) {
  const items = [];
  const warnings = [];
  let prevFirst = null;
  let complete = false;
  for (let page = 1; page <= maxPages; page++) {
    const url = `${LIST_URL}?manageCd=${manageCd}&searchStatusCd=${status}&searchCondition=title&searchKeyword=&searchCategory=&currentPageNo=${page}`;
    let html;
    try {
      html = await getHtml(url);
    } catch (e) {
      if (page === 1) throw e;
      warnings.push(`${manageCd}/${status} ${page}페이지 실패: ${e.message} (앞 페이지까지만 사용)`);
      break;
    }
    const parsed = parseGangnamList(html, { libraryId });
    warnings.push(...parsed.warnings);
    if (parsed.courses.length === 0) { complete = true; break; }
    if (page > 1 && parsed.courses[0].id === prevFirst) {
      warnings.push(`페이지 넘김이 안 먹혀요 (${manageCd}/${status})`);
      break; // complete=false
    }
    prevFirst = parsed.courses[0].id;
    for (const c of parsed.courses) {
      if (c.status !== expected) warnings.push(`상태 필터 불일치: ${c.id} ${c.status} (요청 ${expected})`);
      items.push(c);
    }
    if (parsed.courses.length < PAGE_SIZE || (parsed.lastPage && page >= parsed.lastPage)) { complete = true; break; }
    await sleep(delayMs);
  }
  return { items, warnings, complete };
}

// plan: [[상태코드, 기대 상태, 도서관별 재조회 허용 여부], ...]
export async function collectGangnamWith({ getHtml, sleep, delayMs = 1200, plan }) {
  const byId = new Map();
  const warnings = [];
  const failures = [];
  const stats = {};
  let ok = 0;
  for (const [status, expected, allowFallback] of plan) {
    try {
      const r = await queryPages({ getHtml, sleep, delayMs, status, expected, manageCd: 'ALL', maxPages: 8 });
      warnings.push(...r.warnings);
      r.items.forEach((c) => byId.set(c.id, c));
      stats[status] = { all: r.items.length, complete: r.complete, perLibrary: false };
      ok++;
      if (!r.complete && allowFallback) {
        warnings.push(`${status}: 전체 조회로 다 못 읽어서 도서관별로 다시 읽어요`);
        stats[status].perLibrary = true;
        for (const [code, libraryId] of Object.entries(LIB_CODES)) {
          await sleep(delayMs);
          try {
            const r2 = await queryPages({ getHtml, sleep, delayMs, status, expected, manageCd: code, libraryId, maxPages: 3 });
            warnings.push(...r2.warnings.filter((w) => !w.startsWith('상태 필터')));
            r2.items.forEach((c) => byId.set(c.id, c)); // 도서관 코드로 읽은 결과가 더 정확하므로 덮어씀
            if (!r2.complete) warnings.push(`${code}/${status}: 일부만 수집 (3페이지 초과 또는 넘김 불가)`);
          } catch (e) {
            warnings.push(`${code}/${status} 실패: ${e.message}`);
          }
        }
      }
    } catch (e) {
      failures.push(`${status}: ${e.message}`);
    }
    await sleep(delayMs);
  }
  if (ok === 0) throw new Error(failures.join(' / '));
  if (failures.length) warnings.push(`일부 상태 수집 실패 → ${failures.join(' / ')}`);
  return { courses: [...byId.values()], warnings, stats };
}
