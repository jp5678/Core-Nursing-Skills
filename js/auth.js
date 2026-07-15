// 인증 계층
// - 원격 모드: Supabase Auth (학생: Google OAuth, 교수: 이메일/비밀번호)
// - 로컬 데모 모드: localStorage 세션 (데모 계정)
import { getSession, setSession, getStudents } from "./store.js";
import { isRemote, getAuthContext, signInWithGoogle, signOutRemote } from "./backend.js";

// 로컬 데모 모드 전용 교수 계정 — 원격 모드에서는 Google 로그인 + professors 테이블 사용
const DEMO_PROFESSOR = {
  email: "nurseprof@scjc.ac.kr",
  password: "Jeffrey7254",
  name: "간호학과 교수",
};

export function currentUser() {
  return isRemote() ? getAuthContext() : getSession();
}

export function isProfessor() {
  return currentUser()?.role === "professor";
}

// 로컬 데모 모드 전용 — 원격 모드에서는 비밀번호 폼이 렌더링되지 않음
export async function loginProfessor(email, password) {
  if (email.trim().toLowerCase() !== DEMO_PROFESSOR.email || password !== DEMO_PROFESSOR.password) {
    return { ok: false, error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }
  const session = { role: "professor", name: DEMO_PROFESSOR.name, email: DEMO_PROFESSOR.email };
  setSession(session);
  return { ok: true, session };
}

// Google 로그인(원격 모드) — 역할은 백엔드가 professors/students 테이블로 판별
export async function loginStudentWithGoogle() {
  return signInWithGoogle();
}

export function loginStudentByEmail(email) {
  const student = getStudents().find(
    (s) => s.email.toLowerCase() === email.trim().toLowerCase()
  );
  if (!student) {
    return { ok: false, error: `${email} 계정으로 등록된 학생이 없습니다. 교수님께 등록을 요청하세요.` };
  }
  const session = { role: "student", studentId: student.id, name: student.name, email: student.email };
  setSession(session);
  return { ok: true, session };
}

export async function logout() {
  if (isRemote()) await signOutRemote();
  else setSession(null);
}
