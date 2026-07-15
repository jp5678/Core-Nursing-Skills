// localStorage 기반 저장소 — Repository 패턴, 불변 업데이트
import { SKILLS } from "./data/skills-data.js";
import { CLASS_OPTIONS } from "./config.js";

const PREFIX = "cnsp.";
const KEYS = {
  students: `${PREFIX}students`,
  videos: `${PREFIX}videos`,
  progress: `${PREFIX}progress`,
  quizResults: `${PREFIX}quizResults`,
  certificates: `${PREFIX}certificates`,
  session: `${PREFIX}session`,
  seeded: `${PREFIX}seeded.v1`,
  demoUpgraded: `${PREFIX}migration.demoFullCompletion`,
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
  return read(KEYS.students, []);
}

export function getStudent(id) {
  return getStudents().find((s) => s.id === id) ?? null;
}

export function validateStudent(data, { excludeId = null } = {}) {
  const errors = [];
  if (!data.name?.trim()) errors.push("성명을 입력해 주세요.");
  if (!/^\d{4,10}$/.test(data.studentNo ?? "")) errors.push("학번은 4~10자리 숫자여야 합니다.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email ?? "")) errors.push("올바른 이메일을 입력해 주세요.");
  const grade = Number(data.grade);
  if (!Number.isInteger(grade) || grade < 1 || grade > 4) errors.push("학년은 1~4 사이여야 합니다.");
  const classNo = data.classNo?.toString().trim().toUpperCase();
  if (!CLASS_OPTIONS.includes(classNo)) errors.push(`반은 ${CLASS_OPTIONS.join(", ")} 중 하나여야 합니다.`);
  const dup = getStudents().find((s) => s.studentNo === data.studentNo && s.id !== excludeId);
  if (dup) errors.push(`학번 ${data.studentNo}은(는) 이미 등록되어 있습니다 (${dup.name}).`);
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
  write(KEYS.students, [...getStudents(), student]);
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
  write(KEYS.students, next);
  return { ok: true };
}

export function deleteStudent(id) {
  write(KEYS.students, getStudents().filter((s) => s.id !== id));
  const progress = read(KEYS.progress, {});
  const { [id]: _removed, ...rest } = progress;
  write(KEYS.progress, rest);
}

/* ===== 영상 (skillId → { url, updatedAt }) ===== */
export function getVideos() {
  return read(KEYS.videos, {});
}

export function setVideo(skillId, url) {
  const videos = getVideos();
  const next = url
    ? { ...videos, [skillId]: { url, updatedAt: new Date().toISOString() } }
    : Object.fromEntries(Object.entries(videos).filter(([k]) => k !== String(skillId)));
  write(KEYS.videos, next);
}

/* ===== 진도 (studentId → skillId → { videoWatched, bestScore, passed }) ===== */
export function getAllProgress() {
  return read(KEYS.progress, {});
}

export function getProgress(studentId) {
  return getAllProgress()[studentId] ?? {};
}

export function updateProgress(studentId, skillId, patch) {
  const all = getAllProgress();
  const byStudent = all[studentId] ?? {};
  const cur = byStudent[skillId] ?? { videoWatched: false, bestScore: 0, passed: false };
  const next = {
    ...all,
    [studentId]: {
      ...byStudent,
      [skillId]: { ...cur, ...patch, updatedAt: new Date().toISOString() },
    },
  };
  write(KEYS.progress, next);
}

export function countPassed(studentId) {
  return Object.values(getProgress(studentId)).filter((p) => p.passed).length;
}

/* ===== 퀴즈 결과 ===== */
export function getQuizResults(studentId = null) {
  const all = read(KEYS.quizResults, []);
  return studentId ? all.filter((r) => r.studentId === studentId) : all;
}

export const QUIZ_PASS_SCORE = 80;

export function recordQuizResult({ studentId, skillId, score, total }) {
  const result = {
    id: uid(), studentId, skillId, score, total,
    createdAt: new Date().toISOString(),
  };
  write(KEYS.quizResults, [...getQuizResults(), result]);
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
  return read(KEYS.certificates, []);
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
  write(KEYS.certificates, [...getCertificates(), cert]);
  return { ok: true, cert };
}

export function revokeCertificate(certId) {
  write(KEYS.certificates, getCertificates().filter((c) => c.id !== certId));
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
  { grade: 2, classNo: "A", studentNo: "20240101", name: "김하은", email: "haeun.kim@scjc.ac.kr" },
  { grade: 2, classNo: "A", studentNo: "20240102", name: "이서준", email: "seojun.lee@scjc.ac.kr" },
  { grade: 2, classNo: "B", studentNo: "20240115", name: "박지우", email: "jiwoo.park@scjc.ac.kr" },
  { grade: 3, classNo: "A", studentNo: "20230207", name: "최민서", email: "minseo.choi@scjc.ac.kr" },
  { grade: 3, classNo: "B", studentNo: "20230221", name: "정도윤", email: "doyun.jung@scjc.ac.kr" },
  { grade: 4, classNo: "A", studentNo: "20220304", name: "강수아", email: "sua.kang@scjc.ac.kr" },
  { grade: 4, classNo: "A", studentNo: "20220311", name: "윤시우", email: "siwoo.yoon@scjc.ac.kr" },
  { grade: 1, classNo: "C", studentNo: "20250412", name: "임예린", email: "yerin.lim@scjc.ac.kr" },
];

export function seedIfEmpty() {
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
