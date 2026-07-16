// 과제 — 교수: 부여·제출 현황 확인 / 학생: 제출·수정
import {
  getSkills, getSkill, getStudent,
  getAssignments, addAssignment, updateAssignment, deleteAssignment,
  getSubmissions, getMySubmission, submitAssignment,
  getEligibleStudents, getAssignmentsForStudent,
} from "../store.js";
import { CLASS_OPTIONS } from "../config.js";
import { esc, el, formatDate } from "../utils/dom.js";

// 대상 표시: "2학년 A·B반" / "전체 학년 C반" / "" (전체)
function targetBadge(a) {
  if (!a.targetGrade && !a.targetClasses?.length) return `<span class="badge info">대상: 전체</span>`;
  const grade = a.targetGrade ? `${a.targetGrade}학년` : "전체 학년";
  const classes = a.targetClasses?.length ? `${a.targetClasses.join("·")}반` : "전체 반";
  return `<span class="badge info">대상: ${grade} ${classes}</span>`;
}

function dueBadge(assignment) {
  if (!assignment.dueDate) return `<span class="badge info">마감일 없음</span>`;
  const due = new Date(`${assignment.dueDate}T23:59:59`);
  const overdue = Date.now() > due.getTime();
  return `<span class="badge ${overdue ? "pending" : "info"}">마감 ${esc(assignment.dueDate)}${overdue ? " (지남)" : ""}</span>`;
}

function skillBadge(assignment) {
  if (!assignment.skillId) return "";
  const skill = getSkill(assignment.skillId);
  return skill ? `<a href="#/skills/${skill.id}" class="badge info">🩺 ${esc(skill.name)}</a>` : "";
}

export function renderAssignments(main, _params, user) {
  if (user.role === "professor") drawProfessor(main);
  else drawStudent(main, user);
}

