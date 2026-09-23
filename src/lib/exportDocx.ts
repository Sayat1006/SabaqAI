import {
  AlignmentType,
  Bookmark,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
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
} from "docx";
import { downloadBlob } from "./downloadBlob";
import type { LessonPlan } from "./generators";
import { platformKind, platformLabel } from "./resources";
import type { SavedTest } from "./projects";

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
              top: convertMillimetersToTwip(20),
              bottom: convertMillimetersToTwip(18),
              left: convertMillimetersToTwip(20),
              right: convertMillimetersToTwip(20),
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
  const infoTable = table([
    labelRow("Бөлім", [body(plan.section)]),
    labelRow("Педагогтің тегі, аты, әкесінің аты (болған жағдайда)", [body(plan.teacherName)]),
    labelRow("Күні", [body(plan.date)]),
    labelRow(`Сынып ${plan.gradeNumber}`, [body("Қатысушылар саны ______   Қатыспағандар саны ______")]),
    labelRow("Сабақтың тақырыбы", [body(plan.topic)]),
    labelRow("Оқу бағдарламасына сәйкес оқыту мақсаттары", [body(`${plan.objectiveCode} — ${plan.objectiveText}`)]),
    labelRow("Сабақтың мақсаты", plan.goals.map((g) => bullet(g))),
    ...(plan.successCriteria?.length ? [labelRow("Бағалау критерийі", plan.successCriteria.map((g) => bullet(g)))] : []),
    ...(plan.lessonType ? [labelRow("Сабақтың түрі", [body(plan.lessonType)])] : []),
    ...(plan.methods?.length ? [labelRow("Әдіс-тәсілдер", [body(plan.methods.join(", "))])] : []),
    labelRow("Құндылықтарды дарыту", [body(plan.valuesText)]),
    ...(plan.interdisciplinary ? [labelRow("Пәнаралық байланыс", [body(plan.interdisciplinary)])] : []),
    ...(plan.priorKnowledge ? [labelRow("Алдыңғы білім", [body(plan.priorKnowledge)])] : []),
  ]);

  const flowRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        headerCell("Сабақтың кезеңі / Уақыт", 15),
        headerCell("Педагогтің әрекеті", 28),
        headerCell("Оқушының әрекеті", 25),
        headerCell("Бағалау", 20),
        headerCell("Ресурстар", 12),
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
    new Paragraph({ text: `Қысқа мерзімді сабақ жоспары — ${plan.subject}`, heading: HeadingLevel.HEADING_1 }),
    infoTable,
    spacer(),
    ...(plan.vocabulary?.length
      ? [
          heading("Пәндік лексика және терминология", HeadingLevel.HEADING_2),
          table([
            new TableRow({ tableHeader: true, children: [headerCell("Термин", 30), headerCell("Анықтамасы", 70)] }),
            ...plan.vocabulary.map((v) => new TableRow({ children: [tableCellText(v.term), tableCellText(v.definition)] })),
          ]),
          spacer(),
        ]
      : []),
    heading("Сабақтың барысы", HeadingLevel.HEADING_2),
    flowTable,
    spacer(),
  ];

  plan.tasks.forEach((task, taskIndex) => {
    children.push(taskHeading(/^\d|тапсырма/i.test(task.title) ? task.title : `${taskIndex + 1}-тапсырма. ${task.title}`, `task-T${taskIndex + 1}`));
    const meta = [
      task.kind,
      task.method && `Әдіс: ${task.method}`,
      task.level && `Деңгейі: ${task.level}`,
      task.time && `Уақыты: ${task.time}`,
    ].filter(Boolean);
    if (meta.length) children.push(new Paragraph({ children: [new TextRun({ text: meta.join(" · "), italics: true, color: BLUE })] }));
    children.push(heading("Шарты", HeadingLevel.HEADING_3));
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

    children.push(heading("Орындау қадамдары", HeadingLevel.HEADING_3));
    task.steps.forEach((st, i) => children.push(body(`${i + 1}. ${st}`)));

    children.push(heading("Бағалау критерийлері мен дескрипторлары", HeadingLevel.HEADING_3));
    const criteriaRows: TableRow[] = [
      new TableRow({
        tableHeader: true,
        children: [headerCell("Бағалау критерийі", 35), headerCell("Дескрипторлар", 55), headerCell("Ұпай", 10)],
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

    children.push(heading("Саралау", HeadingLevel.HEADING_3));
    children.push(body(task.differentiation));

    children.push(heading("Күтілетін нәтиже", HeadingLevel.HEADING_3));
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
            headerCell("Саралау — оқушыларға қалай көбірек қолдау көрсетуді жоспарлайсыз?", 34),
            headerCell("Бағалау — оқушылардың материалды меңгеру деңгейін қалай тексеруді жоспарлайсыз?", 33),
            headerCell("Денсаулық және қауіпсіздік техникасының сақталуы", 33),
          ],
        }),
        new TableRow({
          children: [tableCellText(plan.planning.differentiation), tableCellText(plan.planning.assessment), tableCellText(plan.planning.safety)],
        }),
      ]),
    );
  }

  if (plan.reflection?.length) {
    children.push(heading("Рефлексия", HeadingLevel.HEADING_2));
    plan.reflection.forEach((r) => children.push(bullet(r)));
  }
  if (plan.homework) {
    children.push(heading("Үй тапсырмасы", HeadingLevel.HEADING_2));
    children.push(body(plan.homework));
  }

  if (plan.resources?.length) {
    children.push(heading("Ресурстар мен сілтемелер", HeadingLevel.HEADING_2));
    children.push(
      table([
        new TableRow({
          tableHeader: true,
          children: [headerCell("№", 6), headerCell("Ресурс (сілтеме)", 44), headerCell("Түрі / платформа", 20), headerCell("Қолданылуы", 30)],
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

  await buildAndDownload(children, `KMZH-${plan.topic}.docx`);
}

const TASK_TYPE_TITLES: Record<string, string> = {
  levels: "Деңгейлік тест",
  pisa: "Функционалдық сауаттылық тапсырмалары",
  ubt: "ҰБТ форматындағы тест",
  bzb: "Жиынтық бағалау (БЖБ/ТЖБ)",
  open: "Ашық және шығармашылық тапсырмалар",
};

async function exportWrittenTasksToDocx(test: SavedTest) {
  const tasks = test.tasks ?? [];
  const total = tasks.reduce((s, t) => s + t.points, 0);
  const children: (Paragraph | Table)[] = [
    new Paragraph({ text: `${TASK_TYPE_TITLES[test.taskType ?? "bzb"]}: ${test.topic}`, heading: HeadingLevel.HEADING_1 }),
    body(`${test.subject} · ${test.grade} · ${tasks.length} тапсырма · Жалпы балл: ${total}`),
    ...(test.objective ? [body(`Оқу мақсаты: ${test.objective}`)] : []),
    body("Білім алушының аты-жөні: ____________________________    Сынып: ______    Күні: __________"),
    ...tasks.flatMap((t, i) => [
      new Paragraph({
        children: [new TextRun({ text: `${i + 1}-тапсырма. ${t.title} (${t.level} деңгей, ${t.points} балл)`, bold: true, color: INK })],
        spacing: { before: 200, after: 80 },
      }),
      ...t.text.split("\n").filter(Boolean).map((line) => body(line)),
      body("______________________________________________________________________________"),
    ]),
    new Paragraph({ text: "Бағалау критерийлері мен дескрипторлар", heading: HeadingLevel.HEADING_2, pageBreakBefore: true }),
    table([
      new TableRow({
        tableHeader: true,
        children: [
          cell([new Paragraph({ children: [new TextRun({ text: "№", bold: true })] })], { header: true, widthPct: 6 }),
          cell([new Paragraph({ children: [new TextRun({ text: "Бағалау критерийі", bold: true })] })], { header: true, widthPct: 30 }),
          cell([new Paragraph({ children: [new TextRun({ text: "Дескриптор", bold: true })] })], { header: true, widthPct: 52 }),
          cell([new Paragraph({ children: [new TextRun({ text: "Балл", bold: true })] })], { header: true, widthPct: 12 }),
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
          cell([new Paragraph({ children: [new TextRun({ text: "Жалпы балл", bold: true })] })]),
          cell([new Paragraph("")]),
          cell([new Paragraph({ children: [new TextRun({ text: String(total), bold: true })] })]),
        ],
      }),
    ]),
    new Paragraph({ text: "Үлгі жауаптар (мұғалімге)", heading: HeadingLevel.HEADING_2 }),
    ...tasks.map((t, i) => body(`${i + 1}. ${t.answer}`)),
  ];
  const safe = test.topic.replace(/[\\/:*?"<>|]+/g, " ").trim() || "AI Nur";
  await buildAndDownload(children, `Tapsyrmalar - ${safe}.docx`);
}

export async function exportTestToDocx(test: SavedTest) {
  if (test.tasks?.length) return exportWrittenTasksToDocx(test);
  const letter = (i: number) => String.fromCharCode(65 + i);
  const children: Paragraph[] = [
    new Paragraph({ text: `${TASK_TYPE_TITLES[test.taskType ?? "levels"]}: ${test.topic}`, heading: HeadingLevel.HEADING_1 }),
    body(`${test.subject} · ${test.grade} · Қиындығы: ${test.difficulty} · ${test.questions.length} сұрақ`),
    ...(test.objective ? [body(`Оқу мақсаты: ${test.objective}`)] : []),
    ...(test.questions.some((q) => q.level) ? [body("Деңгейлер: A — білу және түсіну, B — қолдану, C — жоғары деңгей дағдылары")] : []),
    body("Оқушының аты-жөні: ____________________________    Сынып: ______    Күні: __________"),
    ...test.questions.flatMap((q, i) => [
      ...(q.context && q.context !== test.questions[i - 1]?.context
        ? [
            new Paragraph({ children: [new TextRun({ text: "Жағдаят", bold: true, color: BLUE })], spacing: { before: 240, after: 60 } }),
            ...q.context.split("\n").filter(Boolean).map((line) => body(line)),
          ]
        : []),
      new Paragraph({
        children: [new TextRun({ text: `${i + 1}. ${q.question}${q.level ? ` (${q.level})` : ""}`, bold: true, color: INK })],
        spacing: { before: 160, after: 60 },
      }),
      ...q.options.map((opt, oi) => bullet(`${letter(oi)}) ${opt}`)),
    ]),
    new Paragraph({ text: "Жауаптар кілті", heading: HeadingLevel.HEADING_2, pageBreakBefore: true }),
    ...test.questions.map((q, i) =>
      body(`${i + 1}. ${letter(q.correctIndex)}) ${q.options[q.correctIndex]}${q.explanation ? ` — ${q.explanation}` : ""}`),
    ),
  ];
  const safe = test.topic.replace(/[\\/:*?"<>|]+/g, " ").trim() || "AI Nur";
  await buildAndDownload(children, `Test - ${safe}.docx`);
}
