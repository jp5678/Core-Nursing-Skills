// 학습 현황 (교수) — 반별 / 학생별 / 술기별 통계
import { getStudents, getSkills, getAllProgress, getCertificateByStudent } from "../store.js";
import { esc } from "../utils/dom.js";

function progressBar(ratio, label) {
  const pct = Math.round(ratio * 100);
  return `
    <div class="progress-bar"><div class="fill" style="width:${pct}%"></div></div>
    <div class="progress-label">${label}</div>`;
}

export function renderStats(main) {
  let gradeFilter = "";
  let classFilter = "";

  function draw() {
    const students = getStudents();
    const skills = getSkills();
    const allProgress = getAllProgress();
    const totalSkills = skills.length;

    const passedOf = (st) =>
      Object.values(allProgress[st.id] ?? {}).filter((p) => p.passed).length;
    const avgScoreOf = (st) => {
      const scores = Object.values(allProgress[st.id] ?? {})
        .map((p) => p.bestScore).filter((s) => s > 0);
      return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    };

    /* ----- 반별 현황 ----- */
    const classGroups = new Map();
    for (const st of students) {
      const key = `${st.grade}학년 ${st.classNo}반`;
      if (!classGroups.has(key)) classGroups.set(key, { grade: st.grade, classNo: st.classNo, members: [] });
      classGroups.get(key).members.push(st);
    }
    const classRows = [...classGroups.entries()]
      .sort(([, a], [, b]) => a.grade - b.grade || a.classNo.localeCompare(b.classNo))
      .map(([label, { members }]) => {
        const totalPassed = members.reduce((sum, st) => sum + passedOf(st), 0);
        const possible = members.length * totalSkills;
        const complete = members.filter((st) => passedOf(st) >= totalSkills).length;
        return { label, count: members.length, ratio: possible ? totalPassed / possible : 0, totalPassed, possible, complete };
      });

    /* ----- 학생별 현황 ----- */
    const grades = [...new Set(students.map((s) => s.grade))].sort();
    const classes = [...new Set(students.map((s) => s.classNo))].sort();
    const studentRows = students
      .filter((st) =>
        (!gradeFilter || String(st.grade) === gradeFilter) &&
        (!classFilter || st.classNo === classFilter))
      .sort((a, b) =>
        a.grade - b.grade ||
        a.classNo.localeCompare(b.classNo, "ko") ||
        a.studentNo.localeCompare(b.studentNo, "ko", { numeric: true }));

    /* ----- 술기별 현황 ----- */
    const skillRows = skills.map((skill) => {
      const scores = [];
      let passedCount = 0;
      for (const st of students) {
        const p = allProgress[st.id]?.[skill.id];
        if (p?.passed) passedCount++;
        if (p?.bestScore > 0) scores.push(p.bestScore);
      }
      const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
      return { skill, passedCount, attempted: scores.length, avg };
    });

    main.innerHTML = `
      <div class="page-head">
        <h1>학습 현황</h1>
        <div class="sub">반별 · 학생별 · 술기별 이수 현황 (퀴즈 80점 이상 합격 기준, 총 ${students.length}명)</div>
      </div>

      <div class="card">
        <h2>🏫 반별 학습 현황</h2>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>반</th><th>인원</th><th style="width:40%">평균 이수율</th><th>이수 항목 합계</th><th>전 항목 이수자</th></tr></thead>
            <tbody>
              ${classRows.map((r) => `
                <tr>
                  <td><strong>${esc(r.label)}</strong></td>
                  <td>${r.count}명</td>
                  <td>${progressBar(r.ratio, `${Math.round(r.ratio * 100)}%`)}</td>
                  <td>${r.totalPassed} / ${r.possible}</td>
                  <td>${r.complete ? `<span class="badge ok">${r.complete}명</span>` : `<span class="badge pending">0명</span>`}</td>
                </tr>`).join("")}
              ${!classRows.length ? `<tr><td colspan="5" class="empty-state">등록된 학생이 없습니다.</td></tr>` : ""}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h2>👤 학생별 학습 현황</h2>
        <div class="toolbar">
          <select id="grade-filter">
            <option value="">전체 학년</option>
            ${grades.map((g) => `<option value="${g}" ${gradeFilter === String(g) ? "selected" : ""}>${g}학년</option>`).join("")}
          </select>
          <select id="class-filter">
            <option value="">전체 반</option>
            ${classes.map((c) => `<option value="${c}" ${classFilter === c ? "selected" : ""}>${c}반</option>`).join("")}
          </select>
          <span class="muted">${studentRows.length}명 표시</span>
        </div>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>학년/반</th><th>학번</th><th>성명</th><th style="width:32%">이수 진도</th><th>평균 점수</th><th>수료증</th></tr></thead>
            <tbody>
              ${studentRows.map((st) => {
                const passed = passedOf(st);
                const avg = avgScoreOf(st);
                const cert = getCertificateByStudent(st.id);
                return `
                <tr>
                  <td>${st.grade}학년 ${esc(st.classNo)}반</td>
                  <td>${esc(st.studentNo)}</td>
                  <td><strong>${esc(st.name)}</strong></td>
                  <td>${progressBar(passed / totalSkills, `${passed} / ${totalSkills} 항목`)}</td>
                  <td>${avg !== null ? `${avg}점` : `<span class="muted">-</span>`}</td>
                  <td>${cert ? `<span class="badge ok">발급</span>` : `<span class="badge pending">미발급</span>`}</td>
                </tr>`;
              }).join("")}
              ${!studentRows.length ? `<tr><td colspan="6" class="empty-state">조건에 맞는 학생이 없습니다.</td></tr>` : ""}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h2>🩺 술기별 학습 현황</h2>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>#</th><th>술기 항목</th><th>난이도</th><th style="width:32%">이수 학생</th><th>응시자</th><th>평균 최고점수</th></tr></thead>
            <tbody>
              ${skillRows.map(({ skill, passedCount, attempted, avg }) => `
                <tr>
                  <td>${skill.id}</td>
                  <td>${esc(skill.name)}</td>
                  <td><span class="badge diff-${skill.difficulty}">${skill.difficulty}</span></td>
                  <td>${progressBar(students.length ? passedCount / students.length : 0, `${passedCount} / ${students.length}명`)}</td>
                  <td>${attempted}명</td>
                  <td>${avg !== null ? `${avg}점` : `<span class="muted">-</span>`}</td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>`;

    main.querySelector("#grade-filter").addEventListener("change", (e) => { gradeFilter = e.target.value; draw(); });
    main.querySelector("#class-filter").addEventListener("change", (e) => { classFilter = e.target.value; draw(); });
  }

  draw();
}
