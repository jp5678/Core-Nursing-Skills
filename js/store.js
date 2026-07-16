// 저장소 계층 — Repository 패턴, 불변 업데이트
// 로컬 모드: localStorage / 원격 모드: Supabase (메모리 캐시 + write-through)
import { SKILLS } from "./data/skills-data.js";
import { CLASS_OPTIONS } from "./config.js";
import {
  isRemote, getCache,
  pushStudent, pushDeleteStudent, pushProfessor, pushDeleteProfessor,
  pushVideoInsert, pushVideoDelete, pushProgress,
  pushQuizResult, pushCertificate, pushDeleteCertificate,
  pushAssignment, pushDeleteAssignment, pushSubmission,
} from "./backend.js";

const PREFIX = "cnsp.";
const KEYS = {
  students: `${PREFIX}students`,
  videos: `${PREFIX}videos`,
  progress: `${PREFIX}progress`,
  quizResults: `${PREFIX}quizResults`,
  certificates: `${PREFIX}certificates`,
  assignments: `${PREFIX}assignments`,
  submissions: `${PREFIX}submissions`,
  professors: `${PREFIX}professors`,
  session: `${PREFIX}session`,
  seeded: `${PREFIX}seeded.v1`,
  demoUpgraded: `${PREFIX}migration.demoFullCompletion`,
  demoEmails: `${PREFIX}migration.demoEmailsV2`,
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.error(`저장소 읽기 실패 (${key}):`, err);
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`저장소 쓰기 실패 (${key}):`, err);
    alert("데이터 저장에 실패했습니다. 브라우저 저장 공간을 확인해 주세요.");
  }
}

