// 화면 확인용 임시 샘플입니다 (실제 강좌 아님). 실데이터 수집기가 붙으면
// public/data/courses.json 이 이 샘플 대신 사용됩니다.
// status: 'open' 접수가능 | 'upcoming' 접수예정 | 'waitlist' 대기 | 'closed' 접수종료

export const SAMPLE_META = { fetchedAt: null, isSample: true, errors: [] };

const GN = 'https://library.gangnam.go.kr/intro/menu/10045/program/30013/lectureList.do';
const YJ = 'https://yangjae.seocholib.or.kr/ProgramCulture';

export const SAMPLE_COURSES = [
  {
    id: 's1', libraryId: 'dogok', title: '[샘플] 초등 코딩 첫걸음',
    targetText: '초등 3~6학년', status: 'open', applied: 12, capacity: 20,
    classStart: '2026-10-24T10:00:00+09:00', classEnd: '2026-11-14T11:30:00+09:00',
    sessions: 4, recurrence: '매주 토',
    applyStart: '2026-10-05T10:00:00+09:00', applyEnd: '2026-10-20T17:00:00+09:00', url: GN,
  },
  {
    id: 's2', libraryId: 'daechi', title: '[샘플] 어린이 과학 실험교실',
    targetText: '초등 저학년', status: 'upcoming', applied: null, capacity: 16,
    classStart: '2026-11-07T14:00:00+09:00', classEnd: '2026-11-07T15:30:00+09:00',
    sessions: 1, recurrence: null,
    applyStart: '2026-10-14T10:00:00+09:00', applyEnd: '2026-11-03T17:00:00+09:00', url: GN,
  },
  {
    id: 's3', libraryId: 'yangjae', title: '[샘플] 가족 동화구연 한마당',
    targetText: '어린이 가족', status: 'open', applied: 8, capacity: 30,
    classStart: '2026-10-31T11:00:00+09:00', classEnd: '2026-10-31T12:00:00+09:00',
    sessions: 1, recurrence: null,
    applyStart: '2026-10-01T09:00:00+09:00', applyEnd: '2026-10-28T18:00:00+09:00', url: YJ,
  },
  {
    id: 's4', libraryId: 'jeulgeoun', title: '[샘플] 영어 그림책 읽기',
    targetText: '5~7세', status: 'open', applied: 5, capacity: 12,
    classStart: '2026-10-22T16:00:00+09:00', classEnd: '2026-11-12T17:00:00+09:00',
    sessions: 4, recurrence: '매주 목',
    applyStart: '2026-10-01T10:00:00+09:00', applyEnd: '2026-10-19T17:00:00+09:00', url: GN,
  },
  {
    id: 's5', libraryId: 'yeoksam', title: '[샘플] 초등 고학년 독서토론',
    targetText: '초등 4~6학년', status: 'upcoming', applied: null, capacity: 15,
    classStart: '2027-03-13T10:00:00+09:00', classEnd: '2027-05-29T11:30:00+09:00',
    sessions: 12, recurrence: '매주 토',
    applyStart: '2027-02-20T10:00:00+09:00', applyEnd: '2027-03-06T17:00:00+09:00', url: GN,
  },
  {
    id: 's6', libraryId: 'segok', title: '[샘플] 부모와 함께하는 보드게임',
    targetText: '누구나', status: 'open', applied: 19, capacity: 20,
    classStart: '2026-10-17T13:00:00+09:00', classEnd: '2026-10-17T15:00:00+09:00',
    sessions: 1, recurrence: null,
    applyStart: '2026-10-02T10:00:00+09:00', applyEnd: '2026-10-15T17:00:00+09:00', url: GN,
  },
  {
    id: 's7', libraryId: 'cheongdam', title: '[샘플] 중학생 진로 탐색',
    targetText: '중학생', status: 'open', applied: 3, capacity: 20,
    classStart: '2026-10-25T14:00:00+09:00', classEnd: '2026-10-25T16:00:00+09:00',
    sessions: 1, recurrence: null,
    applyStart: '2026-10-05T10:00:00+09:00', applyEnd: '2026-10-22T17:00:00+09:00', url: GN,
  },
  {
    id: 's8', libraryId: 'gaepo', title: '[샘플] 만 9세 이상 만들기 교실',
    targetText: '만 9세 이상', status: 'open', applied: 6, capacity: 10,
    classStart: '2026-11-01T10:00:00+09:00', classEnd: '2026-11-01T12:00:00+09:00',
    sessions: 1, recurrence: null,
    applyStart: '2026-10-06T10:00:00+09:00', applyEnd: '2026-10-29T17:00:00+09:00', url: GN,
  },
  {
    id: 's9', libraryId: 'samsung', title: '[샘플] 초등 글쓰기 교실 (마감)',
    targetText: '초등학생', status: 'closed', applied: 20, capacity: 20,
    classStart: '2026-10-15T16:00:00+09:00', classEnd: '2026-11-05T17:00:00+09:00',
    sessions: 4, recurrence: '매주 목',
    applyStart: '2026-09-20T10:00:00+09:00', applyEnd: '2026-10-08T17:00:00+09:00', url: GN,
  },
];
