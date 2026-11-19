// Мұғалім жүктеген файлдан мәтін алу (браузерде, серверге жібермей):
// Word (.docx) — mammoth, PDF — pdf.js, мәтіндік файлдар — тікелей.

import { tr } from "../i18n";

export const FILE_ACCEPT = ".docx,.pdf,.txt,.md,.csv";
const MAX_BYTES = 20 * 1024 * 1024;
/** AI-ға жіберілетін мәтіннің шегі (ұзын файлдың басы алынады). */
export const MAX_CHARS = 30000;

async function pdfText(buf: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= Math.min(doc.numPages, 40); i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    let line = "";
    const lines: string[] = [];
    for (const item of content.items) {
      if (!("str" in item)) continue;
      line += item.str;
      if (item.hasEOL) {
        lines.push(line);
        line = "";
      }
    }
    if (line) lines.push(line);
    pages.push(lines.join("\n"));
  }
  return pages.join("\n\n");
}

/** Файлдан таза мәтін. Сканерленген (сурет) PDF-те мәтін болмайды — қате береді. */
export async function readFileText(file: File): Promise<string> {
  if (file.size > MAX_BYTES) throw new Error(tr("Файл тым үлкен (20 MB-тан аспауы керек)."));
  const name = file.name.toLowerCase();
  let text: string;
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    text = (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
  } else if (name.endsWith(".pdf")) {
    text = await pdfText(await file.arrayBuffer());
  } else if (/\.(txt|md|csv)$/.test(name)) {
    text = await file.text();
  } else {
    throw new Error(tr("Бұл файл түрі қолдау таппайды. Word (.docx), PDF немесе мәтін (.txt) файлын жүктеңіз."));
  }
  text = text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (text.length < 20) {
    throw new Error(tr("Файлдан мәтін табылмады. PDF сканерленген сурет болса, мәтінін көшіріп, төмендегі өріске қойыңыз."));
  }
  return text;
}
