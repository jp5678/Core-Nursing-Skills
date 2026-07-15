// 앱 진입점 — 레이아웃 렌더링 및 라우팅 구성
import { seedIfEmpty } from "./store.js";
import { currentUser, isProfessor, logout } from "./auth.js";
import { isRemote, initBackend, refreshCache, getInitError } from "./backend.js";
import { route, startRouter, navigate } from "./router.js";
import { esc } from "./utils/dom.js";
import { renderLogin } from "./views/login.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderStudents } from "./views/students.js";
import { renderVideos } from "./views/videos.js";
import { renderSkillList } from "./views/skill-list.js";
import { renderSkillDetail } from "./views/skill-detail.js";
import { renderQuiz } from "./views/quiz.js?v=2";
import { renderCertificates, renderCertificatePrint } from "./views/certificates.js";

const app = document.getElementById("app");

// 어두운 사이드바에서도 잘 보이도록 밝은 색 SVG 청진기 아이콘 사용
const STETHOSCOPE_ICON = `<svg width="19" height="19" viewBox="0 0 24 24" fill="none"
  stroke="#fbbf24" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/>
  <path d="M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4"/>
  <circle cx="20" cy="10" r="2"/>
</svg>`;

const NAV = {
  professor: [
    { hash: "#/dashboard", icon: "📊", label: "대시보드" },
    { hash: "#/students", icon: "👥", label: "학생 관리" },
    { hash: "#/skills", icon: STETHOSCOPE_ICON, label: "술기 목록" },
    { hash: "#/videos", icon: "🎬", label: "영상 관리" },
    { hash: "#/certificates", icon: "📜", label: "수료증 관리" },
  ],
  student: [
    { hash: "#/skills", icon: STETHOSCOPE_ICON, label: "술기 학습" },
    { hash: "#/certificates", icon: "📜", label: "내 수료증" },
  ],
};

// 로그인 필요 여부와 역할을 검사한 뒤 본문을 렌더링하는 래퍼
function page(render, { professorOnly = false } = {}) {
  return async (params) => {
    const user = currentUser();
    if (!user) {
      renderLogin(app);
      return;
    }
    if (professorOnly && user.role !== "professor") {
      navigate("#/skills");
      return;
    }
    // 원격 모드: 페이지 이동 시 서버 데이터를 새로 동기화
    if (isRemote()) {
      try {
        await refreshCache();
      } catch (err) {
        console.error("데이터 동기화 실패:", err);
      }
    }
    renderLayout(user);
    const main = app.querySelector(".main");
    try {
      render(main, params, user);
    } catch (err) {
      console.error("페이지 렌더링 오류:", err);
      main.innerHTML = `<div class="card"><h2>오류가 발생했습니다</h2>
        <p class="muted">${esc(err.message)}</p></div>`;
    }
  };
}

function renderLayout(user) {
  const items = NAV[user.role] ?? [];
  const current = location.hash.split("/").slice(0, 2).join("/");
  app.innerHTML = `
    <div class="layout">
      <aside class="sidebar no-print">
        <div class="brand">
          <div class="univ">CHEONGAM UNIVERSITY · DEPT. OF NURSING</div>
          <div class="title">청암대학교 간호학과<br/>핵심기본간호술 교육 플랫폼</div>
        </div>
        <nav>
          ${items.map((i) => `
            <a href="${i.hash}" class="${current === i.hash ? "active" : ""}">
              <span class="nav-icon">${i.icon}</span>${i.label}
            </a>`).join("")}
        </nav>
        <div class="user-box">
          <div class="name">${esc(user.name)}</div>
          <div class="role">${user.role === "professor" ? "교수" : "학생"} · ${esc(user.email)}</div>
          <button id="logout-btn">로그아웃</button>
        </div>
      </aside>
      <div class="content-col">
        <main class="main"></main>
        <footer class="site-footer no-print">
          청암대학교 간호학과 · 정종필 교수 · imjp5678@scjc.ac.kr
        </footer>
      </div>
    </div>`;
  app.querySelector("#logout-btn").addEventListener("click", async () => {
    await logout();
    navigate("#/");
  });
}

function home() {
  const user = currentUser();
  if (!user) renderLogin(app);
  else navigate(isProfessor() ? "#/dashboard" : "#/skills");
}

async function bootstrap() {
  if (isRemote()) {
    try {
      // 어떤 경우에도 '불러오는 중' 화면에서 무한 대기하지 않도록 시간 제한
      await Promise.race([
        initBackend(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("서버 응답이 없습니다 (20초 초과). 네트워크를 확인해 주세요.")), 20000)
        ),
      ]);
    } catch (err) {
      console.error("백엔드 초기화 실패:", err);
      alert(`서버 연결에 실패했습니다. 새로고침 후 다시 시도해 주세요.\n${err.message}`);
    }
    const authError = getInitError();
    if (authError) alert(authError); // 예: 미등록 Google 계정, OAuth 복귀 오류
  }
  seedIfEmpty();

  route("#/", home);
  route("#/dashboard", page(renderDashboard, { professorOnly: true }));
  route("#/students", page(renderStudents, { professorOnly: true }));
  route("#/videos", page(renderVideos, { professorOnly: true }));
  route("#/skills", page(renderSkillList));
  route("#/skills/:id", page(renderSkillDetail));
  route("#/quiz/:id", page(renderQuiz));
  route("#/certificates", page(renderCertificates));
  route("#/certificates/print/:id", page(renderCertificatePrint));

  startRouter();
}

bootstrap();
