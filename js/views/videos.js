// 술기 영상 관리 (교수) — 술기별로 YouTube URL 여러 개 등록
import { getSkills, getVideos, addVideo, removeVideo } from "../store.js";
import { esc, toYouTubeEmbed, formatDate } from "../utils/dom.js";

export function renderVideos(main) {
  function draw() {
    const skills = getSkills();
    const videos = getVideos();
    const totalCount = Object.values(videos).reduce((n, list) => n + list.length, 0);

    main.innerHTML = `
      <div class="page-head">
        <h1>임상 술기 영상 관리</h1>
        <div class="sub">술기별 교육 영상(YouTube)을 여러 개 등록할 수 있습니다. 학생 학습 화면에 자동으로 표시됩니다.
          (등록 ${totalCount}건)</div>
      </div>
      ${skills.map((skill) => {
        const list = videos[skill.id] ?? [];
        return `
        <div class="card">
          <h2 style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            ${skill.id}. ${esc(skill.name)}
            <span class="badge diff-${skill.difficulty}">${skill.difficulty}</span>
            ${list.length ? `<span class="badge ok">영상 ${list.length}개</span>` : `<span class="badge pending">미등록</span>`}
          </h2>
          ${list.map((v, i) => `
            <div class="video-row">
              <span class="badge info">영상 ${i + 1}</span>
              <span class="video-url">${esc(v.url)}</span>
              <span class="muted">${formatDate(v.updatedAt)}</span>
              <button class="btn btn-danger btn-sm" data-remove="${skill.id}" data-video="${v.id}">삭제</button>
            </div>`).join("")}
          <div class="video-add">
            <input data-url="${skill.id}" placeholder="https://www.youtube.com/watch?v=..." />
            <button class="btn btn-primary btn-sm" data-add="${skill.id}">＋ 영상 추가</button>
          </div>
        </div>`;
      }).join("")}
      <p class="muted">지원 형식: youtube.com/watch, youtu.be, shorts, embed 링크</p>`;

    main.querySelectorAll("[data-add]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const skillId = btn.dataset.add;
        const input = main.querySelector(`[data-url="${skillId}"]`);
        const url = input.value.trim();
        if (!url) { alert("URL을 입력해 주세요."); return; }
        if (!toYouTubeEmbed(url)) { alert("올바른 YouTube 링크가 아닙니다."); return; }
        addVideo(skillId, url);
        draw();
      })
    );
    main.querySelectorAll("[data-remove]").forEach((btn) =>
      btn.addEventListener("click", () => {
        if (confirm("이 영상을 삭제할까요?")) {
          removeVideo(btn.dataset.remove, btn.dataset.video);
          draw();
        }
      })
    );
  }

  draw();
}
