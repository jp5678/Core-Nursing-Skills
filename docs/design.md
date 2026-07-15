# 청암대학교 간호학과 핵심기본간호술 교육 플랫폼 — 설계 문서

## 개요
한국간호교육평가원 「핵심기본간호술 평가항목 프로토콜 제4.1판」(2017)의 20개 술기 항목을 기반으로 한
학생·교수용 학습 관리 플랫폼. 빌드 도구 없이 브라우저에서 바로 실행되는 정적 웹앱.

## 기술 스택
- HTML + CSS + Vanilla JS (ES Modules), 해시 라우팅
- 데이터 저장: localStorage (Repository 패턴, 불변 업데이트)
- 서버/빌드 불필요 — 정적 서버로 즉시 구동

## 역할
| 역할 | 기능 |
|------|------|
| 교수 | 대시보드(통계), 학생 관리(CRUD·CSV), 술기 영상 관리, 학생 진도 열람, 수료증 발급/관리 |
| 학생 | 술기 학습(프로토콜·영상), 인터랙티브 퀴즈, 내 진도, 수료증 출력 |

## 데이터 모델
- `student` — id, grade(학년), classNo(반), studentNo(학번), name, email
- `video` — skillId → { url(YouTube), title }
- `progress` — studentId → skillId → { videoWatched, bestScore, passed }
- `quizResult` — studentId, skillId, score, total, createdAt
- `certificate` — certNo, studentId, issuedAt, issuedBy

## 술기 데이터
PDF에서 추출한 20개 항목: 항목명, 난이도(상/중/하), 성취목표, 선행지식, 필요장비·물품,
수행시간, 수행항목 체크리스트(핵심항목 ★ 표시). → `js/data/skills-data.js`

## 퀴즈
술기 데이터에서 자동 생성 (매 응시마다 5문항 무작위):
1. 수행 순서 배열 문제 (연속 4단계 셔플)
2. 필요 물품이 아닌 것 고르기 (타 술기 물품을 오답으로)
3. 핵심 수행항목(★) 식별
4. 첫 수행 단계 고르기
5. 수행시간/난이도 사실 확인

합격 기준: 80점 이상 → 해당 술기 이수 처리.

## 수료증
20개 술기 전체 이수(퀴즈 합격) 시 발급 가능. 교수 수동 발급도 지원. 인쇄(PDF 저장) 레이아웃 제공.

## 파일 구조
```
index.html
css/ base.css, components.css
js/  app.js, router.js, store.js, auth.js
js/data/ skills-data.js
js/utils/ dom.js, quiz-generator.js, csv.js
js/views/ login.js, dashboard.js, students.js, videos.js,
          skill-list.js, skill-detail.js, quiz.js, certificates.js
```

## 데모 계정
- 교수: `prof@scjc.ac.kr` / 비밀번호 `cheongam2026`
- 학생: 학번 + 이메일 (예: `20240101` / `haeun.kim@scjc.ac.kr`)
