// 술기 상세 — 프로토콜(성취목표·선행지식·물품·체크리스트) + 영상 + 퀴즈 진입
import { getSkill, getVideos, getProgress, updateProgress } from "../store.js";
import { esc, toYouTubeEmbed } from "../utils/dom.js";
import { navigate } from "../router.js";

export function renderSkillDetail(main, params, user) {
  const skill = getSkill(params.id);
  if (!skill) {
    main.innerHTML = `<div class="card empty-state">술기 항목을 찾을 수 없습니다. <a href="#/skills">목록으로</a></div>`;
    return;
  }
  const videoList = getVideos()[skill.id] ?? [];
  const embeds = videoList
    .map((v) => toYouTubeEmbed(v.url))
    .filter(Boolean);
  const isStudent = user.role === "student";
  const p = isStudent ? getProgress(user.studentId)[skill.id] : null;

  main.innerHTML = `
    <div class="page-head">
      <a href="#/skills" class="muted">← 술기 목록</a>
      <h1>${skill.id}. ${esc(skill.name)}</h1>
      <div class="sub">
        <span class="badge diff-${skill.difficulty}">수행난이도 ${skill.difficulty}</span>
        <span class="badge info">수행시간 ${skill.timeMinutes}분</span>
        ${p?.passed ? `<span class="badge ok">✓ 이수 완료 (최고 ${p.bestScore}점)</span>` : ""}
      </div>
    </div>

    <div class="grid cols-2">
      <div>
        <div class="card">
          <h2>🎬 교육 영상${embeds.length > 1 ? ` (${embeds.length}개)` : ""}</h2>
          ${embeds.length
            ? embeds.map((embed, i) => `
                ${embeds.length > 1 ? `<div class="video-label">영상 ${i + 1}</div>` : ""}
                <iframe class="video-frame" src="${esc(embed)}" title="${esc(skill.name)} 교육 영상 ${i + 1}"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowfullscreen></iframe>`).join("")
            : `<div class="video-empty"><span style="font-size:32px">🎬</span>
                 <span>아직 등록된 영상이 없습니다.</span>
                 ${user.role === "professor" ? `<a href="#/videos" class="btn btn-outline btn-sm">영상 등록하러 가기</a>` : ""}
               </div>`}
          ${isStudent ? `
            <div class="form-actions">
              <button class="btn ${p?.videoWatched ? "btn-outline" : "btn-primary"}" id="watch-btn" ${p?.videoWatched ? "disabled" : ""}>
                ${p?.videoWatched ? "✓ 영상 학습 완료됨" : "영상 학습 완료로 표시"}
              </button>
              <button class="btn btn-primary" id="quiz-btn">📝 퀴즈 응시하기</button>
            </div>` : ""}
        </div>

        <div class="card">
          <h2>🎯 성취목표</h2>
          <ul>${skill.objectives.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>
          <h3>📚 관련 선행지식</h3>
          <ul>${skill.priorKnowledge.map((k) => `<li>${esc(k)}</li>`).join("")}</ul>
          <h3>🧰 필요장비 및 물품</h3>
          <ul>${skill.equipment.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
        </div>
      </div>

      <div class="card">
        <h2>✅ 수행항목 체크리스트 <span class="muted">(★ = 핵심 수행항목)</span></h2>
        <div class="steps-list">
          ${skill.steps.map((s) => `
            <div class="step-item ${s.critical ? "critical" : ""}">
              <div class="step-no">${s.no}</div>
              <div class="step-text">${esc(s.text)}</div>
            </div>`).join("")}
        </div>
      </div>
    </div>`;

  if (isStudent) {
    main.querySelector("#watch-btn")?.addEventListener("click", () => {
      updateProgress(user.studentId, skill.id, { videoWatched: true });
      renderSkillDetail(main, params, user);
    });
    main.querySelector("#quiz-btn")?.addEventListener("click", () => navigate(`#/quiz/${skill.id}`));
  }
}
