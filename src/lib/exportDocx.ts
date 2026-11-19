import {
  AlignmentType,
  Bookmark,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  ImageRun,
  LevelFormat,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalMergeType,
  WidthType,
  convertMillimetersToTwip,
  PageOrientation,
  ShadingType,
  TableLayoutType,
} from "docx";
import QRCode from "qrcode";
import { downloadBlob } from "./downloadBlob";
import { isTemplatePlan, type LessonPlan } from "./generators";
import { parseRichLine, splitLines } from "./qmzhText";
import { platformKind, platformLabel } from "./resources";
import type { SavedTest } from "./projects";
import type { DocData } from "./documents";
import { difficultyIn, ktzhLabels, periodIn, qmzhLabels, qmzhTplLabels, testLabels, tplDate } from "./docLabels";
import { kindLabel, ktzhTotalHours, type KtzhData } from "./ktzh";
import { gradeIn, subjectIn } from "./lang";

// Ресми құжат конвенциясына сай: A4, Times New Roman, 1.5 жол аралығы,
// брендтік көк/қара түстер кесте шектері мен тақырыптарда (apple.com стилі).
const BLUE = "B85A2A";
const INK = "1C1B2E";
const HEADER_FILL = "F7DFCB";
const LINE_SPACING = 360; // 1.5 жол аралығы (240 = бір жол)

const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: BLUE };
const tableBorders = {
  top: cellBorder,
  bottom: cellBorder,
  left: cellBorder,
  right: cellBorder,
  insideHorizontal: cellBorder,
  insideVertical: cellBorder,
};
const cellMargins = { top: 100, bottom: 100, left: 150, right: 150 };

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_2) {
  return new Paragraph({ text, heading: level });
}

// Тапсырма тақырыбы: bookmark қосады (Word-тың "Өту" тақтасында көрінеді,
// сыртқы құжаттан сілтеме жасауға болады) және жаңа беттен басталады.
function taskHeading(text: string, bookmarkId: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    pageBreakBefore: true,
    children: [new Bookmark({ id: bookmarkId, children: [new TextRun(text)] })],
  });
}

function body(text: string) {
  return new Paragraph({ children: [new TextRun(text)], spacing: { after: 120, line: LINE_SPACING } });
}

function bullet(text: string) {
  return new Paragraph({ text, bullet: { level: 0 }, spacing: { after: 60, line: LINE_SPACING } });
}

function spacer() {
  return new Paragraph({ text: "", spacing: { after: 120 } });
}

function cell(
  children: Paragraph[],
  opts: { header?: boolean; widthPct?: number; align?: "top" | "center" | "bottom" } = {},
) {
  return new TableCell({
    width: opts.widthPct ? { size: opts.widthPct, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.header ? { fill: HEADER_FILL } : undefined,
    margins: cellMargins,
    verticalAlign: opts.align ?? "top",
    children,
  });
}

function table(rows: TableRow[]) {
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: tableBorders, rows });
}

function pageFooter() {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ children: [PageNumber.CURRENT] }),
          new TextRun(" / "),
          new TextRun({ children: [PageNumber.TOTAL_PAGES] }),
        ],
      }),
    ],
  });
}

async function buildAndDownload(children: (Paragraph | Table)[], fileName: string) {
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Times New Roman", size: 24 },
        },
        heading1: {
          run: { font: "Times New Roman", size: 32, bold: true, color: INK },
          paragraph: { spacing: { before: 120, after: 160 }, alignment: AlignmentType.CENTER },
        },
        heading2: {
          run: { font: "Times New Roman", size: 27, bold: true, color: BLUE },
          paragraph: { spacing: { before: 260, after: 120 } },
        },
        heading3: {
          run: { font: "Times New Roman", size: 24, bold: true, color: BLUE },
          paragraph: { spacing: { before: 180, after: 80 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: convertMillimetersToTwip(210), height: convertMillimetersToTwip(297) },
            margin: {
              // Барлық шеті 1 см — кестелер парақтың енін толық алады.
              top: convertMillimetersToTwip(10),
              bottom: convertMillimetersToTwip(10),
              left: convertMillimetersToTwip(10),
              right: convertMillimetersToTwip(10),
            },
          },
        },
        footers: { default: pageFooter() },
        children,
      },
    ],
  });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, fileName);
}

