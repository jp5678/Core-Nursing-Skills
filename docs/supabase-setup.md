# Supabase 연동 설정 가이드

이 가이드대로 설정하면 데이터가 각 브라우저(localStorage)가 아니라 **공유 데이터베이스**에 저장됩니다.
교수가 등록한 학생 명단을 학생들이 보고, 학습 진도가 교수 대시보드에 실시간 반영됩니다.
소요 시간: 약 15~20분. 모두 무료 티어로 가능합니다.

## 1단계 — Supabase 프로젝트 생성 (약 3분)

1. https://supabase.com 접속 → **Start your project** → GitHub 또는 Google로 가입
2. **New project** 클릭
   - Name: `core-nursing-skills`
   - Database Password: 강한 비밀번호 생성 (별도 보관)
   - Region: `Northeast Asia (Seoul)` 선택
3. 생성 완료까지 1~2분 대기

## 2단계 — 테이블 생성 (약 2분)

1. 왼쪽 메뉴 **SQL Editor** → **New query**
2. 이 저장소의 [`supabase/schema.sql`](../supabase/schema.sql) 파일 내용 전체를 붙여넣기
3. **Run** 클릭 → "Success" 확인

> schema.sql에는 교수 허용 목록(정종필 교수 이메일 2개)과 데모 학생 8명이 포함되어 있습니다.
> 데모 학생이 필요 없으면 파일 하단의 "데모 학생" 블록을 지우고 실행하세요.

## 3단계 — Google 로그인 활성화 (약 10분)

### 3-1. Google Cloud Console에서 OAuth 클라이언트 만들기
1. https://console.cloud.google.com → 프로젝트 생성(또는 기존 선택)
2. **API 및 서비스 → OAuth 동의 화면**: User Type `외부`, 앱 이름·이메일 입력 후 저장
3. **API 및 서비스 → 사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID**
   - 애플리케이션 유형: `웹 애플리케이션`
   - **승인된 리디렉션 URI**에 추가: `https://<프로젝트ID>.supabase.co/auth/v1/callback`
     (프로젝트ID는 Supabase 대시보드 주소에서 확인)
4. 생성된 **클라이언트 ID**와 **클라이언트 보안 비밀** 복사

### 3-2. Supabase에 등록
1. Supabase 대시보드 → **Authentication → Providers → Google**
2. Enable 켜고 클라이언트 ID/보안 비밀 붙여넣기 → Save
3. **Authentication → URL Configuration**:
   - Site URL: `https://jp5678.github.io/Core-Nursing-Skills/`
   - Redirect URLs에 위 주소와 `http://localhost:4173` 추가 (로컬 테스트용)

## 4단계 — 교수 로그인 계정 만들기 (약 1분)

교수는 이메일/비밀번호로 로그인합니다.
1. Supabase 대시보드 → **Authentication → Users → Add user → Create new user**
2. Email: `imjp5678@scjc.ac.kr` (schema.sql의 professors 목록에 있는 이메일이어야 함)
3. Password 입력, **Auto Confirm User** 체크 → 생성

> 교수를 추가하려면: ① professors 테이블에 이메일 추가(Table Editor), ② 같은 이메일로 Auth 사용자 생성.
> 교수도 Google 로그인을 쓰고 싶으면 professors 테이블에 해당 Gmail을 넣고 학생 탭의 Google 버튼으로 로그인하면 됩니다(이메일이 professors에 있으면 자동으로 교수 권한).

## 5단계 — 앱에 연결 정보 입력 (약 1분)

1. Supabase 대시보드 → **Project Settings → API**
2. **Project URL**과 **anon public** 키 복사
3. [`js/config.js`](../js/config.js)에 붙여넣기:

```js
export const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOi...";
```

4. 커밋 & 푸시하면 자동 배포됩니다.

> anon 키는 공개되어도 되는 키입니다(행 단위 보안정책이 접근을 통제).
> 단, **service_role 키는 절대 코드에 넣으면 안 됩니다.**

## 완료 후 동작 방식

| 항목 | 로컬 데모 모드 (설정 전) | 원격 모드 (설정 후) |
|------|------------------------|---------------------|
| 데이터 저장 | 각 브라우저 localStorage | Supabase PostgreSQL (공유) |
| 학생 로그인 | 데모 모달 (이메일 입력) | 실제 Google 계정 OAuth |
| 교수 로그인 | 데모 계정 | Supabase Auth 계정 |
| 접근 통제 | 없음 | 학생은 본인 데이터만 읽기/쓰기, 명단 관리는 교수만 |
| 데모 시드 | 자동 생성 | schema.sql로 1회 입력 |

문제가 생기면 브라우저 개발자 도구(F12) → Console 탭의 오류 메시지를 확인하세요.
