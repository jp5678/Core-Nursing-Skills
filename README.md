# 청암대학교 간호학과 · 핵심기본간호술 교육 플랫폼

한국간호교육평가원 「핵심기본간호술 평가항목 프로토콜 제4.1판」(2017)의 **20개 술기 항목**을 기반으로 한
학생·교수용 학습 관리 웹 플랫폼입니다. 첨부 PDF에서 추출한 술기별 성취목표·선행지식·필요물품·수행
체크리스트(핵심항목 ★ 포함)가 그대로 내장되어 있습니다.

## 실행 방법

빌드 과정이 필요 없습니다. 프로젝트 폴더에서 정적 서버를 띄우면 됩니다.

```bash
cd "Core Nursing Skills"
python3 -m http.server 4173
# 브라우저에서 http://localhost:4173 접속
```

> ES 모듈을 사용하므로 `index.html`을 파일로 직접 열면 동작하지 않습니다. 반드시 서버로 실행하세요.

## 데모 계정

| 역할 | 로그인 정보 |
|------|-------------|
| 교수 | 비공개 (`js/auth.js`의 `PROFESSOR` 상수 참조) |
| 학생 | Google 계정 로그인 전용 — 데모 모드에서는 등록된 이메일 입력 (예: `haeun.kim@scjc.ac.kr`) |

## 주요 기능

### 교수
- **대시보드** — 등록 학생 수, 영상 등록 현황, 누적 이수, 수료증 발급 통계 / 학생별·술기별 진도
- **학생 관리** — 개별 등록·수정·삭제(반은 A~F 드롭다운), 일괄 등록(여러 줄 붙여넣기, 쉼표/탭 구분), 검색·학년 필터, CSV 가져오기/내보내기(Excel 호환)
- **영상 관리** — 술기별 YouTube 영상 등록 (watch / youtu.be / shorts / embed 링크 지원)
- **수료증 관리** — 20개 전 항목 이수 학생에게 발급(자동 채번: `청암간호-연도-0000`), 출력, 발급 취소

### 학생
- **로그인** — Google 계정 로그인 전용(아래 설정 참고)
- **술기 학습** — 20개 항목 카드(난이도·수행시간 배지), 진도바
- **술기 상세** — 교육 영상, 성취목표, 선행지식, 필요장비·물품, 수행항목 체크리스트(핵심항목 ★ 강조)
- **인터랙티브 퀴즈** — 프로토콜 데이터에서 매회 자동 생성되는 5문항
  (수행 순서 / 필요 물품 / 핵심항목 식별 / 우선순위 / 성취목표), 80점 이상 합격 → 이수 처리
- **수료증** — 전 항목 이수 후 교수 발급 시 열람·인쇄(PDF 저장)

## 기술 구조

- Vanilla JS (ES Modules) + 해시 라우팅, 빌드 도구 없음
- 데이터 저장: 브라우저 `localStorage` (Repository 패턴)
- 술기 데이터: `js/data/skills-data.js` — PDF에서 자동 추출 (20개 항목, 489개 수행 단계)

```
index.html          앱 셸
css/                base.css(레이아웃·변수) / components.css(컴포넌트)
js/app.js           진입점·라우팅·레이아웃
js/store.js         localStorage 저장소 (학생/영상/진도/퀴즈/수료증)
js/auth.js          데모용 로그인 (교수/학생)
js/router.js        해시 라우터
js/data/            skills-data.js (술기 20개 프로토콜)
js/utils/           quiz-generator.js / csv.js / dom.js
js/views/           login / dashboard / students / videos /
                    skill-list / skill-detail / quiz / certificates
docs/design.md      설계 문서
```

## 데이터 저장 — Supabase 연동 (권장)

기본값은 브라우저 localStorage 데모 모드입니다(사용자 간 데이터가 공유되지 않음).
**[docs/supabase-setup.md](docs/supabase-setup.md)** 가이드에 따라 Supabase(무료)를 연결하면
공유 데이터베이스 + 실제 Google 로그인 + 행 단위 접근권한(학생은 본인 데이터만)으로 전환됩니다.
테이블 스키마와 보안정책은 [supabase/schema.sql](supabase/schema.sql)에 있으며,
`js/config.js`에 URL과 anon 키만 입력하면 자동으로 원격 모드로 동작합니다.

## Google 로그인 설정 (데모 모드용)

`js/config.js`의 `GOOGLE_CLIENT_ID`에 Google Cloud Console에서 발급한 OAuth 클라이언트 ID를 입력하면
실제 Google 인증(Google Identity Services)이 활성화됩니다. 비워두면 **데모 모드**로 동작하여
등록된 학교 이메일 입력으로 로그인을 시뮬레이션합니다. 어느 모드든 교수가 등록한 학생 이메일과
일치해야 로그인됩니다.

## 운영 배포 시 유의사항 (현재는 데모)

- **인증**: 클라이언트 사이드 데모 로그인입니다. 실제 운영 시 서버 인증(학교 SSO/LMS 연동)으로 교체하세요.
- **데이터**: localStorage는 브라우저별 저장입니다. 다인 사용 환경에서는 백엔드(DB)가 필요합니다.
- **직인/서식**: 수료증의 학과장 명의·직인은 자리표시자입니다. 공식 사용 전 학과 승인을 받으세요.