function infoCell(children: Paragraph[], opts: { header?: boolean; widthPct?: number } = {}) {
  return cell(children, opts);
}

function labelRow(label: string, valueChildren: Paragraph[]) {
  return new TableRow({
    children: [
      infoCell([new Paragraph({ children: [new TextRun({ text: label, bold: true })] })], { header: true, widthPct: 32 }),
      infoCell(valueChildren, { widthPct: 68 }),
    ],
  });
}

function tableCellText(text: string) {
  return cell([new Paragraph({ children: [new TextRun(text || "—")], spacing: { line: LINE_SPACING } })]);
}

// Бірнеше жолға ортақ критерий ұяшығы: бос текст қайталанбай, шын мәнінде
// вертикалды біріктіріледі (Word-та "empty" емес — нағыз бір ұяшық болып көрінеді).
function mergedFirstCell(text: string) {
  return new TableCell({
    margins: cellMargins,
    verticalMerge: VerticalMergeType.RESTART,
    children: [new Paragraph({ children: [new TextRun(text)], spacing: { line: LINE_SPACING } })],
  });
}

function mergedContinueCell() {
  return new TableCell({ margins: cellMargins, verticalMerge: VerticalMergeType.CONTINUE, children: [new Paragraph("")] });
}

function headerCell(text: string, widthPct?: number) {
  return cell([new Paragraph({ children: [new TextRun({ text, bold: true, color: INK })] })], {
    header: true,
    widthPct,
    align: "center",
  });
}

