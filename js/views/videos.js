// 술기 영상 관리 (교수) — 술기별 YouTube URL 등록
import { getSkills, getVideos, setVideo } from "../store.js";
import { esc, toYouTubeEmbed, formatDate } from "../utils/dom.js";

export function renderVideos(main) {
  function draw() {
    const skills = getSkills();
    const videos = getVideos();
    main.innerHTML = `
      <div class="page-head">
        <h1>임상 술기 영상 관리</h1>
        <div class="sub">술기 항목별 교육 영상(YouTube)을 등록하세요. 학생 학습 화면에 자동으로 표시됩니다.</div>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table class="data">
            <thead><tr>
              <th>#</th><th>술기 항목</th><th>난이도</th><th style="width:38%">YouTube URL</th><th>상태</th><th></th>
            </tr></thead>
            <tbody>
              ${skills.map((skill) => {
                const video = videos[skill.id];
                return `
                <tr>
                  <td>${skill.id}</td>
                  <td>${esc(skill.name)}</td>
                  <td><span class="badge diff-${skill.difficulty}">${skill.difficulty}</span></td>
                  <td><input style="width:100%;padding:7px 10px;border:1px solid var(--c-border);border-radius:6px"
                        data-url="${skill.id}" value="${esc(video?.url ?? "")}"
                        placeholder="https://www.youtube.com/watch?v=..." /></td>
                  <td>${video
                    ? `<span class="badge ok">등록됨</span><div class="muted">${formatDate(video.updatedAt)}</div>`
                    : `<span class="badge pending">미등록</span>`}</td>
                  <td style="white-space:nowrap">
                    <button class="btn btn-primary btn-sm" data-save="${skill.id}">저장</button>
                    ${video ? `<button class="btn btn-danger btn-sm" data-remove="${skill.id}">삭제</button>` : ""}
                  </td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
        <p class="muted" style="margin-top:10px">지원 형식: youtube.com/watch, youtu.be, shorts, embed 링크</p>
      </div>`;

    main.querySelectorAll("[data-save]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const skillId = btn.dataset.save;
        const url = main.querySelector(`[data-url="${skillId}"]`).value.trim();
        if (!url) { alert("URL을 입력해 주세요."); return; }
        if (!toYouTubeEmbed(url)) { alert("올바른 YouTube 링크가 아닙니다."); return; }
        setVideo(skillId, url);
        draw();
      })
    );
    main.querySelectorAll("[data-remove]").forEach((btn) =>
      btn.addEventListener("click", () => {
        if (confirm("이 술기의 영상을 삭제할까요?")) {
          setVideo(btn.dataset.remove, null);
          draw();
        }
      })
    );
  }

  draw();
}
