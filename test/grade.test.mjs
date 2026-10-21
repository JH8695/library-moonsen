// 대상 판정 회귀 테스트: 초3(2017년생), 유치원(2020년생), 중1(2013년생)
import { matchTarget, gradeOn, koreanAge, stageLabel } from '../src/lib/grade.js';
const now = new Date('2026-10-10T12:00:00+09:00');
const kid = (birth) => ({ birth, g: gradeOn(birth, now), age: koreanAge(birth, now) });
const K3 = kid(2017), KP = kid(2020), KM = kid(2013);
let bad = 0, n = 0;
const run = (k, cases) => {
  for (const [text, exp] of cases) {
    n++;
    const r = matchTarget(text, k.g, k.age, k.birth).result;
    if (r !== exp) { bad++; console.log('XX', `[${stageLabel(k.g)}]`, JSON.stringify(text), '기대', exp, '실제', r); }
  }
};
console.log('학년/나이:', stageLabel(K3.g), K3.age, '|', stageLabel(KP.g), KP.age, '|', stageLabel(KM.g), KM.age);

// ── 초3 (이전 테스트 전부)
run(K3, [
 ['시니어','nomatch'],['아빠(자녀가 있는 남성 양육자)','nomatch'],['경제 교육에 관심이 있는 양육자','nomatch'],['중년','nomatch'],
 ['초등 5학년 ~ 고등 3학년, 초등학생 1~2학년 12명','nomatch'],['초등 1학년 ~ 고등 3학년','match'],['초등학생 및 중학생','match'],
 ['초등학교 저학년 자녀를 둔 학부모','nomatch'],['아동기 자녀를 둔 가족','match'],['초등 1~3학년 (보호자 동반)','match'],['4~6학년 학부모','nomatch'],
 ['부모와 자녀','check'],['초등 3~6학년','match'],['초등 4~6학년','nomatch'],['초등학교 1~3학년','match'],['초등 2~4학년','match'],
 ['2018~19년생','nomatch'],['2020~21년생','nomatch'],['2017년생~2014년생','match'],['2016~2017년생','match'],['2018년생~2016년생','match'],
 ['어린이 가족','match'],['누구나','match'],['성인','nomatch'],['5~7세','nomatch'],['9~13세','match'],
 ['만 9세 이상','check'],['만 60세 이상','nomatch'],['만 14세 이상','nomatch'],['만 7~13세','match'],['만19-39세 청년','nomatch'],['중학생','nomatch'],['고등학생','nomatch'],
 ['낭독극, 연극에 관심있는 성인 20명','nomatch'],['성인 20명','nomatch'],['초등학생','match'],['초등','match'],
 ['초등 고학년','nomatch'],['초등 저학년','match'],['중학년','match'],['','check'],['영유아 및 가족','match'],['중1~3','nomatch'],['초3','match'],
 ['성인 누구나','nomatch'],['청소년 누구나','nomatch'],['시니어 누구나','nomatch'],['어린이 및 성인','match'],['성인, 어린이 가족','match'],
 ['전연령','match'],['중학생 누구나','nomatch'],['초등 3~6학년 누구나','match'],['어린이 누구나','match'],
 ['4팀 (대표자 1명만 신청)','check'],['10가족 (가족 중 1명만 신청)','match'],['초등 저학년 15명','match'],['초등 2~3학년 10명','match'],
 ['초등 4~6학년 4팀','nomatch'],['성인 2팀','nomatch'],
 ['예비초등','nomatch'],['초중등','match'],['유아','nomatch'],['미취학 어린이','match'],
]);
// ── 초3: 나이 표기 (세는나이/만 나이 둘 다 고려)
run(K3, [
 ['6세 ~9세 어린이','match'],      // 만 8·9세 모두 범위 안
 ['9~13세','match'],               // 만 9세 + 세는나이 10 → 해당
 ['10~12세','check'],              // 세는나이로만 해당 → 확인
 ['8~10세','match'],               // 만 8·9 모두 범위 안
 ['4~8세','check'],                // 만 8세만 걸침, 세는나이는 아님 → 확인
 ['5~7세','nomatch'],['11~13세','nomatch'],['6세~9세 선착순','match'],
]);
// ── 유치원(2020년생, 세는나이 7)
run(KP, [
 ['5~7세','match'],['유아','match'],['영유아 및 가족','match'],['미취학 어린이','match'],['예비초등','match'],['예비 초등 1학년','match'],['어린이 가족','match'],['누구나','match'],
 ['초등 1~3학년','nomatch'],['초등학생','nomatch'],['초등 저학년','nomatch'],['중학생','nomatch'],['성인','nomatch'],['성인 누구나','nomatch'],
 ['2020~21년생','match'],['2018~19년생','nomatch'],['만 6~7세','check'],['8~10세','nomatch'],['유아 및 초등학생','match'],['시니어','nomatch'],['','check'],
]);
// ── 중1(2013년생, 세는나이 14)
run(KM, [
 ['중학생','match'],['중1~3','match'],['청소년','match'],['초등학생','nomatch'],['초등 3~6학년','nomatch'],['고등학생','nomatch'],['초등학생 및 중학생','match'],
 ['어린이','nomatch'],['누구나','match'],['성인 누구나','nomatch'],['2013년생','match'],['2010~2012년생','nomatch'],['10대','match'],['유아','nomatch'],['초등 5학년 ~ 고등 3학년','match'],
]);
console.log(bad ? `\n${bad}건 불일치 (총 ${n}건)` : `\n판정 전부 통과 (총 ${n}건)`);
