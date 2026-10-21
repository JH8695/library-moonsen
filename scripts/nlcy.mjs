// 국립어린이청소년도서관(nlcy.go.kr) 교육프로그램.
// nlcy.go.kr 은 자동 접근을 허용하지 않아서(robots), 같은 프로그램을 목록으로 옮겨 싣는
// 문화체육관광부 어린이누리집(mcst.go.kr)의 "국립어린이청소년도서관" 목록을 읽습니다.
// 각 항목의 링크는 도서관 원본 상세 페이지(C20100000000.do?idx=…)라서, 신청은 거기서 합니다.
// 한계: 수업 시각·정원·신청 인원은 이 목록에 없습니다 → 카드에 "도서관 페이지에서 확인"으로 안내.
import * as cheerio from 'cheerio';

export const MCST_URL = 'https://www.mcst.go.kr/usr/child/enter/edu/edu.jsp';
export const PAGE_SIZE = 10;
const SOURCE_NOTE = '문화체육관광부 어린이누리집 목록 기준 · 시간·정원은 도서관 페이지에서 확인하세요';

const STATUS = {
  접수중: 'open',
  준비중: 'upcoming', // 접수 시작 전
  대기자접수: 'waitlist',
  접수마감: 'closed',
  종료: 'closed',
};

const ymd = (m) => `${m[1]}-${m[2]}-${m[3]}`;
const dates = (text) => [...text.matchAll(/(\d{4})\.(\d{2})\.(\d{2})\./g)].map(ymd);

// <a> 안의 글자 조각을 줄 단위로 모음 (HTML 모양이 달라도 글자 순서만 같으면 읽을 수 있게)
function textLines($, el) {
  const out = [];
  const walk = (node) => {
    if (node.type === 'text') {
      const t = node.data.replace(/\s+/g, ' ').trim();
      if (t) out.push(t);
    } else if (node.children) node.children.forEach(walk);
  };
  walk(el);
  return out;
}

export function parseNlcyList(html) {
  const $ = cheerio.load(html);
  const courses = [];
  const warnings = [];
  const seen = new Set();

  $('a[href*="C20100000000.do"]').each((_, a) => {
    const href = ($(a).attr('href') || '').replace(/&amp;/g, '&');
    const idx = href.match(/[?&]idx=(\d+)/)?.[1];
    if (!idx || seen.has(idx)) return;
    const lines = textLines($, a);
    const statusText = lines.find((l) => l in STATUS);
    const eduLine = lines.find((l) => l.startsWith('교육기간'));
    const applyLine = lines.find((l) => l.startsWith('접수기간'));
    const wayLine = lines.find((l) => l.startsWith('접수방법'));
    // 남은 줄 순서: [대상, (선착순 등 선정방식), 제목]
    const rest = lines.filter((l) => l !== statusText && l !== eduLine && l !== applyLine && l !== wayLine);
    if (rest.length < 2 || !applyLine) {
      warnings.push(`예상과 다른 항목 건너뜀 (idx ${idx}): ${lines.join(' | ').slice(0, 80)}`);
      return;
    }
    const title = rest[rest.length - 1];
    const targetText = rest[0];
    const selection = rest.length >= 3 ? rest[1] : '';

    const edu = dates(eduLine || '');
    const apply = dates(applyLine);
    if (!edu.length) warnings.push(`교육기간을 못 읽음: ${title}`);
    if (!statusText) warnings.push(`상태를 못 읽음: ${title}`);
    seen.add(idx);

    courses.push({
      id: `nlcy-${idx}`,
      source: 'nlcy',
      libraryId: 'nlcy',
      title,
      targetText,
      selection, // 선착순 등
      applyWay: (wayLine || '').replace(/^접수방법\s*:?\s*/, ''),
      status: STATUS[statusText] ?? 'closed',
      statusText: statusText ?? '',
      applied: null,
      capacity: null,
      applyStart: apply[0] ?? null, // 날짜만 (시각 정보 없음)
      applyEnd: apply[1] ?? apply[0] ?? null,
      classStart: edu[0] ? `${edu[0]}T00:00:00+09:00` : null,
      classEnd: edu[0] ? `${(edu[1] ?? edu[0])}T00:00:00+09:00` : null,
      timeKnown: false,
      sessions: null,
      recurrence: null,
      sourceNote: SOURCE_NOTE,
      url: href.replace(/^http:/, 'https:'),
    });
  });
  return { courses, warnings };
}

// 페이지를 넘기며 읽음 (한 페이지 10건). 넘김이 안 먹히면(첫 항목이 같으면) 멈춤.
export async function collectNlcyWith({ getHtml, sleep, delayMs = 1200, maxPages = 3 }) {
  const out = [];
  const warnings = [];
  let prevFirst = null;
  for (let page = 1; page <= maxPages; page++) {
    const html = await getHtml(`${MCST_URL}?pOrg=05&pCurrentPage=${page}`);
    const r = parseNlcyList(html);
    warnings.push(...r.warnings);
    if (r.courses.length === 0) {
      if (page === 1) warnings.push('목록에서 프로그램을 하나도 읽지 못했어요 (페이지 구조 변경 가능성)');
      break;
    }
    if (page > 1 && r.courses[0].id === prevFirst) { warnings.push('페이지 넘김이 안 먹혀요 (국립어린이청소년도서관)'); break; }
    prevFirst = r.courses[0].id;
    out.push(...r.courses);
    if (r.courses.length < PAGE_SIZE) break;
    await sleep(delayMs);
  }
  return { courses: out, warnings };
}