/* ===== 교수 ===== */
function drawProfessor(main) {
  let openedId = null; // 제출 현황이 펼쳐진 과제

  function draw() {
    const assignments = getAssignments();

    main.innerHTML = `
      <div class="page-head">
        <h1>과제 관리</h1>
        <div class="sub">과제를 부여하고 학생 제출 현황을 확인합니다 (총 ${assignments.length}건)</div>
      </div>
      <div class="toolbar">
        <div class="spacer"></div>
        <button class="btn btn-primary" id="add-btn">＋ 과제 등록</button>
      </div>
      ${assignments.map((a) => {
        const subs = getSubmissions(a.id);
        const eligible = getEligibleStudents(a);
        const opened = openedId === a.id;
        return `
        <div class="card">
          <h2 style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            ${esc(a.title)}
            ${dueBadge(a)} ${targetBadge(a)} ${skillBadge(a)}
            <span class="badge ${subs.length ? "ok" : "pending"}">제출 ${subs.length} / ${eligible.length}명</span>
          </h2>
          ${a.description ? `<p style="white-space:pre-line;margin-bottom:10px">${esc(a.description)}</p>` : ""}
          <div class="muted">등록일 ${formatDate(a.createdAt)}</div>
          <div class="form-actions">
            <button class="btn btn-outline btn-sm" data-toggle="${a.id}">${opened ? "제출 현황 접기 ▲" : "제출 현황 보기 ▼"}</button>
            <button class="btn btn-outline btn-sm" data-edit="${a.id}">수정</button>
            <button class="btn btn-danger btn-sm" data-del="${a.id}">삭제</button>
          </div>
          ${opened ? `
          <div class="table-wrap" style="margin-top:12px">
            <table class="data">
              <thead><tr><th>학번</th><th>성명</th><th>제출일</th><th style="width:40%">내용</th><th>링크</th></tr></thead>
              <tbody>
                ${subs.map((s) => {
                  const st = getStudent(s.studentId);
                  return `
                  <tr>
                    <td>${esc(st?.studentNo ?? "-")}</td>
                    <td><strong>${esc(st?.name ?? "(삭제된 학생)")}</strong></td>
                    <td>${formatDate(s.submittedAt)}</td>
                    <td style="white-space:pre-line">${esc(s.content) || `<span class="muted">-</span>`}</td>
                    <td>${s.linkUrl ? `<a href="${esc(s.linkUrl)}" target="_blank" rel="noopener">열기 ↗</a>` : `<span class="muted">-</span>`}</td>
                  </tr>`;
                }).join("")}
                ${!subs.length ? `<tr><td colspan="5" class="empty-state">아직 제출한 학생이 없습니다.</td></tr>` : ""}
              </tbody>
            </table>
          </div>` : ""}
        </div>`;
      }).join("")}
      ${!assignments.length ? `<div class="card empty-state">등록된 과제가 없습니다. [＋ 과제 등록]으로 첫 과제를 만들어 보세요.</div>` : ""}`;

    main.querySelector("#add-btn").addEventListener("click", () => openForm(null));
    main.querySelectorAll("[data-toggle]").forEach((b) =>
      b.addEventListener("click", () => { openedId = openedId === b.dataset.toggle ? null : b.dataset.toggle; draw(); }));
    main.querySelectorAll("[data-edit]").forEach((b) =>
      b.addEventListener("click", () => openForm(getAssignments().find((a) => a.id === b.dataset.edit))));
    main.querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", () => {
        const a = getAssignments().find((x) => x.id === b.dataset.del);
        if (a && confirm(`과제 “${a.title}”를 삭제할까요?\n학생 제출물도 함께 삭제됩니다.`)) {
          deleteAssignment(a.id);
          draw();
        }
      }));
  }

  function openForm(assignment) {
    const skills = getSkills();
    const modal = el(`
      <div class="modal-back">
        <div class="modal">
          <h2>${assignment ? "과제 수정" : "과제 등록"}</h2>
          <form id="assignment-form">
            <div class="field" style="margin-bottom:12px"><label>제목 *</label>
              <input name="title" value="${esc(assignment?.title ?? "")}" placeholder="예: 활력징후 측정 절차 요약 제출" required /></div>
            <div class="field" style="margin-bottom:12px"><label>설명</label>
              <textarea name="description" rows="4"
                style="width:100%;padding:9px 12px;border:1px solid var(--c-border);border-radius:8px;font-family:inherit;font-size:inherit"
                placeholder="과제 내용, 제출 형식 등을 안내하세요">${esc(assignment?.description ?? "")}</textarea></div>
            <div class="form-grid">
              <div class="field"><label>마감일 (선택)</label>
                <input name="dueDate" type="date" value="${esc(assignment?.dueDate ?? "")}" /></div>
              <div class="field"><label>관련 술기 (선택)</label>
                <select name="skillId">
                  <option value="">선택 안 함</option>
                  ${skills.map((s) => `<option value="${s.id}" ${assignment?.skillId === s.id ? "selected" : ""}>${s.id}. ${esc(s.name)}</option>`).join("")}
                </select></div>
              <div class="field"><label>대상 학년</label>
                <select name="targetGrade">
                  <option value="">전체 학년</option>
                  ${[1, 2, 3, 4].map((g) => `<option value="${g}" ${assignment?.targetGrade === g ? "selected" : ""}>${g}학년</option>`).join("")}
                </select></div>
              <div class="field"><label>대상 반 (선택 안 하면 전체)</label>
                <div class="class-checks">
                  ${CLASS_OPTIONS.map((c) => `
                    <label class="class-check">
                      <input type="checkbox" name="targetClasses" value="${c}"
                        ${assignment?.targetClasses?.includes(c) ? "checked" : ""} /> ${c}반
                    </label>`).join("")}
                </div></div>
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
    modal.querySelector("#assignment-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = Object.fromEntries(fd.entries());
      data.targetClasses = fd.getAll("targetClasses");
      const result = assignment ? updateAssignment(assignment.id, data) : addAssignment(data);
      if (!result.ok) {
        modal.querySelector("#form-error").innerHTML = result.errors.map(esc).join("<br/>");
        return;
      }
      modal.remove();
      draw();
    });
  }

  draw();
}

/* ===== 학생 ===== */
function drawStudent(main, user) {
  function draw() {
    // 본인 학년·반이 대상인 과제만 표시
    const assignments = getAssignmentsForStudent(user.studentId);
    main.innerHTML = `
      <div class="page-head">
        <h1>과제</h1>
        <div class="sub">교수님이 부여한 과제를 확인하고 제출하세요 (총 ${assignments.length}건)</div>
      </div>
      ${assignments.map((a) => {
        const mine = getMySubmission(a.id, user.studentId);
        return `
        <div class="card">
          <h2 style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            ${esc(a.title)}
            ${dueBadge(a)} ${skillBadge(a)}
            ${mine
              ? `<span class="badge ok">✓ 제출 완료 (${formatDate(mine.submittedAt)})</span>`
              : `<span class="badge pending">미제출</span>`}
          </h2>
          ${a.description ? `<p style="white-space:pre-line;margin-bottom:10px">${esc(a.description)}</p>` : ""}
          ${mine ? `
            <div class="muted" style="margin-bottom:6px">내 제출물:</div>
            ${mine.content ? `<p style="white-space:pre-line;background:#f8fafc;border-radius:8px;padding:10px 12px">${esc(mine.content)}</p>` : ""}
            ${mine.linkUrl ? `<p><a href="${esc(mine.linkUrl)}" target="_blank" rel="noopener">첨부 링크 열기 ↗</a></p>` : ""}
          ` : ""}
          <div class="form-actions">
            <button class="btn ${mine ? "btn-outline" : "btn-primary"}" data-submit="${a.id}">
              ${mine ? "제출물 수정하기" : "📝 제출하기"}
            </button>
          </div>
        </div>`;
      }).join("")}
      ${!assignments.length ? `<div class="card empty-state">아직 부여된 과제가 없습니다.</div>` : ""}`;

    main.querySelectorAll("[data-submit]").forEach((b) =>
      b.addEventListener("click", () => openSubmitForm(b.dataset.submit)));
  }

  function openSubmitForm(assignmentId) {
    const assignment = getAssignments().find((a) => a.id === assignmentId);
    const mine = getMySubmission(assignmentId, user.studentId);
    const modal = el(`
      <div class="modal-back">
        <div class="modal">
          <h2>과제 제출 — ${esc(assignment?.title ?? "")}</h2>
          <form id="submit-form">
            <div class="field" style="margin-bottom:12px"><label>제출 내용</label>
              <textarea name="content" rows="6"
                style="width:100%;padding:9px 12px;border:1px solid var(--c-border);border-radius:8px;font-family:inherit;font-size:inherit"
                placeholder="과제 내용을 작성하세요">${esc(mine?.content ?? "")}</textarea></div>
            <div class="field" style="margin-bottom:12px"><label>첨부 링크 (선택 — 구글 드라이브, 영상 등)</label>
              <input name="linkUrl" value="${esc(mine?.linkUrl ?? "")}" placeholder="https://..." /></div>
            <p class="muted">내용 또는 링크 중 하나는 입력해야 합니다. 다시 제출하면 이전 제출물을 대체합니다.</p>
            <div class="form-error" id="form-error"></div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">${mine ? "다시 제출" : "제출"}</button>
              <button type="button" class="btn btn-outline" id="cancel-btn">취소</button>
            </div>
          </form>
        </div>
      </div>`);
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
    modal.querySelector("#cancel-btn").addEventListener("click", () => modal.remove());
    modal.querySelector("#submit-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const result = submitAssignment({
        assignmentId, studentId: user.studentId,
        content: fd.get("content"), linkUrl: fd.get("linkUrl"),
      });
      if (!result.ok) {
        modal.querySelector("#form-error").innerHTML = result.errors.map(esc).join("<br/>");
        return;
      }
      modal.remove();
      draw();
    });
  }

  draw();
}
