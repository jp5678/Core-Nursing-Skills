// 술기 목록 — 학생: 학습 진입점 / 교수: 프로토콜 열람
import { getSkills, getVideos, getProgress, QUIZ_PASS_SCORE } from "../store.js";
import { esc } from "../utils/dom.js";

export function renderSkillList(main, _params, user) {
  const skills = getSkills();
  const videos = getVideos();
  const isStudent = user.role === "student";
  const progress = isStudent ? getProgress(user.studentId) : {};
  const passedCount = Object.values(progress).filter((p) => p.passed).length;

  main.innerHTML = `
    <div class="page-head">
      <h1>${isStudent ? "술기 학습" : "핵심기본간호술 목록"}</h1>
      <div class="sub">한국간호교육평가원 핵심기본간호술 평가항목 20개 (프로토콜 제4.1판)</div>
    </div>

    ${isStudent ? `
      <div class="card">
        <h2>나의 학습 진도</h2>
        <div class="progress-bar" style="height:14px">
          <div class="fill" style="width:${(passedCount / skills.length) * 100}%"></div>
        </div>
        <div class="progress-label">
          ${passedCount} / ${skills.length} 항목 이수 (퀴즈 ${QUIZ_PASS_SCORE}점 이상 합격)
          ${passedCount >= skills.length ? ` — 🎉 전 항목 이수! <a href="#/certificates">수료증 확인 →</a>` : ""}
        </div>
      </div>` : ""}

    <div class="skill-grid">
      ${skills.map((skill) => {
        const p = progress[skill.id];
        const hasVideo = Boolean(videos[skill.id]);
        return `
        <a class="skill-card" href="#/skills/${skill.id}">
          <div class="no">핵심기본간호술 ${skill.id}</div>
          <div class="name">${esc(skill.name)}</div>
          <div class="meta">
            <span class="badge diff-${skill.difficulty}">난이도 ${skill.difficulty}</span>
            <span class="badge info">${skill.timeMinutes}분</span>
            ${hasVideo ? `<span class="badge info">🎬 영상</span>` : ""}
          </div>
          ${isStudent ? `
            <div class="status">
              ${p?.passed
                ? `<span class="badge ok">✓ 이수 (최고 ${p.bestScore}점)</span>`
                : p?.bestScore
                  ? `<span class="badge pending">학습 중 · 최고 ${p.bestScore}점</span>`
                  : `<span class="badge pending">미학습</span>`}
            </div>` : ""}
        </a>`;
      }).join("")}
    </div>`;
}
