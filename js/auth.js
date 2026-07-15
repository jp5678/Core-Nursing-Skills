// 인증 계층
// - 원격 모드: Supabase Auth (학생: Google OAuth, 교수: 이메일/비밀번호)
// - 로컬 데모 모드: localStorage 세션 (데모 계정)
import { getSession, setSession, getStudents } from "./store.js";
import {
  isRemote, getAuthContext, signInProfessor, signInWithGoogle, signOutRemote,
} from "./backend.js";

const DEMO_PROFESSOR = {
  email: "nurseprof@scjc.ac.kr",
  // 데모 전용 자격증명 — 원격 모드에서는 Supabase Auth 사용자로 대체됨
  password: "Jeffrey7254",
  name: "간호학과 교수",
};

export function currentUser() {
  return isRemote() ? getAuthContext() : getSession();
}

export function isProfessor() {
  return currentUser()?.role === "professor";
}

export async function loginProfessor(email, password) {
  if (isRemote()) return signInProfessor(email.trim(), password);
  if (email.trim().toLowerCase() !== DEMO_PROFESSOR.email || password !== DEMO_PROFESSOR.password) {
    return { ok: false, error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }
  const session = { role: "professor", name: DEMO_PROFESSOR.name, email: DEMO_PROFESSOR.email };
  setSession(session);
  return { ok: true, session };
}

// 학생 Google 로그인 — 원격 모드는 실제 OAuth, 로컬 모드는 데모(이메일 대조)
export async function loginStudentWithGoogle() {
  if (isRemote()) return signInWithGoogle();
  return { ok: false, demo: true }; // 로컬 모드: 호출부에서 데모 모달 표시
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
