// 네트워크 없이 수집 로직을 검증: 가짜 사이트(최신순, 한 페이지 10건)를 만들어 두 가지 상황을 시뮬레이션
import { collectGangnamWith, LIB_CODES } from '../scripts/gangnam.mjs';

const LIB_CLASS = { 'segok-maru': ['segokmarulib', '세곡<br>마루'], dogok: ['dogoklib', '도곡<br>정보'], cheongdam: ['cdlib', '청담'], motgol: ['mglib', '못골'] };
const codeOf = Object.fromEntries(Object.entries(LIB_CODES).map(([c, id]) => [id, c]));

function li(c) {
  const [cls, name] = LIB_CLASS[c.lib] ?? ['xlib', c.lib];
  return `<li><p class="title"><i class="lib ${cls}"><span>${name}</span></i>
<a href="#javascript" onclick="javascript:fnDetail('${c.id}'); return false;">${c.title}</a></p>
<ul class="info"><li><span>대상 : ${c.target}</span><span>접수기간 : 2026.10.06(화) ~ 2026.10.30(금)</span><br>
<span>행사기간 : 2026-10-31(토) (14:00~15:00)</span></li>
<li class="applicant"><span>신청 : 0/4<br>(대기 : 0/2)</span></li>
<li class="status ${c.status}"><b class="tblBtn ${c.status}">x</b></li></ul></li>`;
}
function page(items, n, total) {
  const slice = items.slice((n - 1) * 10, n * 10);
  return `<ul class="lecture-list">${slice.map(li).join('')}</ul><p class="paging"><a href="javascript:fnList(${Math.max(1, Math.ceil(total / 10))});" class="btn-paging last">x</a></p>`;
}

// 접수중 55건: 최신순 앞쪽은 다른 도서관, 세곡마루는 뒤쪽(31~36번째)에 숨어 있음
const libs = ['dogok', 'cheongdam', 'motgol'];
const applyAll = [];
for (let i = 0; i < 55; i++) {
  const lib = i >= 30 && i < 36 ? 'segok-maru' : libs[i % 3];
  applyAll.push({ id: String(40000 - i), lib, status: 'apply', title: `강좌${i}`, target: i % 2 ? '초등 저학년 15명' : '4팀 (대표자 1명만 신청)' });
}
const readyAll = [{ id: '39000', lib: 'dogok', status: 'ready', title: '예정1', target: '초등 2~3학년 10명' }];
const DATA = { apply: applyAll, ready: readyAll, wait: [], finish: [] };

function makeFetcher({ pagingWorks }) {
  let calls = 0;
  const fn = async (url) => {
    calls++;
    const q = new URL(url).searchParams;
    const status = q.get('searchStatusCd');
    const manage = q.get('manageCd');
    const n = pagingWorks ? Number(q.get('currentPageNo') || 1) : 1; // 못 넘기면 항상 1페이지
    let items = DATA[status] ?? [];
    if (manage !== 'ALL') items = items.filter((c) => codeOf[c.lib] === manage);
    return page(items, n, items.length);
  };
  fn.calls = () => calls;
  return fn;
}

const plan = [['ready', 'upcoming', true], ['apply', 'open', true], ['wait', 'waitlist', true], ['finish', 'closed', false]];
for (const pagingWorks of [true, false]) {
  const getHtml = makeFetcher({ pagingWorks });
  const r = await collectGangnamWith({ getHtml, sleep: async () => {}, delayMs: 0, plan });
  const segok = r.courses.filter((c) => c.libraryId === 'segok-maru');
  const apply = r.courses.filter((c) => c.status === 'open');
  console.log(`[페이지 넘김 ${pagingWorks ? '정상' : '불가'}] 총 ${r.courses.length}건 / 접수중 ${apply.length}건 / 세곡마루 ${segok.length}건 / 요청 ${getHtml.calls()}회 / 도서관별 재조회 ${JSON.stringify(r.stats.apply.perLibrary)}`);
  console.log('   경고:', r.warnings.slice(0, 3).join(' | ') || '없음');
}
