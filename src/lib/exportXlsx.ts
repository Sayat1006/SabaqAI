import ExcelJS from "exceljs";
import { downloadBlob } from "./downloadBlob";
import type { UserAccount } from "./auth";

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
