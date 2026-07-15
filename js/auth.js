// 인증 — 데모용 클라이언트 사이드 로그인
// 주의: 실제 운영 시 서버 측 인증(OAuth/LMS 연동 등)으로 교체해야 합니다.
import { getSession, setSession, getStudents } from "./store.js";

const PROFESSOR = {
  email: "nurseprof@scjc.ac.kr",
  // 데모용 자격증명 — 운영 배포 전 반드시 서버 인증으로 교체
  password: "Jeffrey7254",
  name: "간호학과 교수",
};

export function currentUser() {
  return getSession();
}

export function isProfessor() {
  return currentUser()?.role === "professor";
}

export function loginProfessor(email, password) {
  if (email.trim().toLowerCase() !== PROFESSOR.email || password !== PROFESSOR.password) {
    return { ok: false, error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }
  const session = { role: "professor", name: PROFESSOR.name, email: PROFESSOR.email };
  setSession(session);
  return { ok: true, session };
}

// Google 로그인 등 이메일만으로 학생을 식별하는 경우
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

export function logout() {
  setSession(null);
}
