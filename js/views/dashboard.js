// 교수용 대시보드 — 현황 통계 및 학생별 진도
import { getStudents, getSkills, getVideos, getAllProgress, getCertificates, countPassed } from "../store.js";
import { esc } from "../utils/dom.js";

export function renderDashboard(main) {
  const students = getStudents();
  const skills = getSkills();
  const videos = getVideos();
  const certs = getCertificates();
  const allProgress = getAllProgress();

  const totalPassed = Object.values(allProgress)
    .flatMap((byskill) => Object.values(bySkillSafe(byskill)))
    .filter((p) => p.passed).length;

  function bySkillSafe(v) { return v ?? {}; }

  // 술기별 이수 학생 수
  const passCountBySkill = skills.map((skill) => {
    const count = students.filter((st) => allProgress[st.id]?.[skill.id]?.passed).length;
    return { skill, count };
  });
  const maxCount = Math.max(1, ...passCountBySkill.map((x) => x.count));

  const ranked = students
    .map((st) => ({ st, passed: countPassed(st.id) }))
    .sort((a, b) => b.passed - a.passed);

  main.innerHTML = `
    <div class="page-head">
      <h1>대시보드</h1>
      <div class="sub">핵심기본간호술 20개 항목 학습 현황 (한국간호교육평가원 프로토콜 제4.1판 기준)</div>
    </div>

    <div class="grid cols-4">
      <div class="card stat-tile">
        <div class="label">등록 학생</div>
        <div class="value">${students.length}<span style="font-size:16px">명</span></div>
      </div>
      <div class="card stat-tile">
        <div class="label">등록된 술기 영상</div>
        <div class="value">${Object.keys(videos).length}<span style="font-size:16px"> / ${skills.length}</span></div>
        <div class="hint">영상 관리에서 등록</div>
      </div>
      <div class="card stat-tile">
        <div class="label">누적 술기 이수</div>
        <div class="value">${totalPassed}<span style="font-size:16px">건</span></div>
        <div class="hint">퀴즈 80점 이상 합격 기준</div>
      </div>
      <div class="card stat-tile">
        <div class="label">수료증 발급</div>
        <div class="value">${certs.length}<span style="font-size:16px">건</span></div>
      </div>
    </div>

    <div class="grid cols-2" style="margin-top:18px">
      <div class="card">
        <h2>학생별 이수 현황</h2>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>학번</th><th>성명</th><th>학년/반</th><th style="width:40%">진도</th></tr></thead>
            <tbody>
              ${ranked.map(({ st, passed }) => `
                <tr>
                  <td>${esc(st.studentNo)}</td>
                  <td><strong>${esc(st.name)}</strong></td>
                  <td>${st.grade}학년 ${esc(st.classNo)}반</td>
                  <td>
                    <div class="progress-bar"><div class="fill" style="width:${(passed / skills.length) * 100}%"></div></div>
                    <div class="progress-label">${passed} / ${skills.length} 항목 이수</div>
                  </td>
                </tr>`).join("")}
              ${!students.length ? `<tr><td colspan="4" class="empty-state">등록된 학생이 없습니다.</td></tr>` : ""}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h2>술기별 이수 학생 수</h2>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>#</th><th>술기 항목</th><th>난이도</th><th style="width:35%">이수 학생</th></tr></thead>
            <tbody>
              ${passCountBySkill.map(({ skill, count }) => `
                <tr>
                  <td>${skill.id}</td>
                  <td>${esc(skill.name)}</td>
                  <td><span class="badge diff-${skill.difficulty}">${skill.difficulty}</span></td>
                  <td>
                    <div class="progress-bar"><div class="fill" style="width:${(count / maxCount) * 100}%"></div></div>
                    <div class="progress-label">${count}명</div>
                  </td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}
