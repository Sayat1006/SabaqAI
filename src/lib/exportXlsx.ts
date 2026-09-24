import ExcelJS from "exceljs";
import { downloadBlob } from "./downloadBlob";
import type { UserAccount } from "./auth";
import type { SavedTest, TestSubmission } from "./projects";
import { tr } from "../i18n";

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7DFCB" } };

// Intl-дің "kk-KZ" локалі кейбір орталарда толық қолдау таппай, АҚШ-тың
// MM/DD/YYYY ретін қайтаруы мүмкін, сондықтан ДД.АА.ЖЖЖЖ форматын қолмен
// құрастырамыз.
function formatKzDate(ts: string): string {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()} ${hh}:${min}`;
}

export async function exportUsersToXlsx(users: UserAccount[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AI Nur";
  wb.created = new Date();

  const sheet = wb.addWorksheet(tr("Аккаунттар"));
  sheet.columns = [
    { header: tr("Аты-жөні"), key: "name", width: 24 },
    { header: "Email", key: "email", width: 28 },
    { header: tr("Рөлі"), key: "role", width: 12 },
    { header: tr("Мәртебесі"), key: "status", width: 14 },
    { header: tr("Пән"), key: "subject", width: 18 },
    { header: tr("Мектеп"), key: "school", width: 24 },
    { header: tr("Құрылған күні"), key: "createdAt", width: 18 },
    { header: tr("Соңғы кіру"), key: "lastLoginAt", width: 18 },
  ];
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = HEADER_FILL;
  });
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  users.forEach((u) => {
    sheet.addRow({
      name: u.name,
      email: u.email,
      role: u.role === "admin" ? tr("Әкімші") : tr("Мұғалім"),
      status: u.status === "active" ? tr("Белсенді") : tr("Өшірілген"),
      subject: u.subject,
      school: u.school,
      createdAt: formatKzDate(u.createdAt),
      lastLoginAt: u.lastLoginAt ? formatKzDate(u.lastLoginAt) : "—",
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  downloadBlob(blob, "AI-Nur-akkauntlar.xlsx");
}

const pctOf = (score: number, total: number) => (total ? Math.round((score / total) * 100) : 0);
const groupLabel = (p: number) => (p >= 85 ? tr("C — жоғары") : p >= 50 ? tr("B — орта") : tr("A — қолдау қажет"));

/** Оқушылар нәтижесі: 1-парақ — оқушылар бойынша, 2-парақ — сұрақтар бойынша. */
export async function exportResultsToXlsx(test: SavedTest, subs: TestSubmission[]) {
  const letter = (i: number) => String.fromCharCode(65 + i);
  const wb = new ExcelJS.Workbook();
  wb.creator = "AI Nur";
  wb.created = new Date();

  const sheet = wb.addWorksheet(tr("Нәтижелер"));
  sheet.columns = [
    { header: "№", key: "n", width: 5 },
    { header: tr("Аты-жөні"), key: "name", width: 26 },
    { header: tr("Сынып"), key: "cls", width: 9 },
    { header: tr("Ұпай"), key: "score", width: 8 },
    { header: tr("Барлығы"), key: "total", width: 9 },
    { header: "%", key: "pct", width: 7 },
    { header: tr("Топ"), key: "group", width: 18 },
    { header: tr("Уақыты"), key: "time", width: 17 },
    ...test.questions.map((q, i) => ({ header: `${i + 1}${q.level ? ` (${q.level})` : ""}`, key: `q${i}`, width: 7 })),
  ];
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = HEADER_FILL;
  });
  sheet.views = [{ state: "frozen", ySplit: 1, xSplit: 2 }];

  subs.forEach((s, i) => {
    const p = pctOf(s.score, s.total);
    const row = sheet.addRow({
      n: i + 1,
      name: s.studentName,
      cls: s.studentClass,
      score: s.score,
      total: s.total,
      pct: p,
      group: groupLabel(p),
      time: formatKzDate(new Date(s.createdAt).toISOString()),
      ...Object.fromEntries(
        test.questions.map((q, qi) => {
          const a = s.answers[qi];
          return [`q${qi}`, a === null || a === undefined ? "—" : a === q.correctIndex ? `✓ ${letter(a)}` : `✗ ${letter(a)}`];
        }),
      ),
    });
    test.questions.forEach((q, qi) => {
      const c = row.getCell(`q${qi}`);
      c.font = { color: { argb: s.answers[qi] === q.correctIndex ? "FF2F7D74" : "FFC0392B" } };
    });
  });

  const stats = wb.addWorksheet(tr("Сұрақтар бойынша"));
  stats.columns = [
    { header: "№", key: "n", width: 5 },
    { header: tr("Сұрақ"), key: "q", width: 60 },
    { header: tr("Деңгейі"), key: "level", width: 9 },
    { header: tr("Дұрыс жауап"), key: "right", width: 24 },
    { header: tr("Дұрыс жауап бергендер, %"), key: "pct", width: 14 },
  ];
  stats.getRow(1).eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = HEADER_FILL;
  });
  test.questions.forEach((q, i) => {
    const ok = subs.filter((s) => s.answers[i] === q.correctIndex).length;
    stats.addRow({ n: i + 1, q: q.question, level: q.level ?? "", right: `${letter(q.correctIndex)}) ${q.options[q.correctIndex]}`, pct: subs.length ? Math.round((ok / subs.length) * 100) : 0 });
  });
  stats.getColumn("q").alignment = { wrapText: true, vertical: "top" };

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const safe = test.topic.replace(/[\\/:*?"<>|]+/g, " ").trim() || "test";
  downloadBlob(blob, `Natizheler - ${safe}.xlsx`);
}

/** Оқушы прогресі: оқушы × тест матрицасы (%), орташа және динамика. */
export async function exportProgressToXlsx(
  students: { name: string; cls: string; avg: number; trend: number; attempts: { testId: string; pct: number }[] }[],
  tests: { id: string; topic: string; subject: string; createdAt: number }[],
  cls: string,
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AI Nur";
  const sheet = wb.addWorksheet(tr("Оқушы прогресі"));
  const d = (ts: number) => formatKzDate(new Date(ts).toISOString()).slice(0, 10);
  sheet.columns = [
    { header: tr("Оқушы"), key: "name", width: 28 },
    { header: tr("Сынып"), key: "cls", width: 8 },
    ...tests.map((t, i) => ({ header: `${t.topic} (${d(t.createdAt)})`, key: `t${i}`, width: 16 })),
    { header: tr("Орташа"), key: "avg", width: 10 },
    { header: tr("Динамика"), key: "trend", width: 11 },
  ];
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = HEADER_FILL;
    cell.alignment = { wrapText: true, vertical: "middle" };
  });
  sheet.getRow(1).height = 42;
  sheet.views = [{ state: "frozen", xSplit: 2, ySplit: 1 }];
  const fill = (p: number): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb: p >= 85 ? "FFD1FAE5" : p >= 50 ? "FFFEF3C7" : "FFFFE4E6" } });
  for (const s of students) {
    const row: Record<string, string | number> = { name: s.name, cls: s.cls, avg: s.avg, trend: s.trend };
    tests.forEach((t, i) => {
      const a = s.attempts.find((x) => x.testId === t.id);
      if (a) row[`t${i}`] = a.pct;
    });
    const r = sheet.addRow(row);
    tests.forEach((_, i) => {
      const c = r.getCell(`t${i}`);
      if (typeof c.value === "number") c.fill = fill(c.value);
    });
  }
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  downloadBlob(blob, `AI-Nur-progress${cls ? `-${cls}` : ""}.xlsx`);
}
