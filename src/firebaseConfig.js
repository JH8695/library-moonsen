// Firebase 웹 앱 설정 ("서울 체험 예약" 앱과 같은 프로젝트: children1503).
// 이 값들은 브라우저에 공개되는 값이라 코드에 들어가도 괜찮아요. 실제 보안은 Firestore 보안 규칙과
// Authentication 의 "승인된 도메인"이 담당해요. (비밀 키·서비스 계정 키는 절대 넣지 마세요.)
// 값을 비우면 로그인·동기화 기능이 꺼지고, 숨기기는 이 기기 안에서만 동작합니다.
export const firebaseConfig = {
  apiKey: 'AIzaSyBnplOlqWSBylmDMg4NYkRygZ4DyO2VTEE',
  authDomain: 'children1503.firebaseapp.com',
  projectId: 'children1503',
  storageBucket: 'children1503.firebasestorage.app',
  messagingSenderId: '746949477710',
  appId: '1:746949477710:web:d33df62bcc6e9eaee74a1f',
};

export const isFirebaseConfigured = () =>
  !!(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