export async function exportQmzhToDocx(plan: LessonPlan) {
  if (isTemplatePlan(plan)) return exportTemplateQmzh(plan);
  const L = qmzhLabels(plan.lang);
  const infoTable = table([
    labelRow(L.section, [body(plan.section)]),
    labelRow(L.teacher, [body(plan.teacherName)]),
    labelRow(L.date, [body(plan.date)]),
    labelRow(L.grade(plan.gradeNumber), [body(L.attendance)]),
    labelRow(L.topic, [body(plan.topic)]),
    labelRow(L.objectives, [body(`${plan.objectiveCode} — ${plan.objectiveText}`)]),
    labelRow(L.goals, plan.goals.map((g) => bullet(g))),
    labelRow(L.values, [body(plan.valuesText)]),
  ]);

  const flowRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        headerCell(L.stageTime, 15),
        headerCell(L.teacherAction, 28),
        headerCell(L.studentAction, 25),
        headerCell(L.assessment, 20),
        headerCell(L.resources, 12),
      ],
    }),
  ];
  plan.stages.forEach((stage) => {
    stage.rows.forEach((row) => {
      flowRows.push(
        new TableRow({
          children: [
            cell([body(stage.name), body(stage.timeRange)]),
            cell(row.teacherAction.map((t, i) => (i === 0 ? body(t) : bullet(t)))),
            cell(row.studentAction.map((t, i) => (i === 0 ? body(t) : bullet(t)))),
            cell([body(row.assessmentType), body(row.assessmentDetail)]),
            tableCellText(row.resources),
          ],
        }),
      );
    });
  });
  const flowTable = table(flowRows);

  const children: (Paragraph | Table)[] = [
    new Paragraph({ text: `${L.docTitle} — ${subjectIn(plan.subject, plan.lang)}`, heading: HeadingLevel.HEADING_1 }),
    infoTable,
    spacer(),
    ...(plan.vocabulary?.length
      ? [
          heading(L.vocabulary, HeadingLevel.HEADING_2),
          table([
            new TableRow({ tableHeader: true, children: [headerCell(L.term, 30), headerCell(L.definition, 70)] }),
            ...plan.vocabulary.map((v) => new TableRow({ children: [tableCellText(v.term), tableCellText(v.definition)] })),
          ]),
          spacer(),
        ]
      : []),
    heading(L.flow, HeadingLevel.HEADING_2),
    flowTable,
    spacer(),
  ];

  plan.tasks.forEach((task, taskIndex) => {
    children.push(taskHeading(L.taskRe.test(task.title) ? task.title : `${L.taskN(taskIndex + 1)}. ${task.title}`, `task-T${taskIndex + 1}`));
    const meta = [
      task.kind,
      task.method && `${L.method}: ${task.method}`,
      task.level && `${L.levelLabel}: ${task.level}`,
      task.time && `${L.time}: ${task.time}`,
    ].filter(Boolean);
    if (meta.length) children.push(new Paragraph({ children: [new TextRun({ text: meta.join(" · "), italics: true, color: BLUE })] }));
    children.push(heading(L.condition, HeadingLevel.HEADING_3));
    task.condition.forEach((c) => children.push(body(c)));

    const width = task.tableHeaders.length;
    const fit = (row: string[]) => Array.from({ length: width }, (_, i) => row[i] ?? "");
    if (width && task.tableRows.length) {
      if (task.tableTitle) children.push(new Paragraph({ children: [new TextRun({ text: task.tableTitle, bold: true })] }));
      children.push(
        table([
          new TableRow({ tableHeader: true, children: task.tableHeaders.map((h) => headerCell(h)) }),
          ...task.tableRows.map((row) => new TableRow({ children: fit(row).map((cellText) => tableCellText(cellText)) })),
        ]),
      );
      children.push(spacer());
    }

    children.push(heading(L.steps, HeadingLevel.HEADING_3));
    task.steps.forEach((st, i) => children.push(body(`${i + 1}. ${st}`)));

    children.push(heading(L.criteriaTitle, HeadingLevel.HEADING_3));
    const criteriaRows: TableRow[] = [
      new TableRow({
        tableHeader: true,
        children: [headerCell(L.criterion, 35), headerCell(L.descriptors, 55), headerCell(L.points, 10)],
      }),
    ];
    task.criteria.forEach((c) => {
      c.descriptors.forEach((d, di) => {
        criteriaRows.push(
          new TableRow({
            children: [
              di === 0 ? mergedFirstCell(c.criterion) : mergedContinueCell(),
              tableCellText(d),
              tableCellText(""),
            ],
          }),
        );
      });
    });
    children.push(table(criteriaRows));
    children.push(spacer());

    children.push(heading(L.differentiation, HeadingLevel.HEADING_3));
    children.push(body(task.differentiation));

    children.push(heading(L.expected, HeadingLevel.HEADING_3));
    if (width && task.expectedResultRows.length) {
      children.push(
        table([
          new TableRow({ tableHeader: true, children: task.tableHeaders.map((h) => headerCell(h)) }),
          ...task.expectedResultRows.map((row) => new TableRow({ children: fit(row).map((cellText) => tableCellText(cellText)) })),
        ]),
      );
      children.push(spacer());
    }
    children.push(body(task.expectedConclusion));
  });

  if (plan.planning) {
    children.push(spacer());
    children.push(
      table([
        new TableRow({
          tableHeader: true,
          children: [
            headerCell(L.planDiff, 34),
            headerCell(L.planAssess, 33),
            headerCell(L.planSafety, 33),
          ],
        }),
        new TableRow({
          children: [tableCellText(plan.planning.differentiation), tableCellText(plan.planning.assessment), tableCellText(plan.planning.safety)],
        }),
      ]),
    );
  }

  if (plan.reflection?.length) {
    children.push(heading(L.reflection, HeadingLevel.HEADING_2));
    plan.reflection.forEach((r) => children.push(bullet(r)));
  }
  if (plan.homework) {
    children.push(heading(L.homework, HeadingLevel.HEADING_2));
    children.push(body(plan.homework));
  }

  if (plan.resources?.length) {
    children.push(heading(L.resourcesTitle, HeadingLevel.HEADING_2));
    children.push(
      table([
        new TableRow({
          tableHeader: true,
          children: [headerCell("№", 6), headerCell(L.resourceLink, 44), headerCell(L.platform, 20), headerCell(L.usage, 30)],
        }),
        ...plan.resources.map(
          (r, i) =>
            new TableRow({
              children: [
                tableCellText(String(i + 1)),
                cell([
                  new Paragraph({
                    children: [
                      /^https?:\/\//i.test(r.url)
                        ? new ExternalHyperlink({ link: r.url, children: [new TextRun({ text: r.title, style: "Hyperlink", color: "0563C1", underline: {} })] })
                        : new TextRun(r.title),
                    ],
                  }),
                ]),
                tableCellText(`${platformLabel(r.platform)} — ${platformKind(r.platform)}`),
                tableCellText(r.note),
              ],
            }),
        ),
      ]),
    );
  }

  await buildAndDownload(children, `${L.file}-${plan.topic}.docx`);
}

