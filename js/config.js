// 플랫폼 설정
//
// [Google 로그인 설정 방법]
// 1. https://console.cloud.google.com → API 및 서비스 → 사용자 인증 정보
// 2. "OAuth 클라이언트 ID" 생성 (유형: 웹 애플리케이션)
// 3. 승인된 자바스크립트 원본에 서비스 주소 추가 (예: http://localhost:4173)
// 4. 발급받은 클라이언트 ID를 아래에 입력
//
// 비워두면 데모 모드로 동작합니다 (등록된 학교 이메일 입력으로 시뮬레이션).
export const GOOGLE_CLIENT_ID = "";

// 학생 반 선택지
export const CLASS_OPTIONS = ["A", "B", "C", "D", "E", "F"];
