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
  professors: [],
  videos: {},        // skillId → [ { id, url, updatedAt }, ... ]
  progress: {},
  quizResults: [],
  certificates: [],
  assignments: [],
  submissions: [],
};

export function isRemote() {
  if (globalThis.__FORCE_LOCAL_MODE__) return false; // 단위 테스트용
  try {
    // 개발·시연용: localStorage에 cnsp.forceLocal=1 을 넣으면 로컬 데모 모드로 동작
    if (globalThis.localStorage?.getItem("cnsp.forceLocal") === "1") return false;
  } catch { /* localStorage 접근 불가 환경 무시 */ }
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

// OAuth 복귀 URL에 담긴 인증 오류(#error=... / ?error=...)를 추출
function readAuthErrorFromUrl() {
  const fromHash = new URLSearchParams(location.hash.replace(/^#\/?/, ""));
  const fromQuery = new URLSearchParams(location.search);
  const desc = fromHash.get("error_description") ?? fromQuery.get("error_description");
  const code = fromHash.get("error") ?? fromQuery.get("error");
  if (!desc && !code) return null;
  return `Google 로그인 처리 중 오류가 발생했습니다: ${desc ?? code}`;
}

export async function initBackend() {
  if (!isRemote()) return;
  const urlError = readAuthErrorFromUrl();
  if (urlError) {
    initError = urlError;
    history.replaceState(null, "", location.pathname);
  }
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      flowType: "pkce",
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  const { data: { session } } = await client.auth.getSession();
  if (!session) return;
  try {
    await buildAuthContext(session.user.email);
    // 교수 탭에서 로그인했는데 교수 허용 목록에 없는 계정이면 거부
    const intended = sessionStorage.getItem("cnsp.intendedRole");
    sessionStorage.removeItem("cnsp.intendedRole");
    if (intended === "professor" && authContext?.role !== "professor") {
      throw new Error(
        `${session.user.email} 계정은 교수 허용 목록에 등록되어 있지 않습니다. 관리자(정종필 교수)에게 등록을 요청하세요.`
      );
    }
  } catch (err) {
    initError = err.message;
    authContext = null;
    await client.auth.signOut();
  }
}

// 로그인한 이메일이 교수 목록 또는 학생 명단에 있는지 확인해 역할을 결정
async function buildAuthContext(email) {
  const { data: prof, error: profErr } = await client
    .from("professors").select("email, name, is_admin").eq("email", email).maybeSingle();
  if (profErr) throw new Error(`권한 확인 실패: ${profErr.message}`);
  if (prof) {
    authContext = { role: "professor", name: prof.name, email, isAdmin: Boolean(prof.is_admin) };
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
// 테이블별로 독립 처리: 일부 실패(예: 마이그레이션 전)해도 나머지는 동작
export async function refreshCache() {
  if (!client || !authContext) return;
  const tables = [
    ["students", client.from("students").select("*").order("student_no"), (rows) => {
      cache.students = rows.map((r) => ({
        id: r.id, grade: r.grade, classNo: r.class_no, studentNo: r.student_no,
        name: r.name, email: r.email, createdAt: r.created_at,
      }));
    }],
    ["professors", client.from("professors").select("*").order("email"), (rows) => {
      cache.professors = rows.map((r) => ({
        email: r.email, name: r.name, isAdmin: Boolean(r.is_admin),
      }));
    }],
    ["videos", client.from("videos").select("*").order("updated_at"), (rows) => {
      cache.videos = {};
      for (const r of rows) {
        cache.videos[r.skill_id] ??= [];
        cache.videos[r.skill_id].push({ id: r.id ?? `legacy-${r.skill_id}`, url: r.url, updatedAt: r.updated_at });
      }
    }],
    ["progress", client.from("progress").select("*"), (rows) => {
      cache.progress = {};
      for (const r of rows) {
        cache.progress[r.student_id] ??= {};
        cache.progress[r.student_id][r.skill_id] = {
          videoWatched: r.video_watched, bestScore: r.best_score,
          passed: r.passed, updatedAt: r.updated_at,
        };
      }
    }],
    ["quiz_results", client.from("quiz_results").select("*"), (rows) => {
      cache.quizResults = rows.map((r) => ({
        id: r.id, studentId: r.student_id, skillId: r.skill_id,
        score: r.score, total: r.total, createdAt: r.created_at,
      }));
    }],
    ["certificates", client.from("certificates").select("*"), (rows) => {
      cache.certificates = rows.map((r) => ({
        id: r.id, certNo: r.cert_no, studentId: r.student_id,
        issuedBy: r.issued_by, passedCount: r.passed_count, issuedAt: r.issued_at,
      }));
    }],
    ["assignments", client.from("assignments").select("*").order("created_at", { ascending: false }), (rows) => {
      cache.assignments = rows.map((r) => ({
        id: r.id, title: r.title, description: r.description,
        dueDate: r.due_date, skillId: r.skill_id, createdAt: r.created_at,
      }));
    }],
    ["submissions", client.from("submissions").select("*"), (rows) => {
      cache.submissions = rows.map((r) => ({
        id: r.id, assignmentId: r.assignment_id, studentId: r.student_id,
        content: r.content, linkUrl: r.link_url, submittedAt: r.submitted_at,
      }));
    }],
  ];
  const results = await Promise.all(tables.map(([, query]) => query));
  results.forEach((result, i) => {
    const [name, , apply] = tables[i];
    if (result.error) console.error(`${name} 동기화 실패:`, result.error.message);
    else apply(result.data);
  });
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

export function pushProfessor(p) {
  client.from("professors").upsert({
    email: p.email, name: p.name, is_admin: p.isAdmin ?? false,
  }).then(report("교수"));
}

export function pushDeleteProfessor(email) {
  client.from("professors").delete().eq("email", email).then(report("교수 삭제"));
}

export function pushVideoInsert(skillId, video) {
  client.from("videos").insert({ id: video.id, skill_id: Number(skillId), url: video.url })
    .then(report("영상"));
}

export function pushVideoDelete(videoId) {
  client.from("videos").delete().eq("id", videoId).then(report("영상 삭제"));
}

export function pushAssignment(a) {
  client.from("assignments").upsert({
    id: a.id, title: a.title, description: a.description,
    due_date: a.dueDate, skill_id: a.skillId,
  }).then(report("과제"));
}

export function pushDeleteAssignment(id) {
  client.from("assignments").delete().eq("id", id).then(report("과제 삭제"));
}

export function pushSubmission(s) {
  client.from("submissions").upsert({
    id: s.id, assignment_id: s.assignmentId, student_id: s.studentId,
    content: s.content, link_url: s.linkUrl, submitted_at: s.submittedAt,
  }, { onConflict: "assignment_id,student_id" }).then(report("과제 제출"));
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
