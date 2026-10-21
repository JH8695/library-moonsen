// 문체부 어린이누리집 목록(2026-10-10 기준 실제 내용)을 흉내 낸 HTML 로 파서 검증
import { parseNlcyList, collectNlcyWith } from '../scripts/nlcy.mjs';
import { matchTarget, gradeOn, koreanAge } from '../src/lib/grade.js';

const ITEMS = [
 ['준비중','나는야 동화나라 주인공(에코백)','2026.11.14.','2026.10.23.~2026.11.13.',1133339],
 ['대기자접수','AI 고전 탐험대:프란츠 카프카(변신)','2026.10.25.','2026.09.23.~2026.10.24.',1133158],
 ['준비중','AI 고전 탐험대:데미안(헤르만 헤세)','2026.11.08.','2026.10.23.~2026.11.07.',1133338],
 ['접수중','디지털 윤리 수사대(디지털윤리체험관)','2026.10.25.','2026.09.23.~2026.10.24.',1133159],
 ['대기자접수','미꿈소 코딩 교실(코디로키)','2026.10.24.','2026.09.23.~2026.10.23.',1133157],
 ['준비중','AI 고전 탐험대:이상한 나라의 앨리스(루이스 캐럴)','2026.11.21.','2026.10.23.~2026.11.20.',1133340],
 ['준비중','도서관에서 만나는 로봇 친구(카미봇 파이)','2026.11.07.','2026.10.23.~2026.11.06.',1133336],
 ['준비중','책과 함께하는 이야기 코딩(코코보드)','2026.11.07.','2026.10.23.~2026.11.06.',1133337],
 ['접수중','우리가 지켜요! 모스 독도 만들기','2026.10.24.','2026.10.16.~2026.10.23.',1133395],
];
const li = ([st, title, edu, apply, idx]) => `<li><a href="http://www.nlcy.go.kr/NLCY/contents/C20100000000.do?idx=${idx}&amp;schM=view">
<span class="state">${st}</span><ul><li>6세 ~9세 어린이</li><li>선착순</li><li class="tit">${title}</li><li>교육기간: ${edu}</li><li>접수기간: ${apply}</li><li>접수방법: 온라인</li></ul></a></li>`;
const html = `<div class="list"><ul>${ITEMS.map(li).join('')}</ul></div><a href="https://www.nlcy.go.kr/">출처</a>`;

let bad = 0; const check = (n, ok, x = '') => { if (!ok) bad++; console.log(ok ? 'OK ' : 'XX ', n, x); };
const { courses, warnings } = parseNlcyList(html);
check('9건 모두 읽음', courses.length === 9 && warnings.length === 0, `(${courses.length}건, 경고 ${warnings.length})`);
const by = (s) => courses.filter((c) => c.status === s).length;
check('상태: 접수중 2 / 접수예정(준비중) 5 / 대기 2', by('open') === 2 && by('upcoming') === 5 && by('waitlist') === 2);
const c = courses.find((x) => x.id === 'nlcy-1133395');
check('모스 독도 만들기: 제목·대상·방식', c.title === '우리가 지켜요! 모스 독도 만들기' && c.targetText === '6세 ~9세 어린이' && c.selection === '선착순', JSON.stringify([c.title, c.targetText]));
check('날짜: 교육 10/24, 접수 10/16~10/23 (시각 없음)', c.classStart.startsWith('2026-10-24') && c.applyStart === '2026-10-16' && c.applyEnd === '2026-10-23' && c.timeKnown === false);
check('링크는 도서관 상세 페이지(https)', c.url === 'https://www.nlcy.go.kr/NLCY/contents/C20100000000.do?idx=1133395&schM=view', c.url);
const g = gradeOn(2017, new Date('2026-10-24T00:00:00+09:00')), a = koreanAge(2017, new Date('2026-10-24T00:00:00+09:00'));
check('2017년생(초3)에게 "6세 ~9세 어린이"는 해당', matchTarget(c.targetText, g, a, 2017).result === 'match');
const g2 = gradeOn(2020, new Date('2026-10-24T00:00:00+09:00')), a2 = koreanAge(2020, new Date('2026-10-24T00:00:00+09:00'));
check('2020년생(유치원, 만 5~6세)도 6세가 됐다면 해당 → 해당(생일에 따라 다름)', matchTarget(c.targetText, g2, a2, 2020).result === 'match');
const g3 = gradeOn(2022, new Date('2026-10-24T00:00:00+09:00')), a3 = koreanAge(2022, new Date('2026-10-24T00:00:00+09:00'));
check('2022년생(만 3~4세)은 해당 아님', matchTarget(c.targetText, g3, a3, 2022).result === 'nomatch');

// 페이지 넘김: 10건 미만이면 1페이지에서 끝, 구조가 바뀌어 0건이면 경고
const r1 = await collectNlcyWith({ getHtml: async () => html, sleep: async () => {} });
check('9건(<10)이면 한 페이지만 읽고 끝', r1.courses.length === 9);
const r0 = await collectNlcyWith({ getHtml: async () => '<html>바뀐 페이지</html>', sleep: async () => {} });
check('구조가 바뀌어 0건이면 경고', r0.courses.length === 0 && r0.warnings.some((w) => w.includes('하나도 읽지 못했어요')));
console.log(bad ? `\n${bad}건 실패` : '\n국립어린이청소년도서관 파서 전부 통과');
