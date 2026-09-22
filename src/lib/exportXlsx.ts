import ExcelJS from "exceljs";
import { downloadBlob } from "./downloadBlob";
import type { UserAccount } from "./auth";
import type { KtjPlan } from "./generators";
import type { CtjRow } from "./thematicPlan";

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

export async function exportKtjToXlsx(plan: KtjPlan) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sabaq AI";
  wb.created = new Date();

  const summary = wb.addWorksheet("Қорытынды");
  summary.columns = [
    { header: "Тоқсан", key: "quarter", width: 16 },
    { header: "Апта саны", key: "weeks", width: 14 },
    { header: "Сабақ саны", key: "lessons", width: 14 },
  ];
  summary.getRow(1).eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = HEADER_FILL;
  });
  plan.quarters.forEach((q) => summary.addRow({ quarter: q.name, weeks: q.weeks, lessons: q.lessons }));
  summary.addRow({});
  const infoRow = summary.addRow({ quarter: "Пән", weeks: plan.subject });
  infoRow.getCell(1).font = { bold: true };
  const gradeRow = summary.addRow({ quarter: "Сынып", weeks: plan.grade });
  gradeRow.getCell(1).font = { bold: true };
  const hoursRow = summary.addRow({ quarter: "Апталық сағат", weeks: plan.hoursPerWeek });
  hoursRow.getCell(1).font = { bold: true };
  const totalRow = summary.addRow({ quarter: "Барлық сабақ", weeks: plan.totalLessons });
  totalRow.getCell(1).font = { bold: true };

  const sheet = wb.addWorksheet("КТЖ");
  sheet.columns = [
    { header: "Тоқсан", key: "quarter", width: 14 },
    { header: "Апта", key: "week", width: 10 },
    { header: "Сабақ №", key: "num", width: 10 },
    { header: "Тақырып", key: "topic", width: 42 },
    { header: "Кезең", key: "stage", width: 20 },
  ];
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = HEADER_FILL;
  });
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  plan.weeks.forEach((week) => {
    week.lessons.forEach((lesson) => {
      sheet.addRow({
        quarter: week.quarterName,
        week: `${week.weekInQuarter}-апта`,
        num: lesson.globalNumber,
        topic: lesson.topic,
        stage: lesson.stage,
      });
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  downloadBlob(blob, `KTZH-${plan.subject}-${plan.grade}.xlsx`);
}

export async function exportThematicToXlsx(subject: string, grade: string, rows: CtjRow[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sabaq AI";
  wb.created = new Date();

  const sheet = wb.addWorksheet("КТЖ");
  sheet.columns = [
    { header: "№", key: "num", width: 6 },
    { header: "Сабақ күні", key: "date", width: 14 },
    { header: "Уақыты", key: "time", width: 10 },
    { header: "Мұғалім", key: "teacher", width: 22 },
    { header: "Топтар", key: "groups", width: 16 },
    { header: "Тақырып", key: "topic", width: 42 },
    { header: "Сабақ түрі", key: "lessonKind", width: 18 },
    { header: "Тақырып саны", key: "topicCount", width: 14 },
    { header: "Үй тапсырмасы", key: "homework", width: 28 },
    { header: "Орындау уақыты (мин)", key: "executionMinutes", width: 18 },
    { header: "Интерактивті сабақ", key: "interactive", width: 18 },
  ];
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = HEADER_FILL;
  });
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  rows.forEach((r, i) => {
    sheet.addRow({
      num: i + 1,
      date: r.date,
      time: r.time,
      teacher: r.teacher,
      groups: r.groups,
      topic: r.topic,
      lessonKind: r.lessonKind,
      topicCount: r.topicCount,
      homework: r.homework,
      executionMinutes: r.executionMinutes ?? "",
      interactive: r.interactive ? "Иә" : "Жоқ",
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  downloadBlob(blob, `KTZH-${subject}-${grade}.xlsx`);
}

export async function exportUsersToXlsx(users: UserAccount[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sabaq AI";
  wb.created = new Date();

  const sheet = wb.addWorksheet("Аккаунттар");
  sheet.columns = [
    { header: "Аты-жөні", key: "name", width: 24 },
    { header: "Email", key: "email", width: 28 },
    { header: "Рөлі", key: "role", width: 12 },
    { header: "Мәртебесі", key: "status", width: 14 },
    { header: "Пән", key: "subject", width: 18 },
    { header: "Мектеп", key: "school", width: 24 },
    { header: "Құрылған күні", key: "createdAt", width: 18 },
    { header: "Соңғы кіру", key: "lastLoginAt", width: 18 },
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
      role: u.role === "admin" ? "Әкімші" : "Мұғалім",
      status: u.status === "active" ? "Белсенді" : "Өшірілген",
      subject: u.subject,
      school: u.school,
      createdAt: formatKzDate(u.createdAt),
      lastLoginAt: u.lastLoginAt ? formatKzDate(u.lastLoginAt) : "—",
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  downloadBlob(blob, "Sabaq-AI-akkauntlar.xlsx");
}
