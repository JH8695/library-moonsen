// 서초구립양재도서관 문화프로그램 JSON API 파서 (네트워크 없이 테스트 가능하도록 분리)
export const API_URL = 'https://yangjae.seocholib.or.kr/service/libProgramsCulture/list';
export const PAGE_URL = 'https://yangjae.seocholib.or.kr/ProgramCulture';
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const pad = (n) => String(n).padStart(2, '0');

const seoulYmd = (epochSec) =>
  new Date(epochSec * 1000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

function statusOf(name, code, warnings, title) {
  const n = name || '';
  if (/대기자/.test(n)) return 'waitlist';
  if (/마감|종료/.test(n)) return 'closed';
  if (/접수중|접수하기|신청/.test(n)) return 'open';
  if (/대기중|예정/.test(n)) return 'upcoming';
  const byCode = { 1: 'upcoming', 2: 'open', 3: 'closed', 4: 'waitlist' }[code];
  if (!byCode) warnings.push(`알 수 없는 상태: "${n}" (코드 ${code}) — ${title}`);
  return byCode ?? 'closed';
}

export function parseYangjae(json) {
  const warnings = [];
  if (json?.status !== 'OK' || !Array.isArray(json?.data?.data)) {
    throw new Error(`예상과 다른 응답 형식 (status=${json?.status})`);
  }
  const courses = json.data.data.map((r) => {
    const title = (r.leLName || '').replace(/\s+/g, ' ').trim();

    // 수업 시간: "토14:00 ~ 16:00", "목10:00~12:00", "토10:00-12:00"
    const tm = (r.leBeginTime || '').match(/([일월화수목금토])?\s*(\d{1,2}):(\d{2})\s*[~\-]\s*(\d{1,2}):(\d{2})/);
    const startT = tm ? `${pad(tm[2])}:${tm[3]}` : null;
    const endT = tm ? `${pad(tm[4])}:${tm[5]}` : null;
    const dow = tm?.[1] ?? null;

    const first = r.leOpenSDateFmt;
    const last = r.leOpenEDateFmt;
    if (dow && first) {
      const real = WEEKDAYS[new Date(`${first}T12:00:00+09:00`).getUTCDay()];
      if (real !== dow) warnings.push(`요일 불일치: ${title} ${first} 원문 ${dow} / 계산 ${real}`);
    }
    // 에포크 값과 포맷 문자열이 같은 날짜인지 교차 검증
    if (r.leTakeSDate && seoulYmd(r.leTakeSDate) !== r.leTakeSDateFmt) {
      warnings.push(`접수시작 날짜 불일치: ${title}`);
    }

    return {
      id: `yj-${r.leCode}`,
      source: 'yangjae',
      libraryId: 'yangjae',
      libraryNameRaw: '양재',
      title,
      // 대상 칸이 비어 있으면 분류(어린이/누구나/성인)를 대신 사용
      targetText: (r.leTarget || '').trim() || (r.leLPart !== '이전프로그램' ? r.leLPart : '') || '',
      category: r.leLPart,
      status: statusOf(r.cultureStatusName, r.cultureStatus, warnings, title),
      statusText: r.cultureStatusName,
      capacity: Number(r.leOnline || r.leTotal) || null,
      applied: r.appCnt ?? null,
      waitCapacity: Number(r.leSecond) || null,
      waitApplied: r.waitCnt ?? null,
      // 접수 시작/마감은 시각까지 제공됨 (에포크 초 → ISO)
      applyStart: r.leTakeSDate ? new Date(r.leTakeSDate * 1000).toISOString() : null,
      applyEnd: r.leTakeEDate ? new Date(r.leTakeEDate * 1000).toISOString() : null,
      classStart: first ? `${first}T${startT ?? '00:00'}:00+09:00` : null,
      classEnd: last ? `${last}T${endT ?? startT ?? '00:00'}:00+09:00` : null,
      timeKnown: !!startT,
      sessions: null,
      recurrence: dow && first !== last ? `매주 ${dow}` : null,
      place: r.leArea || null,
      url: PAGE_URL, // 상세 페이지 주소 규칙은 확인 전
    };
  });
  return {
    courses,
    warnings,
    totalPage: json.data.totalPage ?? null,
    rawTakeEnds: json.data.data.map((r) => (r.leTakeEDate ?? 0) * 1000),
    categories: json.data.data.map((r) => r.leLPart),
  };
}
