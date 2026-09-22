// КТЖ (Күнтізбелік-тақырыптық жоспар) — bilimclass.kz-тің нақты "Менің
// КТЖ-ларым" құрылымына сай екі деңгейлі модель:
//   1) Тізім деңгейі (CtjPlan): мұғалімнің әр сынып/пән жұбы бойынша жеке
//      КТЖ-сы — Сынып, Пән, Оқу тілі, Бағалау түрі, Оқу бағдарламасы.
//   2) Егжей-тегжей деңгейі (CtjRow): сол жоспардың әр сабағы — Сабақ күні
//      мен уақыты, Мұғалім, Топтар, Тақырып, Сабақ түрі, Тақырып саны,
//      Үй тапсырмасы, Орындау уақыты, Интерактивті сабақ белгісі.

export const LESSON_KINDS = ["Қарапайым сабақ", "Практикалық жұмыс", "Зертханалық жұмыс", "БЖБ", "ТЖБ"];
export const LANGUAGES = ["қазақ", "орыс", "ағылшын"];
export const ASSESSMENT_TYPES = ["Жиынтық баға", "Қалыптастырушы баға"];
export const CURRICULUM_TYPES = ["Жалпы", "Тереңдетілген"];

export interface CtjRow {
  id: string;
  date: string; // Сабақ күні, кк.аа.жжжж
  time: string; // Сабақ уақыты, сс:мм
  teacher: string; // Мұғалім
  groups: string; // Топтар, мыс. "Бүкіл сынып"
  topic: string; // Тақырып
  lessonKind: string; // Сабақ түрі
  topicCount: number; // Тақырып саны
  homework: string; // Үй тапсырмасы
  executionMinutes: number | null; // Орындау уақыты (минутпен)
  interactive: boolean; // Интерактивті сабақ
}

export interface CtjPlan {
  id: string;
  subject: string;
  grade: string; // Сынып, мыс. "7А"
  language: string; // Оқу тілі
  assessmentType: string; // Бағалау түрі
  curriculum: string; // Оқу бағдарламасы
  rows: CtjRow[];
}

function uid(): string {
  return crypto.randomUUID();
}

export function emptyCtjRow(defaultTeacher = ""): CtjRow {
  return {
    id: uid(),
    date: "",
    time: "",
    teacher: defaultTeacher,
    groups: "Бүкіл сынып",
    topic: "",
    lessonKind: LESSON_KINDS[0],
    topicCount: 1,
    homework: "",
    executionMinutes: null,
    interactive: false,
  };
}

export function emptyCtjPlan(subject: string, grade: string): CtjPlan {
  return {
    id: uid(),
    subject,
    grade,
    language: LANGUAGES[0],
    assessmentType: ASSESSMENT_TYPES[0],
    curriculum: CURRICULUM_TYPES[0],
    rows: [],
  };
}

const CTJ_PLANS_KEY = "sai-ktj-plans";

export function getCtjPlans(): CtjPlan[] {
  try {
    const raw = localStorage.getItem(CTJ_PLANS_KEY);
    return raw ? (JSON.parse(raw) as CtjPlan[]) : [];
  } catch {
    return [];
  }
}

export function saveCtjPlans(plans: CtjPlan[]) {
  try {
    localStorage.setItem(CTJ_PLANS_KEY, JSON.stringify(plans));
  } catch {
    // сақтау мүмкін болмаса үнсіз өтеміз
  }
}

export function upsertCtjPlan(plan: CtjPlan): CtjPlan[] {
  const list = getCtjPlans();
  const idx = list.findIndex((p) => p.id === plan.id);
  const next = idx >= 0 ? list.map((p, i) => (i === idx ? plan : p)) : [...list, plan];
  saveCtjPlans(next);
  return next;
}

export function removeCtjPlan(id: string): CtjPlan[] {
  const next = getCtjPlans().filter((p) => p.id !== id);
  saveCtjPlans(next);
  return next;
}

// Импортталған кестенің баған атаулары бойынша қай өріске сәйкес келетінін анықтайды.
type FieldKey =
  | "date"
  | "time"
  | "teacher"
  | "groups"
  | "topic"
  | "lessonKind"
  | "topicCount"
  | "homework"
  | "executionMinutes"
  | "interactive"
  | "skip";

