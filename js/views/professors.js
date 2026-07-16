// 교수 관리 (관리자 전용) — 교수 허용 목록 등록·이름 수정·삭제
import { getProfessors, addProfessor, updateProfessorName, deleteProfessor } from "../store.js";
import { esc, el } from "../utils/dom.js";
import { navigate } from "../router.js";

export function renderProfessors(main, _params, user) {
  if (!user.isAdmin) {
    navigate("#/dashboard");
    return;
  }

  function draw() {
    const professors = getProfessors();
    main.innerHTML = `
      <div class="page-head">
        <h1>교수 관리</h1>
        <div class="sub">여기 등록된 Google 계정만 교수로 로그인할 수 있습니다 (총 ${professors.length}명 · 관리자 전용 메뉴)</div>
      </div>
      <div class="card">
        <div class="toolbar">
          <div class="spacer"></div>
          <button class="btn btn-primary btn-sm" id="add-btn">＋ 교수 등록</button>
        </div>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>이메일 (Google 계정)</th><th>이름</th><th>권한</th><th></th></tr></thead>
            <tbody>
              ${professors.map((p) => `
                <tr>
                  <td>${esc(p.email)}</td>
                  <td><strong>${esc(p.name)}</strong></td>
                  <td>${p.isAdmin ? `<span class="badge ok">관리자</span>` : `<span class="badge info">교수</span>`}</td>
                  <td style="white-space:nowrap">
                    <button class="btn btn-outline btn-sm" data-edit="${esc(p.email)}">이름 수정</button>
                    ${p.isAdmin ? "" : `<button class="btn btn-danger btn-sm" data-del="${esc(p.email)}">삭제</button>`}
                  </td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>
        <p class="muted" style="margin-top:10px">
          교수를 등록하면 해당 Google 계정으로 즉시 로그인할 수 있습니다.
          삭제하면 더 이상 교수로 로그인할 수 없습니다 (관리자·본인 계정은 삭제 불가).
        </p>
      </div>`;

    main.querySelector("#add-btn").addEventListener("click", openForm);
    main.querySelectorAll("[data-edit]").forEach((b) =>
      b.addEventListener("click", () => {
        const professor = getProfessors().find((p) => p.email === b.dataset.edit);
        const name = prompt("표시할 이름을 입력하세요:", professor?.name ?? "");
        if (name === null) return;
        const result = updateProfessorName(b.dataset.edit, name);
        if (!result.ok) { alert(result.errors.join("\n")); return; }
        draw();
      }));
    main.querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", () => {
        if (!confirm(`${b.dataset.del} 계정의 교수 권한을 삭제할까요?`)) return;
        const result = deleteProfessor(b.dataset.del, user.email);
        if (!result.ok) { alert(result.errors.join("\n")); return; }
        draw();
      }));
  }

  function openForm() {
    const modal = el(`
      <div class="modal-back">
        <div class="modal" style="width:460px">
          <h2>교수 등록</h2>
          <form id="professor-form">
            <div class="field" style="margin-bottom:12px"><label>Google 이메일 *</label>
              <input name="email" type="email" placeholder="professor@scjc.ac.kr" required /></div>
            <div class="field" style="margin-bottom:12px"><label>이름 *</label>
              <input name="name" placeholder="예: 홍길동 교수" required /></div>
            <div class="form-error" id="form-error"></div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">등록</button>
              <button type="button" class="btn btn-outline" id="cancel-btn">취소</button>
            </div>
          </form>
        </div>
      </div>`);
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
    modal.querySelector("#cancel-btn").addEventListener("click", () => modal.remove());
    modal.querySelector("#professor-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const result = addProfessor({ email: fd.get("email"), name: fd.get("name") });
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
