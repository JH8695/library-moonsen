// 도서관 기준 데이터. 주소·운전시간은 사용자 제공 "미검증 참고값"입니다.
// 틀린 값은 이 파일만 고치면 됩니다. lat/lng 를 채우면 지오코딩을 건너뜁니다.
// station: { name: '도곡역', walkMin: 7 } 형태로 채우면 카드·지도에 표시됩니다 (현재 전부 미조사).

export const ORIGIN = {
  name: '출발지 (언주로 110)',
  address: '서울특별시 강남구 언주로 110',
};

// 동 이름: 강남구통합도서관 사이트의 "도서관 바로가기" 목록에 적힌 행정동 (별관은 표기 없음)
// station 은 { name: '학동역', walkMin: 10 } 형태. 앱의 "도서관 정보 수정"에서도 바꿀 수 있어요.
const DONG = {
  dogok: '도곡1동', gaepo: '개포3동', nonhyeon: '논현2동', 'nonhyeon-maru': '논현1동',
  daechi1: '대치1동', daechi: '대치2동', motgol: '자곡동', 'motgol-hanok': '자곡동',
  samsung: '삼성1동', segok: '세곡동', 'segok-maru': '세곡동', yeoksam2: '역삼2동',
  yeoksam: '역삼1동', 'yeoksam-pureunsol': '역삼1동', yeollin: '일원본동',
  'ilwon-raon': '개포2동', jeongdaun: '청담동', jeulgeoun: '대치4동', cheongdam: '청담동',
  haengbokan: '대치2동',
};

const g = (id, name, address, driveMin, range) => ({
  id, name, region: 'gangnam', address,
  driveMin, driveRange: range, station: null, dong: DONG[id] ?? null, lat: null, lng: null,
});

export const LIBRARIES = [
  g('dogok', '도곡정보문화도서관', '서울특별시 강남구 도곡로18길 57', 8, [6, 9]),
  g('gaepo', '개포하늘꿈도서관', '서울특별시 강남구 개포로110길 54', 11, [9, 13]),
  g('nonhyeon', '논현도서관', '서울특별시 강남구 학동로43길 17', 17, [14, 19]),
  g('nonhyeon-maru', '논현문화마루도서관', '서울특별시 강남구 논현로131길 40', 18, [15, 20]),
  g('nonhyeon-maru-annex', '논현문화마루도서관(별관)', '서울특별시 강남구 학동로 169', 17, [14, 19]),
  g('daechi1', '대치1동작은도서관', '서울특별시 강남구 남부순환로391길 19', 7, [5, 8]),
  g('daechi', '대치도서관', '서울특별시 강남구 삼성로 212', 8, [6, 10]),
  g('motgol', '못골도서관', '서울특별시 강남구 자곡로 116', 16, [13, 18]),
  g('motgol-hanok', '못골한옥어린이도서관', '서울특별시 강남구 자곡로7길 3', 17, [14, 19]),
  g('samsung', '삼성도서관', '서울특별시 강남구 봉은사로 616', 15, [12, 17]),
  g('segok', '세곡도서관', '서울특별시 강남구 밤고개로 286', 19, [16, 22]),
  g('segok-maru', '세곡마루도서관', '서울특별시 강남구 헌릉로590길 68', 20, [17, 23]),
  g('yeoksam2', '역삼2동작은도서관', '서울특별시 강남구 언주로 314', 8, [6, 9]),
  g('yeoksam', '역삼도서관', '서울특별시 강남구 역삼로7길 16', 10, [8, 12]),
  g('yeoksam-pureunsol', '역삼푸른솔도서관', '서울특별시 강남구 테헤란로8길 36', 10, [8, 12]),
  g('yeollin', '열린도서관', '서울특별시 강남구 일원로 115', 11, [9, 13]),
  g('ilwon-raon', '일원라온영어도서관', '서울특별시 강남구 영동대로 22', 9, [7, 11]),
  g('jeongdaun', '정다운도서관', '서울특별시 강남구 학동로67길 11', 17, [14, 19]),
  g('jeulgeoun', '즐거운도서관', '서울특별시 강남구 도곡로77길 23', 9, [7, 10]),
  g('cheongdam', '청담도서관', '서울특별시 강남구 압구정로79길 26', 19, [16, 21]),
  g('haengbokan', '행복한도서관', '서울특별시 강남구 영동대로65길 24', 10, [8, 12]),
  {
    // 주소·운전시간 미조사: 지도에서는 키워드 검색으로 위치를 찾습니다.
    id: 'yangjae', name: '서초구립양재도서관', region: 'seocho',
    address: null, query: '서초구립양재도서관',
    driveMin: null, driveRange: null, station: null, dong: null, lat: null, lng: null,
  },
];

export const LIBRARY_BY_ID = Object.fromEntries(LIBRARIES.map((l) => [l.id, l]));

export const REGIONS = [
  { id: 'all', label: '전체' },
  { id: 'gangnam', label: '강남구' },
  { id: 'seocho', label: '양재' },
];
