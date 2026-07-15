// Supabase 백엔드 연동 계층
// - SUPABASE_URL/KEY가 설정되면 원격 모드: 데이터를 메모리 캐시에 읽어 두고,
//   변경 시 캐시를 즉시 갱신한 뒤 Supabase에 반영(write-through)합니다.
// - 설정이 비어 있으면 로컬 데모 모드(localStorage)로 동작하며 이 파일은 아무 일도 하지 않습니다.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

let client = null;
let authContext = null; // { role: "professor"|"student", studentId?, name, email }
let initError = null;

const cache = {
  students: [],
  videos: {},
  progress: {},
  quizResults: [],
  certificates: [],
};

export function isRemote() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function getCache() {
  return cache;
}

export function getAuthContext() {
  return authContext;
}

export function getInitError() {
  const err = initError;
  initError = null;
  return err;
}

export async function initBackend() {
  if (!isRemote()) return;
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: { session } } = await client.auth.getSession();
  if (!session) return;
  try {
    await buildAuthContext(session.user.email);
  } catch (err) {
    initError = err.message;
    authContext = null;
    await client.auth.signOut();
  }
}

// 로그인한 이메일이 교수 목록 또는 학생 명단에 있는지 확인해 역할을 결정
async function buildAuthContext(email) {
  const { data: prof, error: profErr } = await client
    .from("professors").select("email, name").eq("email", email).maybeSingle();
  if (profErr) throw new Error(`권한 확인 실패: ${profErr.message}`);
  if (prof) {
    authContext = { role: "professor", name: prof.name, email };
  } else {
    const { data: student, error: stErr } = await client
      .from("students").select("id, name, email").eq("email", email).maybeSingle();
    if (stErr) throw new Error(`학생 확인 실패: ${stErr.message}`);
    if (!student) {
      throw new Error(`${email} 계정은 등록되어 있지 않습니다. 교수님께 등록을 요청하세요.`);
    }
    authContext = { role: "student", studentId: student.id, name: student.name, email };
  }
  await refreshCache();
}

// 서버 데이터를 캐시로 동기화 (RLS가 역할에 맞게 행을 걸러줌)
export async function refreshCache() {
  if (!client || !authContext) return;
  const [students, videos, progress, quizResults, certificates] = await Promise.all([
    client.from("students").select("*").order("student_no"),
    client.from("videos").select("*"),
    client.from("progress").select("*"),
    client.from("quiz_results").select("*"),
    client.from("certificates").select("*"),
  ]);
  const failed = [students, videos, progress, quizResults, certificates].find((r) => r.error);
  if (failed) {
    console.error("데이터 동기화 실패:", failed.error);
    return;
  }
  cache.students = students.data.map((r) => ({
    id: r.id, grade: r.grade, classNo: r.class_no, studentNo: r.student_no,
    name: r.name, email: r.email, createdAt: r.created_at,
  }));
  cache.videos = Object.fromEntries(
    videos.data.map((r) => [r.skill_id, { url: r.url, updatedAt: r.updated_at }])
  );
  cache.progress = {};
  for (const r of progress.data) {
    cache.progress[r.student_id] ??= {};
    cache.progress[r.student_id][r.skill_id] = {
      videoWatched: r.video_watched, bestScore: r.best_score,
      passed: r.passed, updatedAt: r.updated_at,
    };
  }
  cache.quizResults = quizResults.data.map((r) => ({
    id: r.id, studentId: r.student_id, skillId: r.skill_id,
    score: r.score, total: r.total, createdAt: r.created_at,
  }));
  cache.certificates = certificates.data.map((r) => ({
    id: r.id, certNo: r.cert_no, studentId: r.student_id,
    issuedBy: r.issued_by, passedCount: r.passed_count, issuedAt: r.issued_at,
  }));
}

// ---------- 쓰기 반영 (캐시는 store.js가 이미 갱신한 상태) ----------

function report(label) {
  return ({ error }) => {
    if (error) {
      console.error(`${label} 저장 실패:`, error);
      alert(`서버 저장에 실패했습니다 (${label}). 네트워크 상태를 확인해 주세요.\n${error.message}`);
    }
  };
}

export function pushStudent(s) {
  client.from("students").upsert({
    id: s.id, grade: s.grade, class_no: s.classNo, student_no: s.studentNo,
    name: s.name, email: s.email,
  }).then(report("학생"));
}

export function pushDeleteStudent(id) {
  client.from("students").delete().eq("id", id).then(report("학생 삭제"));
}

export function pushVideo(skillId, video) {
  if (video) {
    client.from("videos").upsert({ skill_id: Number(skillId), url: video.url })
      .then(report("영상"));
  } else {
    client.from("videos").delete().eq("skill_id", Number(skillId)).then(report("영상 삭제"));
  }
}

export function pushProgress(studentId, skillId, p) {
  client.from("progress").upsert({
    student_id: studentId, skill_id: Number(skillId),
    video_watched: p.videoWatched ?? false, best_score: p.bestScore ?? 0,
    passed: p.passed ?? false, updated_at: new Date().toISOString(),
  }).then(report("학습 진도"));
}

export function pushQuizResult(r) {
  client.from("quiz_results").insert({
    id: r.id, student_id: r.studentId, skill_id: Number(r.skillId),
    score: r.score, total: r.total,
  }).then(report("퀴즈 결과"));
}

export function pushCertificate(c) {
  client.from("certificates").insert({
    id: c.id, cert_no: c.certNo, student_id: c.studentId,
    issued_by: c.issuedBy, passed_count: c.passedCount,
  }).then(report("수료증"));
}

export function pushDeleteCertificate(id) {
  client.from("certificates").delete().eq("id", id).then(report("수료증 취소"));
}

// ---------- 인증 ----------

export async function signInProfessor(email, password) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  try {
    await buildAuthContext(data.user.email);
  } catch (err) {
    await client.auth.signOut();
    return { ok: false, error: err.message };
  }
  if (authContext.role !== "professor") {
    await signOutRemote();
    return { ok: false, error: "교수 권한이 없는 계정입니다." };
  }
  return { ok: true, session: authContext };
}

export async function signInWithGoogle() {
  const redirectTo = location.origin + location.pathname;
  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) return { ok: false, error: `Google 로그인 실패: ${error.message}` };
  return { ok: true, pending: true }; // Google 페이지로 리디렉션됨
}

export async function signOutRemote() {
  authContext = null;
  if (client) await client.auth.signOut();
}