/* ------------------------------------------------------------------ ҚМЖ ресми үлгісі (2-нұсқа)
 * Мұғалім берген Word үлгісінің пішімі дәл қайталанады: A4 кітаптық, шеттері 1,27 см (720 twip),
 * Times New Roman 11 pt, жол аралығы 1,0, кесте ені 10466 twip, бағандар ені үлгідегідей,
 * тақырып жолдары #D9E2F3, кезең ұяшықтары #F2F2F2, қара жіңішке шекаралар.
 */
const TPL_FONT = "Times New Roman";
const TPL_SIZE = 22;
const TPL_WIDTH = 10466;
const TPL_BULLET = "qmzh-bullet";
const tplBorder = { style: BorderStyle.SINGLE, size: 4, color: "auto" };
const tplBorders = { top: tplBorder, bottom: tplBorder, left: tplBorder, right: tplBorder, insideHorizontal: tplBorder, insideVertical: tplBorder };
const tplMargins = { top: 30, bottom: 30, left: 80, right: 80 };

const tplRun = (text: string, o: { bold?: boolean; italics?: boolean } = {}) => new TextRun({ text, font: TPL_FONT, size: TPL_SIZE, ...o });

/** Бір жол: **қалың** бөліктер және «• » тізімі (Word-тың нағыз тізімі). */
function tplPara(line: string, o: { bold?: boolean; italics?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) {
  const parsed = parseRichLine(line);
  return new Paragraph({
    spacing: { after: 0, line: 240 },
    alignment: o.align,
    numbering: parsed.bullet ? { reference: TPL_BULLET, level: 0 } : undefined,
    children: parsed.parts.map((p) => tplRun(p.text, { bold: o.bold || p.bold || undefined, italics: o.italics })),
  });
}

const tplLines = (lines: string[]) => {
  const list = lines.map((l) => l.trim()).filter(Boolean);
  return list.length ? list.map((l) => tplPara(l)) : [tplPara("")];
};

function tplCell(children: Paragraph[], o: { width: number; span?: number; fill?: string; rowSpan?: number } ) {
  return new TableCell({
    width: { size: o.width, type: WidthType.DXA },
    columnSpan: o.span,
    rowSpan: o.rowSpan,
    margins: tplMargins,
    verticalAlign: "top",
    shading: o.fill ? { type: ShadingType.CLEAR, color: "auto", fill: o.fill } : undefined,
    children,
  });
}

function tplTable(widths: number[], rows: TableRow[]) {
  return new Table({
    width: { size: TPL_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: tplBorders,
    rows,
  });
}

const tplHeadRow = (widths: number[], titles: string[]) =>
  new TableRow({
    tableHeader: true,
    children: titles.map((t, i) => tplCell([tplPara(t, { bold: true, align: AlignmentType.CENTER })], { width: widths[i], fill: "D9E2F3" })),
  });

const tplHeading = (text: string) =>
  new Paragraph({ keepNext: true, spacing: { before: 120, after: 40 }, children: [tplRun(text, { bold: true })] });

async function qrPng(url: string): Promise<Uint8Array | null> {
  try {
    const dataUrl = await QRCode.toDataURL(url, { width: 240, margin: 1, errorCorrectionLevel: "M" });
    const bin = atob(dataUrl.split(",")[1]);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

async function exportTemplateQmzh(plan: LessonPlan) {
  const L = qmzhTplLabels(plan.lang);
  const objectives = plan.objectives?.length ? plan.objectives : [{ code: plan.objectiveCode, text: plan.objectiveText }];
  const children: (Paragraph | Table)[] = [];

  children.push(new Paragraph({ spacing: { after: 0, line: 240 }, children: [tplRun(L.approve)] }));
  children.push(new Paragraph({ spacing: { after: 0, line: 240 }, children: [tplRun(`${L.approverRole} ${plan.approver?.trim() || "____________________"}`)] }));
  children.push(new Paragraph({ spacing: { after: 0, line: 240 }, children: [tplRun("")] }));

  // 1. Жалпы мәліметтер: 2700 | 3883 | 3883 (мәні екі бағанды алады).
  const IW = [2700, 3883, 3883];
  const info = (label: string, value: Paragraph[]) =>
    new TableRow({ children: [tplCell([tplPara(label, { bold: true })], { width: IW[0] }), tplCell(value, { width: IW[1] + IW[2], span: 2 })] });
  children.push(
    tplTable(IW, [
      info(L.section, [tplPara(plan.section)]),
      info(L.teacher, [tplPara(plan.teacherName)]),
      info(L.date, [tplPara(tplDate(plan.date, plan.lang))]),
      new TableRow({
        children: [
          tplCell([new Paragraph({ spacing: { after: 0, line: 240 }, children: [tplRun(L.grade, { bold: true }), tplRun(` ${plan.gradeNumber}`)] })], { width: IW[0] }),
          tplCell([tplPara(L.present)], { width: IW[1] }),
          tplCell([tplPara(L.absent)], { width: IW[2] }),
        ],
      }),
      info(L.topic, [tplPara(plan.topic, { bold: true })]),
      info(L.objectives, tplLines(objectives.map((o) => (o.code ? `${o.code} - ${o.text}` : o.text)))),
      info(L.goals, tplLines(plan.goals)),
      info(L.values, [
        new Paragraph({ spacing: { after: 0, line: 240 }, children: [tplRun(L.valuesProgram), tplRun(plan.valuesTitle, { bold: true }), tplRun(".")] }),
        ...(plan.valuesQuote ? [tplPara(plan.valuesQuote, { italics: true })] : []),
        tplPara(plan.valuesText),
      ]),
    ]),
  );

  // 2. Сабақтың барысы: 1250 | 3900 | 2200 | 1900 | 1216.
  const FW = [1250, 3900, 2200, 1900, 1216];
  children.push(tplHeading(L.flow));
  const flow: TableRow[] = [tplHeadRow(FW, [L.stageTime, L.teacherAction, L.studentAction, L.assessment, L.resources])];
  for (const stage of plan.stages) {
    stage.rows.forEach((row, ri) => {
      const stageCell = tplCell(
        [
          tplPara(stage.name, { bold: true }),
          tplPara(stage.timeRange, { bold: true }),
          ...(stage.purpose ? [tplPara(stage.purpose, { italics: true })] : []),
        ],
        { width: FW[0], fill: "F2F2F2", rowSpan: stage.rows.length > 1 ? stage.rows.length : undefined },
      );
      const assessment = row.assessment ?? [row.assessmentType && `**${row.assessmentType}**`, row.assessmentDetail].filter(Boolean);
      flow.push(
        new TableRow({
          cantSplit: false,
          children: [
            ...(ri === 0 ? [stageCell] : []),
            tplCell(tplLines(row.teacherAction), { width: FW[1] }),
            tplCell(tplLines(row.studentAction), { width: FW[2] }),
            tplCell(tplLines(assessment), { width: FW[3] }),
            tplCell(tplLines(splitLines(row.resources)), { width: FW[4] }),
          ],
        }),
      );
    });
  }
  children.push(tplTable(FW, flow));

  // 3. Саралау, ЕББҚ қолдау, бағалау және қауіпсіздік: 2718 | 2990 | 2378 | 2380.
  if (plan.planning) {
    const PW = [2718, 2990, 2378, 2380];
    const pl = plan.planning;
    children.push(tplHeading(L.planningTitle));
    children.push(
      tplTable(PW, [
        tplHeadRow(PW, [L.planDiff, L.planSupport, L.planAssess, L.planSafety]),
        new TableRow({
          children: [pl.differentiation, pl.support ?? "", pl.assessment, pl.safety].map((v, i) => tplCell(tplLines(splitLines(v)), { width: PW[i] })),
        }),
      ]),
    );
  }

  // 4. Деңгейлік тапсырмалардың жауап кілті: 815 | 9651.
  if (plan.answerKey?.length) {
    const KW = [815, 9651];
    children.push(tplHeading(L.keyTitle));
    children.push(
      tplTable(KW, [
        tplHeadRow(KW, [L.keyLevel, L.keyAnswer]),
        ...plan.answerKey.map(
          (k) =>
            new TableRow({
              children: [tplCell([tplPara(L.levels[k.level] ?? k.level, { bold: true })], { width: KW[0] }), tplCell(tplLines(splitLines(k.answer)), { width: KW[1] })],
            }),
        ),
      ]),
    );
  }

  // 5. Сандық ресурстар (QR-кодтар): 3 тең баған, әр ұяшықта атауы, сілтемесі және QR-код.
  const resources = plan.resources ?? [];
  if (resources.length) {
    const RW = [3488, 3488, 3490];
    children.push(tplHeading(L.qrTitle));
    const images = await Promise.all(resources.map((r) => qrPng(r.url)));
    const rows: TableRow[] = [];
    for (let i = 0; i < resources.length; i += 3) {
      rows.push(
        new TableRow({
          children: RW.map((w, col) => {
            const r = resources[i + col];
            if (!r) return tplCell([tplPara("")], { width: w });
            const img = images[i + col];
            const custom = r.platform === "custom";
            const name = custom ? r.title : platformLabel(r.platform);
            return tplCell(
              [
                new Paragraph({ spacing: { after: 0, line: 240 }, children: [tplRun(name, { bold: true }), ...(custom ? [] : [tplRun(` – ${r.title}`)])] }),
                new Paragraph({
                  spacing: { after: 0, line: 240 },
                  children: [
                    /^https?:\/\//i.test(r.url)
                      ? new ExternalHyperlink({ link: r.url, children: [new TextRun({ text: r.url, font: TPL_FONT, size: TPL_SIZE, color: "0563C1", underline: {} })] })
                      : tplRun(r.url),
                  ],
                }),
                ...(img
                  ? [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 0, line: 240 },
                        children: [new ImageRun({ type: "png", data: img, transformation: { width: 56, height: 56 }, altText: { name: "QR", description: r.url, title: name } })],
                      }),
                    ]
                  : []),
              ],
              { width: w },
            );
          }),
        }),
      );
    }
    children.push(tplTable(RW, rows));
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: TPL_FONT, size: TPL_SIZE }, paragraph: { spacing: { after: 0, line: 240 } } } } },
    numbering: {
      config: [
        {
          reference: TPL_BULLET,
          levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 284, hanging: 227 } } } }],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT },
            margin: { top: 720, right: 720, bottom: 720, left: 720, header: 708, footer: 708 },
          },
        },
        children,
      },
    ],
  });
  downloadBlob(await Packer.toBlob(doc), `${L.file}-${plan.topic}.docx`);
}

