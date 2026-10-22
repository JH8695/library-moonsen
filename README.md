# 우리 아이 도서관 강좌

강남구립도서관 + 서초구립양재도서관 문화강좌를 한 화면에서 보는 개인용 모바일 웹앱 (React + Vite + 카카오맵).

## 실행
```bash
npm install
cp .env.example .env.local   # VITE_KAKAO_JS_KEY 에 카카오 JavaScript 키 입력
npm run dev
```
카카오 개발자 콘솔 > 내 애플리케이션 > 플랫폼 > Web 에 `http://localhost:5173` (배포 후에는 배포 주소)을 등록해야 지도가 뜹니다.

## 현재 상태
- 강좌 데이터는 `src/data/sampleCourses.js` 의 **샘플**입니다. 실데이터 수집기가 `public/data/courses.json` 을 만들면 자동으로 그쪽을 씁니다.
- 학년 계산: 출생연도 + **수업 시작일** 기준 (3월에 학년이 올라감). 설정에서 출생연도/학년 직접 선택 가능.
- 주소·운전시간·역 정보는 `src/data/libraries.js` 에서 수정 (운전시간은 미검증 참고값).
- 좌표는 처음 한 번만 카카오 지오코딩 → 브라우저에 저장. `libraries.js` 에 lat/lng 를 넣으면 지오코딩 자체를 생략.

## courses.json 형식
```json
{
  "meta": { "fetchedAt": "2026-10-10T09:00:00+09:00", "errors": [{ "source": "양재도서관", "message": "연결 실패" }] },
  "courses": [{
    "id": "고유값", "libraryId": "dogok", "title": "", "targetText": "초등 3~6학년",
    "status": "open|upcoming|waitlist|closed", "applied": 12, "capacity": 20,
    "classStart": "2026-10-24T10:00:00+09:00", "classEnd": "2026-11-14T11:30:00+09:00",
    "sessions": 4, "recurrence": "매주 토",
    "applyStart": "...", "applyEnd": "...", "url": "원본 상세 페이지"
  }]
}
```

## PC·폰에서 함께 쓰기 (GitHub Pages 무료 배포)
1. GitHub에서 새 저장소(Private 가능)를 만들고 이 폴더를 `main` 브랜치로 push
2. 저장소 Settings > Secrets and variables > Actions > New repository secret
   - 이름 `VITE_KAKAO_JS_KEY`, 값 = 카카오 JavaScript 키
3. Settings > Pages > Source 를 **GitHub Actions** 로 설정
4. push 하면 자동 배포 → `https://<아이디>.github.io/<저장소>/` 주소 발급
5. 카카오 개발자 콘솔 > 플랫폼 > Web 에 위 주소(`https://<아이디>.github.io`) 등록
6. 폰: 브라우저에서 열고 "홈 화면에 추가"
> 무료 계정의 Private 저장소는 Pages 배포가 안 될 수 있어요. 그땐 Public 으로 두거나 Cloudflare Pages / Netlify 를 쓰세요.
> 출생연도 설정은 기기별로 따로 저장됩니다 (기본값 2017년생).


## 체험 앱에서 가져온 기능 (아이 여러 명 · 숨기기 · 찜 · 메모 · 검색 · 구글 동기화)

- 설정 오른쪽 위 버튼에서 아이를 여러 명 등록해요. 카드마다 아이별 ✓/✕가 나와요. (예전의 출생연도 하나 설정은 자동으로 아이 1명으로 옮겨져요.)
- 카드 아래 "관심 없어요"로 숨기고, 옵션 "숨긴 것만 보기"에서 다시 보이게 해요. PC 달력 아래 줄에는 ✕와 ✎(메모) 버튼이 있어요.
- 찜 ♡, 메모 📝, 강좌명·도서관 검색. (수강료 정보가 목록에 없어서 "무료만 보기"는 없어요.)
- 제목을 누르면 서울 아이 체험 앱으로 이동하는 메뉴(▾)가 열려요.
- 구글 로그인 동기화: 체험 앱과 같은 Firebase 프로젝트·같은 문서(`users/{uid}`)를 쓰되, 이 앱은 문서 안의 `library` 항목만 읽고 써요(체험 앱은 `data`·`stamps` 항목). Firestore 규칙은 체험 앱과 같아요. 같은 구글 계정이면 설정 창의 "체험 앱에서 아이 정보 가져오기"로 아이 정보를 한 번에 옮길 수 있어요.
- 합치는 규칙: `src/lib/sync.js` (+ `test/sync.test.mjs`)

## 테스트

```
npm test
```


## 찜 · 메모 · 검색 · 제목 이동 메뉴 · 체험 앱 아이 정보 가져오기

- 카드의 ♡ 로 찜, 📝 메모 로 메모를 남겨요. 위의 검색창으로 강좌명·도서관을 찾고, "♡ 찜 N"을 누르면 찜한 것만 보여요.
- 찜과 메모도 숨김처럼 구글 로그인 동기화에 포함돼요. 같은 문서(`users/{uid}/apps/library-courses`)의 `favs`, `notes` 항목에 강좌 하나씩 저장해요. (`src/lib/syncEngine.js`, 시험은 `test/sync-maps.test.mjs`)
- 옵션의 "숨긴 것만 보기"를 켜면 숨긴 강좌만 나오고, 각 카드의 "숨김 해제"로 되살려요. 숨길 때 "되돌리기" 안내가 떠요.
- PC 달력 아래 줄에는 ✎(메모)와 ✕(숨기기) 버튼이 있어요.
- 제목(도서관 강좌 ▾)을 누르면 서울 아이 체험 앱으로 이동하는 메뉴가 열려요.
- 설정 > "체험 앱에서 아이 정보 가져오기": 같은 구글 계정으로 로그인했을 때, 체험 앱에 입력한 아이 이름·출생연도를 읽어 와요(읽기만 해요).
- Firestore 규칙: 체험 앱 문서(`users/{uid}`)와 이 앱 문서(`users/{uid}/apps/{appId}`) 둘 다 본인만 읽고 쓰게 해 두어야 해요.

## 테스트

```
npm test
```
