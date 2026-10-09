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
