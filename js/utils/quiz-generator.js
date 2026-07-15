// 술기 프로토콜 데이터에서 인터랙티브 퀴즈 문항을 자동 생성
import { getSkills } from "../store.js";

const QUESTIONS_PER_QUIZ = 5;

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pick(arr, n) {
  return shuffle(arr).slice(0, n);
}

// 텍스트가 서로 다르고 exclude와도 겹치지 않는 항목을 n개 선택 (부족하면 null)
function pickDistinct(candidates, n, exclude = []) {
  const seen = new Set(exclude);
  const result = [];
  for (const item of shuffle(candidates)) {
    if (seen.has(item)) continue;
    seen.add(item);
    result.push(item);
    if (result.length === n) return result;
  }
  return null;
}

function truncate(text, max = 90) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// 문항 형태: { question, options: string[], answerIndex, explanation }
function makeQuestion(question, correct, wrongs, explanation) {
  const options = shuffle([correct, ...wrongs]);
  return { question, options, answerIndex: options.indexOf(correct), explanation };
}

/* 유형 1 — 수행 순서: 연속 4단계를 섞어 올바른 순서 고르기 */
function orderQuestion(skill) {
  if (skill.steps.length < 4) return null;
  const start = Math.floor(Math.random() * (skill.steps.length - 3));
  const window = skill.steps.slice(start, start + 4);
  const labels = ["가", "나", "다", "라"];
  const shuffled = shuffle(window);
  const listing = shuffled
    .map((s, i) => `${labels[i]}. ${truncate(s.text, 60)}`)
    .join("\n");
  const correctOrder = window.map((s) => labels[shuffled.indexOf(s)]).join(" → ");
  const wrongOrders = new Set();
  while (wrongOrders.size < 3) {
    const cand = shuffle(labels).join(" → ");
    if (cand !== correctOrder) wrongOrders.add(cand);
  }
  return makeQuestion(
    `[수행 순서] 「${skill.name}」 수행 시 다음 항목의 올바른 순서는?\n${listing}`,
    correctOrder,
    [...wrongOrders],
    `프로토콜 ${window[0].no}~${window[3].no}번 단계의 순서입니다.`
  );
}

/* 유형 2 — 필요 물품이 아닌 것: 타 술기의 물품을 오답으로 */
function equipmentQuestion(skill, allSkills) {
  if (skill.equipment.length < 3) return null;
  const own = new Set(skill.equipment);
  const foreign = allSkills
    .filter((s) => s.id !== skill.id)
    .flatMap((s) => s.equipment)
    .filter((e) => !own.has(e) && ![...own].some((o) => o.includes(e) || e.includes(o)));
  if (!foreign.length) return null;
  const intruder = truncate(pick(foreign, 1)[0], 60);
  const owns = pickDistinct(skill.equipment.map((e) => truncate(e, 60)), 3, [intruder]);
  if (!owns) return null;
  return makeQuestion(
    `[필요 물품] 다음 중 「${skill.name}」의 필요장비 및 물품이 아닌 것은?`,
    intruder,
    owns,
    "프로토콜의 '필요장비 및 물품' 목록을 확인하세요."
  );
}

/* 유형 3 — 핵심 수행항목(★) 식별 */
function criticalStepQuestion(skill) {
  const criticals = skill.steps.filter((s) => s.critical);
  const normals = skill.steps.filter((s) => !s.critical);
  if (!criticals.length || normals.length < 3) return null;
  const correct = pick(criticals, 1)[0];
  const correctText = truncate(correct.text);
  const criticalTexts = criticals.map((s) => truncate(s.text));
  const wrongs = pickDistinct(
    normals.map((s) => truncate(s.text)).filter((t) => !criticalTexts.includes(t)),
    3, [correctText]
  );
  if (!wrongs) return null;
  return makeQuestion(
    `[핵심 항목] 다음 중 「${skill.name}」에서 핵심 수행항목(★)으로 지정된 것은?`,
    correctText,
    wrongs,
    `${correct.no}번 단계가 핵심 수행항목입니다.`
  );
}

/* 유형 4 — 첫 수행 단계 */
function firstStepQuestion(skill) {
  if (skill.steps.length < 5) return null;
  const firstText = truncate(skill.steps[0].text);
  const later = pickDistinct(skill.steps.slice(2).map((s) => truncate(s.text)), 3, [firstText]);
  if (!later) return null;
  return makeQuestion(
    `[우선 순위] 「${skill.name}」 수행 시 가장 먼저 해야 하는 것은?`,
    firstText,
    later,
    "대부분의 술기는 손위생 또는 대상자 확인부터 시작합니다."
  );
}

/* 유형 5 — 성취목표 사실 확인 */
function objectiveQuestion(skill, allSkills) {
  if (skill.objectives.length < 1) return null;
  const own = new Set(skill.objectives);
  const foreign = allSkills
    .filter((s) => s.id !== skill.id)
    .flatMap((s) => s.objectives)
    .filter((o) => !own.has(o));
  if (foreign.length < 3) return null;
  const correct = truncate(pick(skill.objectives, 1)[0]);
  const wrongs = pickDistinct(foreign.map((o) => truncate(o)), 3, [correct]);
  if (!wrongs) return null;
  return makeQuestion(
    `[성취 목표] 다음 중 「${skill.name}」의 성취목표에 해당하는 것은?`,
    correct,
    wrongs,
    "프로토콜의 '성취목표'를 확인하세요."
  );
}

export function generateQuiz(skill) {
  const allSkills = getSkills();
  const makers = [orderQuestion, equipmentQuestion, criticalStepQuestion, firstStepQuestion, objectiveQuestion];
  const questions = [];
  for (const make of makers) {
    const q = make(skill, allSkills);
    if (q) questions.push(q);
  }
  // 부족하면 순서/핵심 문항을 추가 생성해 5문항 확보
  let guard = 0;
  while (questions.length < QUESTIONS_PER_QUIZ && guard < 10) {
    const q = (guard % 2 === 0 ? orderQuestion : criticalStepQuestion)(skill, allSkills);
    if (q && !questions.some((x) => x.question === q.question)) questions.push(q);
    guard++;
  }
  return shuffle(questions).slice(0, QUESTIONS_PER_QUIZ);
}
