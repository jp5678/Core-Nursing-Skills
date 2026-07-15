// 앱 진입점 — 레이아웃 렌더링 및 라우팅 구성
import { seedIfEmpty } from "./store.js";
import { currentUser, isProfessor, logout } from "./auth.js";
import { route, startRouter, navigate } from "./router.js";
import { esc } from "./utils/dom.js";
import { renderLogin } from "./views/login.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderStudents } from "./views/students.js";
import { renderVideos } from "./views/videos.js";
import { renderSkillList } from "./views/skill-list.js";
import { renderSkillDetail } from "./views/skill-detail.js";
import { renderQuiz } from "./views/quiz.js";
import { renderCertificates, renderCertificatePrint } from "./views/certificates.js";

const app = document.getElementById("app");

const NAV = {
  professor: [
    { hash: "#/dashboard", icon: "📊", label: "대시보드" },
    { hash: "#/students", icon: "👥", label: "학생 관리" },
    { hash: "#/skills", icon: "🩺", label: "술기 목록" },
    { hash: "#/videos", icon: "🎬", label: "영상 관리" },
    { hash: "#/certificates", icon: "📜", label: "수료증 관리" },
  ],
  student: [
    { hash: "#/skills", icon: "🩺", label: "술기 학습" },
    { hash: "#/certificates", icon: "📜", label: "내 수료증" },
  ],
};

// 로그인 필요 여부와 역할을 검사한 뒤 본문을 렌더링하는 래퍼
function page(render, { professorOnly = false } = {}) {
  return (params) => {
    const user = currentUser();
    if (!user) {
      renderLogin(app);
      return;
    }
    if (professorOnly && user.role !== "professor") {
      navigate("#/skills");
      return;
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
          <div class="univ">CHEONGAM UNIVERSITY</div>
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
  app.querySelector("#logout-btn").addEventListener("click", () => {
    logout();
    navigate("#/");
  });
}

function home() {
  const user = currentUser();
  if (!user) renderLogin(app);
  else navigate(isProfessor() ? "#/dashboard" : "#/skills");
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