function uid() {
  // 원격 모드에서는 DB uuid 컬럼과 호환되도록 UUID 사용
  if (isRemote() && globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ===== 술기 ===== */
export function getSkills() {
  return SKILLS;
}

export function getSkill(id) {
  return SKILLS.find((s) => s.id === Number(id)) ?? null;
}

/* ===== 학생 ===== */
export function getStudents() {
  return isRemote() ? getCache().students : read(KEYS.students, []);
}

function writeStudents(students) {
  if (isRemote()) getCache().students = students;
  else write(KEYS.students, students);
}

export function getStudent(id) {
  return getStudents().find((s) => s.id === id) ?? null;
}

export function validateStudent(data, { excludeId = null } = {}) {
  const errors = [];
  if (!data.name?.trim()) errors.push("성명을 입력해 주세요.");
  if (!/^\d{4,10}$/.test(data.studentNo ?? "")) errors.push("학번은 4~10자리 숫자여야 합니다.");
  const email = data.email?.trim().toLowerCase() ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("올바른 이메일을 입력해 주세요.");
  const grade = Number(data.grade);
  if (!Number.isInteger(grade) || grade < 1 || grade > 4) errors.push("학년은 1~4 사이여야 합니다.");
  const classNo = data.classNo?.toString().trim().toUpperCase();
  if (!CLASS_OPTIONS.includes(classNo)) errors.push(`반은 ${CLASS_OPTIONS.join(", ")} 중 하나여야 합니다.`);
  const dup = getStudents().find((s) => s.studentNo === data.studentNo && s.id !== excludeId);
  if (dup) errors.push(`학번 ${data.studentNo}은(는) 이미 등록되어 있습니다 (${dup.name}).`);
  const dupEmail = getStudents().find((s) => s.email.toLowerCase() === email && s.id !== excludeId);
  if (dupEmail) errors.push(`이메일 ${email}은(는) 이미 등록되어 있습니다 (${dupEmail.name}).`);
  if (getProfessors().some((p) => p.email === email)) {
    errors.push("교수 허용 목록에 있는 이메일은 학생으로 등록할 수 없습니다.");
  }
  return errors;
}

export function addStudent(data) {
  const errors = validateStudent(data);
  if (errors.length) return { ok: false, errors };
  const student = {
    id: uid(),
    grade: Number(data.grade),
    classNo: String(data.classNo).trim().toUpperCase(),
    studentNo: data.studentNo.trim(),
    name: data.name.trim(),
    email: data.email.trim(),
    createdAt: new Date().toISOString(),
  };
  writeStudents([...getStudents(), student]);
  if (isRemote()) pushStudent(student);
  return { ok: true, student };
}

export function updateStudent(id, data) {
  const errors = validateStudent(data, { excludeId: id });
  if (errors.length) return { ok: false, errors };
  const next = getStudents().map((s) =>
    s.id === id
      ? { ...s, grade: Number(data.grade), classNo: String(data.classNo).trim().toUpperCase(),
          studentNo: data.studentNo.trim(), name: data.name.trim(), email: data.email.trim() }
      : s
  );
  writeStudents(next);
  if (isRemote()) pushStudent(next.find((s) => s.id === id));
  return { ok: true };
}

export function deleteStudent(id) {
  writeStudents(getStudents().filter((s) => s.id !== id));
  const { [id]: _removed, ...rest } = getAllProgress();
  writeProgress(rest);
  const certificates = getCertificates().filter((c) => c.studentId !== id);
  const quizResults = getQuizResults().filter((r) => r.studentId !== id);
  if (isRemote()) {
    getCache().certificates = certificates;
    getCache().quizResults = quizResults;
    pushDeleteStudent(id); // DB 쪽은 on delete cascade가 진도/퀴즈/수료증을 함께 정리
  } else {
    write(KEYS.certificates, certificates);
    write(KEYS.quizResults, quizResults);
  }
}

/* ===== 교수 허용 목록 (관리자 전용 관리) ===== */
const LOCAL_ADMIN = { email: "imjp5678@scjc.ac.kr", name: "정종필 교수", isAdmin: true };

export function getProfessors() {
  return isRemote() ? getCache().professors : read(KEYS.professors, [LOCAL_ADMIN]);
}

function writeProfessors(list) {
  if (isRemote()) getCache().professors = list;
  else write(KEYS.professors, list);
}

export function addProfessor(data) {
  const errors = [];
  const email = data.email?.trim().toLowerCase() ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("올바른 이메일을 입력해 주세요.");
  if (!data.name?.trim()) errors.push("이름을 입력해 주세요.");
  if (getProfessors().some((p) => p.email === email)) errors.push(`${email}은(는) 이미 등록되어 있습니다.`);
  if (getStudents().some((s) => s.email.toLowerCase() === email)) {
    errors.push("학생 명단에 있는 이메일입니다. 학생 계정을 먼저 삭제하세요.");
  }
  if (errors.length) return { ok: false, errors };
  const professor = { email, name: data.name.trim(), isAdmin: false };
  writeProfessors([...getProfessors(), professor]);
  if (isRemote()) pushProfessor(professor);
  return { ok: true, professor };
}

export function updateProfessorName(email, name) {
  if (!name?.trim()) return { ok: false, errors: ["이름을 입력해 주세요."] };
  const next = getProfessors().map((p) => (p.email === email ? { ...p, name: name.trim() } : p));
  writeProfessors(next);
  if (isRemote()) pushProfessor(next.find((p) => p.email === email));
  return { ok: true };
}

export function deleteProfessor(email, currentUserEmail) {
  const target = getProfessors().find((p) => p.email === email);
  if (!target) return { ok: false, errors: ["대상을 찾을 수 없습니다."] };
  if (target.isAdmin) return { ok: false, errors: ["관리자 계정은 삭제할 수 없습니다."] };
  if (email === currentUserEmail?.toLowerCase()) return { ok: false, errors: ["본인 계정은 삭제할 수 없습니다."] };
  writeProfessors(getProfessors().filter((p) => p.email !== email));
  if (isRemote()) pushDeleteProfessor(email);
  return { ok: true };
}

/* ===== 영상 (skillId → [ { id, url, updatedAt }, ... ]) ===== */
export function getVideos() {
  return isRemote() ? getCache().videos : read(KEYS.videos, {});
}

function writeVideos(videos) {
  if (isRemote()) getCache().videos = videos;
  else write(KEYS.videos, videos);
}

export function addVideo(skillId, url) {
  const video = { id: uid(), url: url.trim(), updatedAt: new Date().toISOString() };
  const all = getVideos();
  writeVideos({ ...all, [skillId]: [...(all[skillId] ?? []), video] });
  if (isRemote()) pushVideoInsert(skillId, video);
  return video;
}

export function removeVideo(skillId, videoId) {
  const all = getVideos();
  const list = (all[skillId] ?? []).filter((v) => v.id !== videoId);
  const next = { ...all };
  if (list.length) next[skillId] = list;
  else delete next[skillId];
  writeVideos(next);
  if (isRemote()) pushVideoDelete(videoId);
}

// 구버전(술기당 1개 객체) 로컬 데이터 → 배열 형태로 변환
function migrateVideosShape() {
  const videos = read(KEYS.videos, {});
  let changed = false;
  const next = {};
  for (const [skillId, value] of Object.entries(videos)) {
    if (Array.isArray(value)) {
      next[skillId] = value;
    } else {
      next[skillId] = [{ id: uid(), url: value.url, updatedAt: value.updatedAt }];
      changed = true;
    }
  }
  if (changed) write(KEYS.videos, next);
}

/* ===== 진도 (studentId → skillId → { videoWatched, bestScore, passed }) ===== */
export function getAllProgress() {
  return isRemote() ? getCache().progress : read(KEYS.progress, {});
}

function writeProgress(progress) {
  if (isRemote()) getCache().progress = progress;
  else write(KEYS.progress, progress);
}

export function getProgress(studentId) {
  return getAllProgress()[studentId] ?? {};
}

export function updateProgress(studentId, skillId, patch) {
  const all = getAllProgress();
  const byStudent = all[studentId] ?? {};
  const cur = byStudent[skillId] ?? { videoWatched: false, bestScore: 0, passed: false };
  const merged = { ...cur, ...patch, updatedAt: new Date().toISOString() };
  writeProgress({ ...all, [studentId]: { ...byStudent, [skillId]: merged } });
  if (isRemote()) pushProgress(studentId, skillId, merged);
}

export function countPassed(studentId) {
  return Object.values(getProgress(studentId)).filter((p) => p.passed).length;
}

/* ===== 퀴즈 결과 ===== */
export function getQuizResults(studentId = null) {
  const all = isRemote() ? getCache().quizResults : read(KEYS.quizResults, []);
  return studentId ? all.filter((r) => r.studentId === studentId) : all;
}

export const QUIZ_PASS_SCORE = 80;

export function recordQuizResult({ studentId, skillId, score, total }) {
  const result = {
    id: uid(), studentId, skillId, score, total,
    createdAt: new Date().toISOString(),
  };
  if (isRemote()) {
    getCache().quizResults = [...getQuizResults(), result];
    pushQuizResult(result);
  } else {
    write(KEYS.quizResults, [...getQuizResults(), result]);
  }
  const pct = Math.round((score / total) * 100);
  const cur = getProgress(studentId)[skillId] ?? { bestScore: 0 };
  updateProgress(studentId, skillId, {
    bestScore: Math.max(cur.bestScore ?? 0, pct),
    passed: (cur.passed ?? false) || pct >= QUIZ_PASS_SCORE,
  });
  return result;
}

/* ===== 수료증 ===== */
export function getCertificates() {
  return isRemote() ? getCache().certificates : read(KEYS.certificates, []);
}

export function getCertificateByStudent(studentId) {
  return getCertificates().find((c) => c.studentId === studentId) ?? null;
}

export function issueCertificate(studentId, issuedBy) {
  if (getCertificateByStudent(studentId)) {
    return { ok: false, errors: ["이미 수료증이 발급된 학생입니다."] };
  }
  const student = getStudent(studentId);
  if (!student) return { ok: false, errors: ["학생을 찾을 수 없습니다."] };
  const year = new Date().getFullYear();
  const seq = getCertificates().filter((c) => c.certNo.includes(`-${year}-`)).length + 1;
  const cert = {
    id: uid(),
    certNo: `청암간호 핵심기본간호술-${year}-${String(seq).padStart(4, "0")}`,
    studentId,
    issuedBy,
    passedCount: countPassed(studentId),
    issuedAt: new Date().toISOString(),
  };
  if (isRemote()) {
    getCache().certificates = [...getCertificates(), cert];
    pushCertificate(cert);
  } else {
    write(KEYS.certificates, [...getCertificates(), cert]);
  }
  return { ok: true, cert };
}

export function revokeCertificate(certId) {
  const next = getCertificates().filter((c) => c.id !== certId);
  if (isRemote()) {
    getCache().certificates = next;
    pushDeleteCertificate(certId);
  } else {
    write(KEYS.certificates, next);
  }
}

/* ===== 과제 ===== */
export function getAssignments() {
  return isRemote() ? getCache().assignments : read(KEYS.assignments, []);
}

function writeAssignmentList(list) {
  if (isRemote()) getCache().assignments = list;
  else write(KEYS.assignments, list);
}

function validateAssignment(data) {
  const errors = [];
  if (!data.title?.trim()) errors.push("과제 제목을 입력해 주세요.");
  if (data.dueDate && Number.isNaN(new Date(data.dueDate).getTime())) errors.push("마감일이 올바르지 않습니다.");
  return errors;
}

function normalizeAssignment(data) {
  return {
    title: data.title.trim(),
    description: data.description?.trim() ?? "",
    dueDate: data.dueDate || null,
    skillId: data.skillId ? Number(data.skillId) : null,
  };
}

export function addAssignment(data) {
  const errors = validateAssignment(data);
  if (errors.length) return { ok: false, errors };
  const assignment = { id: uid(), ...normalizeAssignment(data), createdAt: new Date().toISOString() };
  writeAssignmentList([assignment, ...getAssignments()]);
  if (isRemote()) pushAssignment(assignment);
  return { ok: true, assignment };
}

export function updateAssignment(id, data) {
  const errors = validateAssignment(data);
  if (errors.length) return { ok: false, errors };
  const next = getAssignments().map((a) => (a.id === id ? { ...a, ...normalizeAssignment(data) } : a));
  writeAssignmentList(next);
  if (isRemote()) pushAssignment(next.find((a) => a.id === id));
  return { ok: true };
}

export function deleteAssignment(id) {
  writeAssignmentList(getAssignments().filter((a) => a.id !== id));
  const submissions = getSubmissions().filter((s) => s.assignmentId !== id);
  if (isRemote()) {
    getCache().submissions = submissions;
    pushDeleteAssignment(id); // DB 쪽은 on delete cascade가 제출물 정리
  } else {
    write(KEYS.submissions, submissions);
  }
}

/* ===== 과제 제출 ===== */
export function getSubmissions(assignmentId = null) {
  const all = isRemote() ? getCache().submissions : read(KEYS.submissions, []);
  return assignmentId ? all.filter((s) => s.assignmentId === assignmentId) : all;
}

export function getMySubmission(assignmentId, studentId) {
  return getSubmissions(assignmentId).find((s) => s.studentId === studentId) ?? null;
}

export function submitAssignment({ assignmentId, studentId, content, linkUrl }) {
  const trimmedContent = content?.trim() ?? "";
  const trimmedLink = linkUrl?.trim() ?? "";
  if (!trimmedContent && !trimmedLink) {
    return { ok: false, errors: ["제출 내용 또는 링크 중 하나는 입력해야 합니다."] };
  }
  if (trimmedLink && !/^https?:\/\/\S+$/.test(trimmedLink)) {
    return { ok: false, errors: ["링크는 http(s)://로 시작하는 주소여야 합니다."] };
  }
  const existing = getMySubmission(assignmentId, studentId);
  const submission = {
    id: existing?.id ?? uid(),
    assignmentId, studentId,
    content: trimmedContent, linkUrl: trimmedLink,
    submittedAt: new Date().toISOString(),
  };
  const rest = getSubmissions().filter((s) => s.id !== submission.id);
  const next = [...rest, submission];
  if (isRemote()) getCache().submissions = next;
  else write(KEYS.submissions, next);
  if (isRemote()) pushSubmission(submission);
  return { ok: true, submission };
}

/* ===== 세션 ===== */
export function getSession() {
  return read(KEYS.session, null);
}

export function setSession(session) {
  if (session === null) localStorage.removeItem(KEYS.session);
  else write(KEYS.session, session);
}

/* ===== 시드 데이터 ===== */
const SEED_STUDENTS = [
  { grade: 2, classNo: "A", studentNo: "20240101", name: "김하은", email: "s001@scjc.ac.kr" },
  { grade: 2, classNo: "A", studentNo: "20240102", name: "이서준", email: "s002@scjc.ac.kr" },
  { grade: 2, classNo: "B", studentNo: "20240115", name: "박지우", email: "s003@scjc.ac.kr" },
  { grade: 3, classNo: "A", studentNo: "20230207", name: "최민서", email: "s004@scjc.ac.kr" },
  { grade: 3, classNo: "B", studentNo: "20230221", name: "정도윤", email: "s005@scjc.ac.kr" },
  { grade: 4, classNo: "A", studentNo: "20220304", name: "강수아", email: "s006@scjc.ac.kr" },
  { grade: 4, classNo: "A", studentNo: "20220311", name: "윤시우", email: "s007@scjc.ac.kr" },
  { grade: 1, classNo: "C", studentNo: "20250412", name: "임예린", email: "s008@scjc.ac.kr" },
];

export function seedIfEmpty() {
  if (isRemote()) return; // 원격 모드는 supabase/schema.sql의 초기 데이터 사용
  if (!read(KEYS.seeded, false)) {
    const students = SEED_STUDENTS.map((s) => ({
      ...s, id: uid(), createdAt: new Date().toISOString(),
    }));
    write(KEYS.students, students);

    // 데모용 진도: 첫 번째 학생(김하은)은 전 항목 이수, 두 번째는 일부 진행
    const [first, second] = students;
    const progress = {};
    progress[first.id] = {};
    for (const skill of SKILLS) {
      progress[first.id][skill.id] = {
        videoWatched: true, bestScore: 80 + (skill.id % 3) * 10, passed: true,
        updatedAt: new Date().toISOString(),
      };
    }
    progress[second.id] = {
      1: { videoWatched: true, bestScore: 100, passed: true, updatedAt: new Date().toISOString() },
      2: { videoWatched: true, bestScore: 60, passed: false, updatedAt: new Date().toISOString() },
    };
    write(KEYS.progress, progress);
    write(KEYS.seeded, true);
  }
  upgradeDemoStudent();
  migrateDemoEmails();
  migrateVideosShape();
}

// 구버전 시드의 데모 학생 이메일을 s001~s008@scjc.ac.kr 로 1회 변경
function migrateDemoEmails() {
  if (read(KEYS.demoEmails, false)) return;
  const emailByStudentNo = Object.fromEntries(
    SEED_STUDENTS.map((s) => [s.studentNo, s.email])
  );
  const next = getStudents().map((s) =>
    emailByStudentNo[s.studentNo] ? { ...s, email: emailByStudentNo[s.studentNo] } : s
  );
  write(KEYS.students, next);
  write(KEYS.demoEmails, true);
}

// 데모 학생(학번 20240101)을 전 항목 이수 + 수료증 발급 상태로 승격
// (구버전 시드로 만들어진 기존 브라우저 데이터도 한 번만 업그레이드)
function upgradeDemoStudent() {
  if (read(KEYS.demoUpgraded, false)) return;
  const demo = getStudents().find((s) => s.studentNo === "20240101");
  if (demo) {
    for (const skill of SKILLS) {
      const cur = getProgress(demo.id)[skill.id] ?? {};
      updateProgress(demo.id, skill.id, {
        videoWatched: true,
        bestScore: Math.max(cur.bestScore ?? 0, 80 + (skill.id % 3) * 10),
        passed: true,
      });
    }
    if (!getCertificateByStudent(demo.id)) {
      issueCertificate(demo.id, "간호학과 교수");
    }
  }
  write(KEYS.demoUpgraded, true);
}
