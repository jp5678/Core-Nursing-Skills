// 학생 명단 CSV 내보내기/가져오기

const HEADER = ["학년", "반", "학번", "성명", "이메일"];

function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function exportStudentsCsv(students) {
  const rows = [
    HEADER.join(","),
    ...students.map((s) =>
      [s.grade, s.classNo, s.studentNo, s.name, s.email].map(csvEscape).join(",")
    ),
  ];
  // Excel 한글 호환을 위한 BOM
  const blob = new Blob(["﻿" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `간호학과_학생명단_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function parseCsvLine(line) {
  const cells = [];
  let cur = "", inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuote = false;
      else cur += ch;
    } else if (ch === '"') inQuote = true;
    else if (ch === ",") { cells.push(cur); cur = ""; }
    else cur += ch;
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

// 반환: { rows: [{grade, classNo, studentNo, name, email}], errors: string[] }
export function parseStudentsCsv(text) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { rows: [], errors: ["CSV 파일이 비어 있습니다."] };
  const rows = [];
  const errors = [];
  const startIdx = parseCsvLine(lines[0])[0].includes("학년") ? 1 : 0;
  for (let i = startIdx; i < lines.length; i++) {
    const c = parseCsvLine(lines[i]);
    if (c.length < 5) {
      errors.push(`${i + 1}행: 열이 부족합니다 (학년,반,학번,성명,이메일 순).`);
      continue;
    }
    rows.push({ grade: c[0], classNo: c[1], studentNo: c[2], name: c[3], email: c[4] });
  }
  return { rows, errors };
}
