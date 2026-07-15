// 인터랙티브 퀴즈 — 술기별 자동 생성 5문항, 80점 이상 합격
import { getSkill, recordQuizResult, QUIZ_PASS_SCORE } from "../store.js";
import { generateQuiz } from "../utils/quiz-generator.js";
import { esc } from "../utils/dom.js";
import { navigate } from "../router.js";

export function renderQuiz(main, params, user) {
  const skill = getSkill(params.id);
  if (!skill) {
    main.innerHTML = `<div class="card empty-state">술기 항목을 찾을 수 없습니다.</div>`;
    return;
  }
  if (user.role !== "student") {
    // 교수는 미리보기 모드로 응시 가능 (기록되지 않음)
  }

  const questions = generateQuiz(skill);
  const answers = new Array(questions.length).fill(null);
  let submitted = false;

  function questionHtml(q, qi) {
    const lines = q.question.split("\n");
    const title = lines[0];
    const body = lines.slice(1);
    return `
      <div class="quiz-q" data-q="${qi}">
        <div class="q-title"><span class="q-no">문제 ${qi + 1}.</span>${esc(title)}</div>
        ${body.length ? `<div class="card" style="padding:12px 16px;margin-bottom:10px;box-shadow:none">
          ${body.map((l) => `<div style="font-size:14px">${esc(l)}</div>`).join("")}</div>` : ""}
        ${q.options.map((opt, oi) => {
          let cls = answers[qi] === oi ? "selected" : "";
          if (submitted) {
            if (oi === q.answerIndex) cls = "correct";
            else if (answers[qi] === oi) cls = "wrong";
          }
          return `
          <label class="quiz-opt ${cls}">
            <input type="radio" name="q${qi}" value="${oi}"
              ${answers[qi] === oi ? "checked" : ""} ${submitted ? "disabled" : ""} />
            <span>${["①", "②", "③", "④", "⑤"][oi]} ${esc(opt)}</span>
          </label>`;
        }).join("")}
        ${submitted ? `<div class="muted" style="margin-top:4px">💡 ${esc(q.explanation)}</div>` : ""}
      </div>`;
  }

  function draw(resultBanner = "") {
    main.innerHTML = `
      <div class="page-head">
        <a href="#/skills/${skill.id}" class="muted">← ${esc(skill.name)}</a>
        <h1>📝 퀴즈: ${esc(skill.name)}</h1>
        <div class="sub">총 ${questions.length}문항 · ${QUIZ_PASS_SCORE}점 이상 합격
          ${user.role !== "student" ? " · <strong>교수 미리보기 (기록되지 않음)</strong>" : ""}</div>
      </div>
      ${resultBanner}
      <div class="card">
        ${questions.map(questionHtml).join("")}
        <div class="form-actions">
          ${!submitted
            ? `<button class="btn btn-primary" id="submit-btn">제출하기</button>`
            : `<button class="btn btn-primary" id="retry-btn">다시 응시하기</button>
               <button class="btn btn-outline" id="back-btn">술기 페이지로</button>`}
        </div>
        <div class="form-error" id="quiz-error"></div>
      </div>`;

    main.querySelectorAll("input[type=radio]").forEach((input) =>
      input.addEventListener("change", () => {
        const qi = Number(input.name.slice(1));
        answers[qi] = Number(input.value);
        // 선택 표시 갱신
        const qEl = main.querySelector(`[data-q="${qi}"]`);
        qEl.querySelectorAll(".quiz-opt").forEach((o, oi) =>
          o.classList.toggle("selected", oi === answers[qi]));
      })
    );

    main.querySelector("#submit-btn")?.addEventListener("click", () => {
      if (answers.some((a) => a === null)) {
        main.querySelector("#quiz-error").textContent = "모든 문항에 답해 주세요.";
        main.querySelector("#quiz-error").scrollIntoView({ behavior: "smooth" });
        return;
      }
      const correct = questions.filter((q, i) => answers[i] === q.answerIndex).length;
      const pct = Math.round((correct / questions.length) * 100);
      const pass = pct >= QUIZ_PASS_SCORE;
      submitted = true;
      if (user.role === "student") {
        recordQuizResult({ studentId: user.studentId, skillId: skill.id, score: correct, total: questions.length });
      }
      draw(`
        <div class="quiz-result-banner ${pass ? "pass" : "fail"}">
          <div class="score">${pct}점</div>
          <div>${questions.length}문항 중 ${correct}문항 정답 — ${pass
            ? "🎉 합격입니다! 해당 술기가 이수 처리되었습니다."
            : `아쉽습니다. ${QUIZ_PASS_SCORE}점 이상이면 합격입니다. 프로토콜을 복습한 뒤 다시 도전하세요.`}</div>
        </div>`);
      main.scrollIntoView({ behavior: "smooth" });
    });

    main.querySelector("#retry-btn")?.addEventListener("click", () => renderQuiz(main, params, user));
    main.querySelector("#back-btn")?.addEventListener("click", () => navigate(`#/skills/${skill.id}`));
  }

  draw();
}