function detectColumn(header: string): FieldKey {
  const h = header.toLowerCase();
  if (h.includes("уақыты") && h.includes("орындау")) return "executionMinutes";
  if (h.includes("мерзім") || h.includes("күні") || h.includes("дата")) return "date";
  if (h.includes("уақыты")) return "time";
  if (h.includes("мұғалім") || h.includes("педагог")) return "teacher";
  if (h.includes("топ") || h.includes("сынып")) return "groups";
  if (h.includes("интерактив")) return "interactive";
  if (h.includes("түрі")) return "lessonKind";
  if (h.includes("саны")) return "topicCount";
  if (h.includes("үй")) return "homework";
  if (h.includes("тақырып") || h.includes("бөлім")) return "topic";
  return "skip";
}

function matchLessonKind(raw: string): string {
  const found = LESSON_KINDS.find((k) => raw.toUpperCase().includes(k.toUpperCase()));
  return found ?? LESSON_KINDS[0];
}

function rowsFromMatrix(matrix: string[][]): CtjRow[] {
  if (matrix.length === 0) return [];
  const headerRow = matrix[0];
  const columns = headerRow.map((h) => detectColumn(h || ""));

  const rows: CtjRow[] = [];
  for (let ri = 1; ri < matrix.length; ri++) {
    const cells = matrix[ri];
    if (cells.every((c) => !c || !c.trim())) continue;

    // Бөлім-ажыратқыш жолдарды өткізіп жіберу (барлық ұяшық бірдей мәтін қайталанады).
    const nonEmpty = cells.filter((c) => c && c.trim());
    if (nonEmpty.length > 1 && nonEmpty.every((c) => c === nonEmpty[0])) continue;

    const row = emptyCtjRow();
    let hasTopic = false;
    columns.forEach((field, ci) => {
      const raw = (cells[ci] || "").trim();
      if (!raw || field === "skip") return;
      if (field === "topicCount") {
        const num = parseInt(raw, 10);
        if (!Number.isNaN(num)) row.topicCount = num;
      } else if (field === "executionMinutes") {
        const num = parseInt(raw, 10);
        row.executionMinutes = Number.isNaN(num) ? null : num;
      } else if (field === "lessonKind") {
        row.lessonKind = matchLessonKind(raw);
      } else if (field === "interactive") {
        row.interactive = /иә|да|\+|бар/i.test(raw);
      } else if (field === "date") {
        row.date = raw;
      } else if (field === "time") {
        row.time = raw;
      } else if (field === "teacher") {
        row.teacher = raw;
      } else if (field === "groups") {
        row.groups = raw;
      } else if (field === "homework") {
        row.homework = raw;
      } else if (field === "topic") {
        row.topic = row.topic ? `${row.topic} / ${raw}` : raw;
        hasTopic = true;
      }
    });
    if (hasTopic || row.topic) rows.push(row);
  }
  return rows;
}

export async function parseXlsxToRows(file: File): Promise<CtjRow[]> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await wb.xlsx.load(buffer);
  const sheet = wb.worksheets[0];
  if (!sheet) return [];

  const matrix: string[][] = [];
  sheet.eachRow((row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      cells.push(cell.text?.trim() ?? "");
    });
    matrix.push(cells);
  });
  return rowsFromMatrix(matrix);
}

export async function parseDocxToRows(file: File): Promise<CtjRow[]> {
  const mammoth = await import("mammoth");
  const buffer = await file.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buffer });

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const tables = Array.from(doc.querySelectorAll("table"));
  if (tables.length === 0) return [];

  // Ең көп жолды кестені негізгі жоспар кестесі деп есептейміз.
  let best = tables[0];
  for (const t of tables) {
    if (t.querySelectorAll("tr").length > best.querySelectorAll("tr").length) best = t;
  }

  const matrix: string[][] = Array.from(best.querySelectorAll("tr")).map((tr) =>
    Array.from(tr.querySelectorAll("td, th")).map((td) => (td.textContent || "").replace(/\s+/g, " ").trim()),
  );
  return rowsFromMatrix(matrix);
}

export async function parseCtjFile(file: File): Promise<CtjRow[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) return parseXlsxToRows(file);
  if (name.endsWith(".docx")) return parseDocxToRows(file);
  throw new Error("Тек .docx, .xlsx немесе .xls файлдарын жүктеуге болады.");
}
