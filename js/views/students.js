// 학생 관리 — CRUD, 검색/필터, CSV 가져오기/내보내기
import { getStudents, addStudent, updateStudent, deleteStudent, countPassed, getSkills } from "../store.js";
import { esc, el } from "../utils/dom.js";
import { exportStudentsCsv, parseStudentsCsv } from "../utils/csv.js";
import { CLASS_OPTIONS } from "../config.js";

export function renderStudents(main) {
  let keyword = "";
  let gradeFilter = "";

  function filtered() {
    return getStudents().filter((s) => {
      if (gradeFilter && String(s.grade) !== gradeFilter) return false;
      if (!keyword) return true;
      const k = keyword.toLowerCase();
      return [s.name, s.studentNo, s.email, s.classNo].some((v) => String(v).toLowerCase().includes(k));
    });
  }

  function draw() {
    const totalSkills = getSkills().length;
    const list = filtered();
    main.innerHTML = `
      <div class="page-head">
        <h1>학생 관리</h1>
        <div class="sub">간호학과 학생 등록·수정 및 명단 관리 (총 ${getStudents().length}명)</div>
      </div>

      <div class="card">
        <div class="toolbar">
          <input type="search" id="search" placeholder="성명·학번·이메일 검색" value="${esc(keyword)}" />
          <select id="grade-filter">
            <option value="">전체 학년</option>
            ${[1, 2, 3, 4].map((g) => `<option value="${g}" ${gradeFilter === String(g) ? "selected" : ""}>${g}학년</option>`).join("")}
          </select>
          <div class="spacer"></div>
          <button class="btn btn-outline btn-sm" id="csv-export">⬇ CSV 내보내기</button>
          <label class="btn btn-outline btn-sm" style="cursor:pointer">
            ⬆ CSV 가져오기<input type="file" id="csv-import" accept=".csv" hidden />
          </label>
          <button class="btn btn-outline btn-sm" id="bulk-btn">📋 일괄 등록</button>
          <button class="btn btn-primary btn-sm" id="add-btn">＋ 학생 등록</button>
        </div>
        <div class="table-wrap">
          <table class="data">
            <thead><tr>
              <th>학년</th><th>반</th><th>학번</th><th>성명</th><th>이메일</th><th>이수 현황</th><th></th>
            </tr></thead>
            <tbody>
              ${list.map((s) => `
                <tr>
                  <td>${s.grade}학년</td>
                  <td>${esc(s.classNo)}반</td>
                  <td>${esc(s.studentNo)}</td>
                  <td><strong>${esc(s.name)}</strong></td>
                  <td>${esc(s.email)}</td>
                  <td><span class="badge ${countPassed(s.id) >= totalSkills ? "ok" : "info"}">${countPassed(s.id)} / ${totalSkills}</span></td>
                  <td style="white-space:nowrap">
                    <button class="btn btn-outline btn-sm" data-edit="${s.id}">수정</button>
                    <button class="btn btn-danger btn-sm" data-del="${s.id}">삭제</button>
                  </td>
                </tr>`).join("")}
              ${!list.length ? `<tr><td colspan="7" class="empty-state">조건에 맞는 학생이 없습니다.</td></tr>` : ""}
            </tbody>
          </table>
        </div>
      </div>`;

    main.querySelector("#search").addEventListener("input", (e) => {
      keyword = e.target.value;
      drawPreservingFocus("#search");
    });
    main.querySelector("#grade-filter").addEventListener("change", (e) => {
      gradeFilter = e.target.value;
      draw();
    });
    main.querySelector("#add-btn").addEventListener("click", () => openForm(null));
    main.querySelector("#bulk-btn").addEventListener("click", openBulkForm);
    main.querySelector("#csv-export").addEventListener("click", () => exportStudentsCsv(getStudents()));
    main.querySelector("#csv-import").addEventListener("change", handleCsvImport);
    main.querySelectorAll("[data-edit]").forEach((b) =>
      b.addEventListener("click", () => openForm(getStudents().find((s) => s.id === b.dataset.edit)))
    );
    main.querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", () => {
        const st = getStudents().find((s) => s.id === b.dataset.del);
        if (st && confirm(`${st.name}(${st.studentNo}) 학생을 삭제할까요?\n학습 진도 기록도 함께 삭제됩니다.`)) {
          deleteStudent(st.id);
          draw();
        }
      })
    );
  }

  function drawPreservingFocus(selector) {
    const pos = main.querySelector(selector)?.selectionStart;
    draw();
    const input = main.querySelector(selector);
    if (input) { input.focus(); input.setSelectionRange(pos, pos); }
  }

  function openForm(student) {
    const modal = el(`
      <div class="modal-back">
        <div class="modal">
          <h2>${student ? "학생 정보 수정" : "학생 등록"}</h2>
          <form id="student-form">
            <div class="form-grid">
              <div class="field"><label>학년</label>
                <select name="grade">${[1, 2, 3, 4].map((g) =>
                  `<option value="${g}" ${student?.grade === g ? "selected" : ""}>${g}학년</option>`).join("")}
                </select></div>
              <div class="field"><label>반</label>
                <select name="classNo">${CLASS_OPTIONS.map((c) =>
                  `<option value="${c}" ${student?.classNo === c ? "selected" : ""}>${c}반</option>`).join("")}
                </select></div>
              <div class="field"><label>학번</label>
                <input name="studentNo" value="${esc(student?.studentNo ?? "")}" placeholder="예: 20240101" required /></div>
              <div class="field"><label>성명</label>
                <input name="name" value="${esc(student?.name ?? "")}" required /></div>
              <div class="field" style="grid-column:1/-1"><label>이메일</label>
                <input name="email" type="email" value="${esc(student?.email ?? "")}" required /></div>
            </div>
            <div class="form-error" id="form-error"></div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">저장</button>
              <button type="button" class="btn btn-outline" id="cancel-btn">취소</button>
            </div>
          </form>
        </div>
      </div>`);
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
    modal.querySelector("#cancel-btn").addEventListener("click", () => modal.remove());
    modal.querySelector("#student-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = Object.fromEntries(fd.entries());
      const result = student ? updateStudent(student.id, data) : addStudent(data);
      if (!result.ok) {
        modal.querySelector("#form-error").innerHTML = result.errors.map(esc).join("<br/>");
        return;
      }
      modal.remove();
      draw();
    });
  }

  // 일괄 등록 — 여러 줄 붙여넣기 (쉼표 또는 탭 구분: 학년,반,학번,성명,이메일)
  function openBulkForm() {
    const modal = el(`
      <div class="modal-back">
        <div class="modal" style="width:640px">
          <h2>학생 일괄 등록</h2>
          <p class="muted" style="margin-bottom:10px">
            한 줄에 한 명씩 <strong>학년, 반, 학번, 성명, 이메일</strong> 순으로 입력하세요.
            Excel에서 복사해 붙여넣어도 됩니다 (쉼표/탭 구분 모두 지원, 반: ${CLASS_OPTIONS.join("·")}).
          </p>
          <textarea id="bulk-input" rows="10" style="width:100%;padding:10px 12px;border:1px solid var(--c-border);border-radius:8px;font-size:14px;font-family:inherit"
            placeholder="2, A, 20240103, 홍길동, gildong.hong@scjc.ac.kr&#10;2, B, 20240104, 김영희, younghee.kim@scjc.ac.kr"></textarea>
          <div class="form-error" id="bulk-error" style="white-space:pre-line"></div>
          <div class="form-actions">
            <button class="btn btn-primary" id="bulk-save">일괄 등록</button>
            <button class="btn btn-outline" id="bulk-cancel">취소</button>
          </div>
        </div>
      </div>`);
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
    modal.querySelector("#bulk-cancel").addEventListener("click", () => modal.remove());
    modal.querySelector("#bulk-save").addEventListener("click", () => {
      const lines = modal.querySelector("#bulk-input").value.split(/\r?\n/).filter((l) => l.trim());
      if (!lines.length) {
        modal.querySelector("#bulk-error").textContent = "등록할 내용을 입력해 주세요.";
        return;
      }
      let added = 0;
      const failures = [];
      lines.forEach((line, i) => {
        const cells = line.split(line.includes("\t") ? "\t" : ",").map((c) => c.trim());
        if (cells.length < 5) {
          failures.push(`${i + 1}행: 항목이 부족합니다 (5개 필요, ${cells.length}개 입력됨).`);
          return;
        }
        const [grade, classNo, studentNo, name, email] = cells;
        const result = addStudent({ grade, classNo, studentNo, name, email });
        if (result.ok) added++;
        else failures.push(`${i + 1}행 (${name || "?"}): ${result.errors[0]}`);
      });
      if (failures.length) {
        modal.querySelector("#bulk-error").textContent =
          `${added}명 등록 완료, ${failures.length}건 실패:\n${failures.slice(0, 10).join("\n")}`;
        draw();
        return;
      }
      modal.remove();
      alert(`${added}명이 일괄 등록되었습니다.`);
      draw();
    });
  }

  function handleCsvImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => alert("파일을 읽지 못했습니다.");
    reader.onload = () => {
      const { rows, errors } = parseStudentsCsv(reader.result);
      let added = 0;
      const failures = [...errors];
      for (const row of rows) {
        const result = addStudent(row);
        if (result.ok) added++;
        else failures.push(`${row.studentNo || "?"} ${row.name || ""}: ${result.errors[0]}`);
      }
      alert(`CSV 가져오기 완료: ${added}명 등록` + (failures.length ? `\n\n실패 ${failures.length}건:\n${failures.slice(0, 8).join("\n")}` : ""));
      draw();
    };
    reader.readAsText(file, "utf-8");
  }

  draw();
}