async function exportWrittenTasksToDocx(test: SavedTest) {
  const L = testLabels(test.lang);
  const subject = subjectIn(test.subject, test.lang);
  const grade = gradeIn(test.grade, test.lang);
  const tasks = test.tasks ?? [];
  const total = tasks.reduce((s, t) => s + t.points, 0);
  const children: (Paragraph | Table)[] = [
    new Paragraph({ text: `${L.types[test.taskType ?? "bzb"]}: ${test.topic}`, heading: HeadingLevel.HEADING_1 }),
    body(`${subject} · ${grade} · ${L.tasks(tasks.length)} · ${L.total}: ${total}`),
    ...(test.objective ? [body(`${L.objective}: ${test.objective}`)] : []),
    body(L.studentLine),
    ...tasks.flatMap((t, i) => [
      new Paragraph({
        children: [new TextRun({ text: L.taskHead(i + 1, t.title, t.level, t.points), bold: true, color: INK })],
        spacing: { before: 200, after: 80 },
      }),
      ...t.text.split("\n").filter(Boolean).map((line) => body(line)),
      body("______________________________________________________________________________"),
    ]),
    new Paragraph({ text: L.criteriaTitle, heading: HeadingLevel.HEADING_2, pageBreakBefore: true }),
    table([
      new TableRow({
        tableHeader: true,
        children: [
          cell([new Paragraph({ children: [new TextRun({ text: "№", bold: true })] })], { header: true, widthPct: 6 }),
          cell([new Paragraph({ children: [new TextRun({ text: L.criterion, bold: true })] })], { header: true, widthPct: 30 }),
          cell([new Paragraph({ children: [new TextRun({ text: L.descriptor, bold: true })] })], { header: true, widthPct: 52 }),
          cell([new Paragraph({ children: [new TextRun({ text: L.points, bold: true })] })], { header: true, widthPct: 12 }),
        ],
      }),
      ...tasks.map(
        (t, i) =>
          new TableRow({
            children: [
              cell([new Paragraph(String(i + 1))]),
              cell([new Paragraph(t.criterion || t.title)]),
              cell(t.descriptors.length ? t.descriptors.map((d) => new Paragraph({ text: d, bullet: { level: 0 } })) : [new Paragraph("")]),
              cell([new Paragraph(String(t.points))]),
            ],
          }),
      ),
      new TableRow({
        children: [
          cell([new Paragraph("")]),
          cell([new Paragraph({ children: [new TextRun({ text: L.total, bold: true })] })]),
          cell([new Paragraph("")]),
          cell([new Paragraph({ children: [new TextRun({ text: String(total), bold: true })] })]),
        ],
      }),
    ]),
    new Paragraph({ text: L.answers, heading: HeadingLevel.HEADING_2 }),
    ...tasks.map((t, i) => body(`${i + 1}. ${t.answer}`)),
  ];
  const safe = test.topic.replace(/[\\/:*?"<>|]+/g, " ").trim() || "AI Nur";
  await buildAndDownload(children, `Tapsyrmalar - ${safe}.docx`);
}

export async function exportTestToDocx(test: SavedTest) {
  if (test.tasks?.length) return exportWrittenTasksToDocx(test);
  const L = testLabels(test.lang);
  const letter = (i: number) => String.fromCharCode(65 + i);
  const children: Paragraph[] = [
    new Paragraph({ text: `${L.types[test.taskType ?? "levels"]}: ${test.topic}`, heading: HeadingLevel.HEADING_1 }),
    body(`${subjectIn(test.subject, test.lang)} · ${gradeIn(test.grade, test.lang)} · ${L.difficulty}: ${difficultyIn(test.difficulty, test.lang)} · ${L.questions(test.questions.length)}`),
    ...(test.objective ? [body(`${L.objective}: ${test.objective}`)] : []),
    ...(test.questions.some((q) => q.level) ? [body(L.levelsLegend)] : []),
    body(L.studentLine),
    ...test.questions.flatMap((q, i) => [
      ...(q.context && q.context !== test.questions[i - 1]?.context
        ? [
            new Paragraph({ children: [new TextRun({ text: L.context, bold: true, color: BLUE })], spacing: { before: 240, after: 60 } }),
            ...q.context.split("\n").filter(Boolean).map((line) => body(line)),
          ]
        : []),
      new Paragraph({
        children: [new TextRun({ text: `${i + 1}. ${q.question}${q.level ? ` (${q.level})` : ""}`, bold: true, color: INK })],
        spacing: { before: 160, after: 60 },
      }),
      ...q.options.map((opt, oi) => bullet(`${letter(oi)}) ${opt}`)),
    ]),
    new Paragraph({ text: L.key, heading: HeadingLevel.HEADING_2, pageBreakBefore: true }),
    ...test.questions.map((q, i) =>
      body(`${i + 1}. ${letter(q.correctIndex)}) ${q.options[q.correctIndex]}${q.explanation ? ` — ${q.explanation}` : ""}`),
    ),
  ];
  const safe = test.topic.replace(/[\\/:*?"<>|]+/g, " ").trim() || "AI Nur";
  await buildAndDownload(children, `Test - ${safe}.docx`);
}

/* ----------------------------------------------------------------- құжаттар */

// Ресми іс қағаздары үлгісі: Times New Roman 14, сол жақ өріс 3 см, оң жақ 1,5 см,
// жоғарғы/төменгі 2 см, азат жол 1,25 см, мәтін ені бойынша тураланады.
export async function exportDocumentToDocx(d: DocData) {
  const BLACK = "000000";
  const thin = { style: BorderStyle.SINGLE, size: 4, color: BLACK };
  const para = (text: string) =>
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      indent: { firstLine: convertMillimetersToTwip(12.5) },
      spacing: { after: 80, line: 276 },
      children: [new TextRun(text)],
    });
  const children: (Paragraph | Table)[] = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: d.title, bold: true, size: 30 })] }),
    ...(d.subtitle ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new TextRun({ text: d.subtitle, italics: true })] })] : []),
  ];
  for (const s of d.sections) {
    if (s.heading) children.push(new Paragraph({ spacing: { before: 200, after: 100 }, keepNext: true, children: [new TextRun({ text: s.heading, bold: true })] }));
    s.paragraphs.forEach((p) => p.split("\n").filter(Boolean).forEach((line) => children.push(para(line))));
    s.bullets.forEach((b) => children.push(new Paragraph({ text: b, bullet: { level: 0 }, spacing: { after: 40, line: 276 } })));
    if (s.table) {
      const w = Math.floor(100 / s.table.headers.length);
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: { top: thin, bottom: thin, left: thin, right: thin, insideHorizontal: thin, insideVertical: thin },
          rows: [
            new TableRow({
              tableHeader: true,
              children: s.table.headers.map(
                (h) =>
                  new TableCell({
                    width: { size: w, type: WidthType.PERCENTAGE },
                    shading: { fill: "F2F2F2" },
                    margins: cellMargins,
                    children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 24 })] })],
                  }),
              ),
            }),
            ...s.table.rows.map(
              (r) =>
                new TableRow({
                  children: r.map((c) => new TableCell({ margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: c, size: 24 })] })] })),
                }),
            ),
          ],
        }),
        spacer(),
      );
    }
  }
  if (d.signature) children.push(new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 480 }, children: [new TextRun({ text: d.signature, bold: true })] }));

  const doc = new Document({
    styles: { default: { document: { run: { font: "Times New Roman", size: 28 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: convertMillimetersToTwip(210), height: convertMillimetersToTwip(297) },
            margin: {
              top: convertMillimetersToTwip(20),
              bottom: convertMillimetersToTwip(20),
              left: convertMillimetersToTwip(30),
              right: convertMillimetersToTwip(15),
            },
          },
        },
        footers: { default: pageFooter() },
        children,
      },
    ],
  });
  const safe = d.title.replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 80) || "AI Nur";
  downloadBlob(await Packer.toBlob(doc), `${safe}.docx`);
}

