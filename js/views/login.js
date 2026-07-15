// 로그인 화면 — 원격 모드: 학생·교수 모두 Google 계정(Supabase OAuth)
//              로컬 데모 모드: 학생 데모 모달, 교수 이메일/비밀번호
import { loginProfessor, loginStudentByEmail, loginStudentWithGoogle } from "../auth.js";
import { navigate } from "../router.js";
import { esc, el } from "../utils/dom.js";
import { isRemote } from "../backend.js";

const GOOGLE_ICON = `<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.2 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.2 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C41 35.4 44 30.2 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>`;

export function renderLogin(root) {
  let role = "student";

  // 로컬 데모 모드: 등록된 학교 이메일 입력으로 Google 로그인 시뮬레이션
  function openDemoGoogleModal() {
    const modal = el(`
      <div class="modal-back">
        <div class="modal" style="width:420px">
          <h2>${GOOGLE_ICON} Google 계정으로 로그인</h2>
          <p class="muted" style="margin-bottom:12px">
            데모 모드입니다 (Supabase 연동 시 실제 Google 인증이 활성화됩니다).<br/>
            등록된 학교 이메일을 입력하면 로그인됩니다.
          </p>
          <form id="google-demo-form">
            <div class="field"><label>Google 이메일</label>
              <input name="email" type="email" placeholder="s001@scjc.ac.kr" required /></div>
            <div class="form-error" id="google-demo-error"></div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">로그인</button>
              <button type="button" class="btn btn-outline" id="google-demo-cancel">취소</button>
            </div>
          </form>
        </div>
      </div>`);
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
    modal.querySelector("#google-demo-cancel").addEventListener("click", () => modal.remove());
    modal.querySelector("#google-demo-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const email = new FormData(e.target).get("email");
      const result = loginStudentByEmail(email);
      if (!result.ok) {
        modal.querySelector("#google-demo-error").textContent = result.error;
        return;
      }
      modal.remove();
      navigate("#/skills");
    });
  }

  async function handleGoogleLogin(errorEl) {
    if (!isRemote()) {
      openDemoGoogleModal();
      return;
    }
    // 원격 모드: Supabase를 통해 Google OAuth로 리디렉션
    const result = await loginStudentWithGoogle();
    if (!result.ok) errorEl.textContent = result.error ?? "Google 로그인에 실패했습니다.";
  }

  function draw() {
    root.innerHTML = `
      <div class="login-wrap">
        <div class="login-card">
          <div class="univ">CHEONGAM UNIVERSITY · DEPT. OF NURSING</div>
          <h1>핵심기본간호술 교육 플랫폼</h1>
          <div class="role-tabs">
            <button data-role="student" class="${role === "student" ? "active" : ""}">학생</button>
            <button data-role="professor" class="${role === "professor" ? "active" : ""}">교수</button>
          </div>
          ${role === "student" || isRemote() ? `
            <p class="muted" style="text-align:center;margin-bottom:14px">
              ${role === "student"
                ? "학교에 등록된 Google 계정으로 로그인하세요."
                : "교수 허용 목록에 등록된 Google 계정으로 로그인하세요."}
            </p>
            <button type="button" class="btn btn-google" id="google-btn">
              ${GOOGLE_ICON} Google 계정으로 로그인
            </button>
            <div class="form-error" id="login-error"></div>
          ` : `
            <form id="login-form">
              <div class="field"><label>이메일</label>
                <input name="email" type="email" placeholder="교수 이메일" required /></div>
              <div class="field"><label>비밀번호</label>
                <input name="password" type="password" required /></div>
              <div class="form-error" id="login-error"></div>
              <button type="submit" class="btn btn-primary">로그인</button>
            </form>
          `}
          ${role === "student" ? `
          <div class="demo-hint">
            <strong>데모 계정</strong><br/>
            학생: s001@scjc.ac.kr
          </div>` : `
          <div class="demo-hint">
            <strong>문의</strong><br/>
            정종필 교수 · imjp5678@scjc.ac.kr
          </div>`}
        </div>
        <footer class="site-footer on-dark">
          청암대학교 간호학과 · 정종필 교수 · imjp5678@scjc.ac.kr
        </footer>
      </div>`;

    root.querySelectorAll(".role-tabs button").forEach((btn) =>
      btn.addEventListener("click", () => { role = btn.dataset.role; draw(); })
    );

    const errorEl = root.querySelector("#login-error");

    root.querySelector("#login-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const result = await loginProfessor(fd.get("email"), fd.get("password"));
      if (!result.ok) {
        errorEl.textContent = esc(result.error);
        return;
      }
      navigate("#/dashboard");
    });

    root.querySelector("#google-btn")?.addEventListener("click", () => handleGoogleLogin(errorEl));
  }

  draw();
}
