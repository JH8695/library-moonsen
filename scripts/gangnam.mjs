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

export function parseGangnamList(html) {
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
    const libraryId = LIB_BY_CLASS[libClass] ?? null;
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
