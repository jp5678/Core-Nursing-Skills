// 수료증 — 교수: 발급/관리, 학생: 내 수료증 확인·출력
import {
  getStudents, getStudent, getSkills, countPassed,
  getCertificates, getCertificateByStudent, issueCertificate, revokeCertificate,
} from "../store.js";
import { esc, formatDate } from "../utils/dom.js";
import { navigate } from "../router.js";

export function renderCertificates(main, _params, user) {
  if (user.role === "professor") drawProfessor(main, user);
  else drawStudent(main, user);
}

function drawProfessor(main, user) {
  const skills = getSkills();
  const students = getStudents();
  const certs = getCertificates();

  const rows = students.map((st) => {
    const passed = countPassed(st.id);
    const cert = getCertificateByStudent(st.id);
    const eligible = passed >= skills.length;
    return { st, passed, cert, eligible };
  }).sort((a, b) => b.passed - a.passed);

  main.innerHTML = `
    <div class="page-head">
      <h1>수료증 관리</h1>
      <div class="sub">${skills.length}개 술기 전 항목 이수 학생에게 수료증을 발급합니다. (발급 ${certs.length}건)</div>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table class="data">
          <thead><tr>
            <th>학번</th><th>성명</th><th>학년/반</th><th>이수 현황</th><th>수료증</th><th></th>
          </tr></thead>
          <tbody>
            ${rows.map(({ st, passed, cert, eligible }) => `
              <tr>
                <td>${esc(st.studentNo)}</td>
                <td><strong>${esc(st.name)}</strong></td>
                <td>${st.grade}학년 ${esc(st.classNo)}반</td>
                <td><span class="badge ${eligible ? "ok" : "pending"}">${passed} / ${skills.length}</span></td>
                <td>${cert
                  ? `<span class="badge ok">${esc(cert.certNo)}</span><div class="muted">${formatDate(cert.issuedAt)}</div>`
                  : `<span class="badge pending">미발급</span>`}</td>
                <td style="white-space:nowrap">
                  ${cert ? `
                    <button class="btn btn-outline btn-sm" data-print="${cert.id}">출력</button>
                    <button class="btn btn-danger btn-sm" data-revoke="${cert.id}">취소</button>
                  ` : `
                    <button class="btn btn-primary btn-sm" data-issue="${st.id}" ${eligible ? "" : "disabled"}
                      title="${eligible ? "" : "전 항목 이수 후 발급 가능합니다"}">발급</button>
                  `}
                </td>
              </tr>`).join("")}
            ${!students.length ? `<tr><td colspan="6" class="empty-state">등록된 학생이 없습니다.</td></tr>` : ""}
          </tbody>
        </table>
      </div>
    </div>`;

  main.querySelectorAll("[data-issue]").forEach((b) =>
    b.addEventListener("click", () => {
      const result = issueCertificate(b.dataset.issue, user.name);
      if (!result.ok) { alert(result.errors.join("\n")); return; }
      navigate(`#/certificates/print/${result.cert.id}`);
    })
  );
  main.querySelectorAll("[data-print]").forEach((b) =>
    b.addEventListener("click", () => navigate(`#/certificates/print/${b.dataset.print}`))
  );
  main.querySelectorAll("[data-revoke]").forEach((b) =>
    b.addEventListener("click", () => {
      if (confirm("이 수료증 발급을 취소할까요?")) {
        revokeCertificate(b.dataset.revoke);
        drawProfessor(main, user);
      }
    })
  );
}

function drawStudent(main, user) {
  const skills = getSkills();
  const passed = countPassed(user.studentId);
  const cert = getCertificateByStudent(user.studentId);

  main.innerHTML = `
    <div class="page-head">
      <h1>내 수료증</h1>
      <div class="sub">핵심기본간호술 ${skills.length}개 항목을 모두 이수하면 수료증이 발급됩니다.</div>
    </div>
    <div class="card">
      <h2>이수 현황</h2>
      <div class="progress-bar" style="height:14px">
        <div class="fill" style="width:${(passed / skills.length) * 100}%"></div>
      </div>
      <div class="progress-label">${passed} / ${skills.length} 항목 이수</div>
      ${cert ? `
        <div style="margin-top:16px">
          <span class="badge ok">수료증 발급 완료 · ${esc(cert.certNo)} (${formatDate(cert.issuedAt)})</span>
          <div class="form-actions">
            <button class="btn btn-primary" id="print-btn">수료증 보기 / 출력</button>
          </div>
        </div>
      ` : passed >= skills.length ? `
        <p style="margin-top:14px">🎉 전 항목 이수를 완료했습니다! 교수님의 수료증 발급을 기다려 주세요.</p>
      ` : `
        <p class="muted" style="margin-top:14px">아직 이수하지 않은 항목이 ${skills.length - passed}개 있습니다.
        <a href="#/skills">학습 계속하기 →</a></p>
      `}
    </div>`;

  main.querySelector("#print-btn")?.addEventListener("click", () =>
    navigate(`#/certificates/print/${cert.id}`));
}

export function renderCertificatePrint(main, params, user) {
  const cert = getCertificates().find((c) => c.id === params.id);
  if (!cert) {
    main.innerHTML = `<div class="card empty-state">수료증을 찾을 수 없습니다.</div>`;
    return;
  }
  if (user.role === "student" && cert.studentId !== user.studentId) {
    main.innerHTML = `<div class="card empty-state">본인 수료증만 열람할 수 있습니다.</div>`;
    return;
  }
  const student = getStudent(cert.studentId);
  const skills = getSkills();
  const issued = new Date(cert.issuedAt);

  main.innerHTML = `
    <div class="toolbar no-print">
      <a href="#/certificates" class="btn btn-outline btn-sm">← 돌아가기</a>
      <div class="spacer"></div>
      <button class="btn btn-primary" id="do-print">🖨 인쇄 / PDF 저장</button>
    </div>
    <div class="certificate">
      <div class="cert-no">제 ${esc(cert.certNo)} 호</div>
      <div style="font-size:13px;letter-spacing:.2em;color:var(--c-text-sub)">CERTIFICATE OF COMPLETION</div>
      <div class="cert-title">수 료 증</div>
      <div class="cert-body">
        <div>${student ? `${student.grade}학년 ${esc(student.classNo)}반 · 학번 ${esc(student.studentNo)}` : "(삭제된 학생)"}</div>
        <div class="cert-name">${esc(student?.name ?? "-")}</div>
      </div>
      <div class="cert-desc">
        위 학생은 청암대학교 간호학과에서 운영하는 핵심기본간호술 교육과정에서
        한국간호교육평가원 「핵심기본간호술 평가항목 프로토콜(제4.1판)」에 따른
        전체 ${skills.length}개 술기 항목의 학습 및 평가를 성실히 이수하였기에
        이 증서를 수여합니다.
      </div>
      <div class="cert-date">${issued.getFullYear()}년 ${issued.getMonth() + 1}월 ${issued.getDate()}일</div>
      <div class="cert-issuer">청암대학교 간호학부장<span class="cert-seal">직인</span></div>
    </div>`;

  main.querySelector("#do-print").addEventListener("click", () => window.print());
}