/* ---------------------------------------------------------------------- КТЖ */

// Ресми КТЖ кестесі: альбомдық A4, бөлім атауы бөлімнің бірінші жолында, БЖБ/ТЖБ жолдары қалың.
export async function exportKtzhToDocx(d: KtzhData) {
  const L = ktzhLabels(d.lang);
  const widths = [5, 17, 30, 28, 7, 8, 5];
  const small = (text: string, bold = false) => new Paragraph({ children: [new TextRun({ text, bold, size: 22 })] });
  const info = (label: string, value: string) =>
    new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun(value)] });
  const rows: TableRow[] = [
    new TableRow({ tableHeader: true, children: L.cols.map((c, i) => headerCell(c, widths[i])) }),
    ...d.rows.map((r, i) => {
      const firstOfSection = i === 0 || d.rows[i - 1].section !== r.section;
      const bold = r.kind !== "lesson";
      const topic = r.kind === "lesson" ? r.topic : `${kindLabel(r.kind, d.lang)}. ${r.topic}`;
      return new TableRow({
        cantSplit: true,
        children: [
          cell([small(String(i + 1))]),
          cell([small(firstOfSection ? r.section : "", true)]),
          cell([small(topic, bold)]),
          cell([small(r.objectives)]),
          cell([small(String(r.hours || 1))]),
          cell([small(r.date)]),
          cell([small(r.note)]),
        ],
      });
    }),
  ];
  const children: (Paragraph | Table)[] = [
    new Paragraph({ text: L.title, heading: HeadingLevel.HEADING_1 }),
    info(L.subject, subjectIn(d.subject, d.lang)),
    info(L.grade, gradeIn(d.grade, d.lang)),
    info(L.period, periodIn(d.period, d.lang)),
    info(L.perWeek, String(d.hoursPerWeek)),
    info(L.total, String(ktzhTotalHours(d))),
    ...(d.teacher ? [info(L.teacher, d.teacher)] : []),
    spacer(),
    table(rows),
  ];
  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: "Times New Roman", size: 24 } },
        heading1: { run: { font: "Times New Roman", size: 30, bold: true, color: INK }, paragraph: { spacing: { after: 160 }, alignment: AlignmentType.CENTER } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: convertMillimetersToTwip(210), height: convertMillimetersToTwip(297), orientation: PageOrientation.LANDSCAPE },
            margin: { top: convertMillimetersToTwip(12), bottom: convertMillimetersToTwip(12), left: convertMillimetersToTwip(15), right: convertMillimetersToTwip(12) },
          },
        },
        footers: { default: pageFooter() },
        children,
      },
    ],
  });
  const safe = `${d.subject} ${d.grade} ${d.period}`.replace(/[\\/:*?"<>|]+/g, " ").trim();
  downloadBlob(await Packer.toBlob(doc), `${L.file} - ${safe}.docx`);
}
