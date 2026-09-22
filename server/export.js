import {
  AlignmentType, BorderStyle, Document, Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} from 'docx';
import PptxGenJS from 'pptxgenjs';

const FONT = 'Times New Roman';

/* ------------------------------------------------------------ ҚМЖ → DOCX */

const run = (text, opts = {}) => new TextRun({ text: String(text ?? ''), font: FONT, size: 24, ...opts });
const para = (children, opts = {}) => new Paragraph({ children: Array.isArray(children) ? children : [children], spacing: { after: 60 }, ...opts });
const lines = (items) => (items && items.length ? items : ['']).map((t) => para(run(`• ${t}`)));
const border = { style: BorderStyle.SINGLE, size: 4, color: '999999' };
const borders = { top: border, bottom: border, left: border, right: border };

function cell(children, { width, header = false, span } = {}) {
  return new TableCell({
    children: Array.isArray(children) ? children : [children],
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    columnSpan: span,
    borders,
    shading: header ? { type: ShadingType.CLEAR, color: 'auto', fill: 'EDEBE4' } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
  });
}

export async function qmzToDocx(project) {
  const d = project.data;
  const m = project.meta || {};
  const infoRows = [
    ['Бөлім', d.section],
    ['Педагогтің аты-жөні', m.teacher],
    ['Күні', m.date],
    ['Сынып', `${m.grade}-сынып · ${m.quarter}-тоқсан`],
    ['Сабақтың тақырыбы', d.topic],
    ['Оқу бағдарламасына сәйкес оқу мақсаттары', d.learning_objectives],
    ['Сабақтың мақсаты', d.lesson_objectives],
    ['Бағалау критерийлері', d.assessment_criteria],
    ['Құндылықтарды дарыту', d.value_integration],
    ['Пәнаралық байланыс', d.cross_curricular],
    ['Алдыңғы білім', d.prior_knowledge],
  ].map(([label, value]) => new TableRow({
    children: [
      cell(para(run(label, { bold: true })), { width: 30, header: true }),
      cell(Array.isArray(value) ? lines(value) : para(run(value)), { width: 70 }),
    ],
  }));

  const flowHeader = new TableRow({
    tableHeader: true,
    children: ['Кезең / Уақыт', 'Педагогтің әрекеті', 'Оқушының әрекеті', 'Бағалау', 'Ресурстар']
      .map((h) => cell(para(run(h, { bold: true })), { header: true })),
  });
  const flowRows = d.stages.map((s) => new TableRow({
    children: [
      cell([para(run(s.name, { bold: true })), para(run(s.time))], { width: 14 }),
      cell(lines(s.teacher), { width: 30 }),
      cell(lines(s.students), { width: 26 }),
      cell(para(run(s.assessment)), { width: 16 }),
      cell(para(run(s.resources)), { width: 14 }),
    ],
  }));

  const heading = (text) => para(run(text, { bold: true, size: 26 }), { spacing: { before: 240, after: 120 } });
  const doc = new Document({
    creator: 'Sabaq AI',
    title: `ҚМЖ — ${d.topic}`,
    sections: [{
      properties: { page: { margin: { top: 850, bottom: 850, left: 1000, right: 850 } } },
      children: [
        para(run('Қысқа мерзімді жоспар', { bold: true, size: 30 }), { alignment: AlignmentType.CENTER, spacing: { after: 80 } }),
        para(run(`${m.subject} · ${m.grade}-сынып`, { size: 24 }), { alignment: AlignmentType.CENTER, spacing: { after: 240 } }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: infoRows }),
        heading('Сабақтың барысы'),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [flowHeader, ...flowRows] }),
        heading('Тапсырмалар'),
        ...d.tasks.flatMap((t) => [
          para([run(`${t.code} · ${t.level}. `, { bold: true }), run(t.title, { bold: true })]),
          para(run(t.description)),
          para(run('Дескрипторлар:', { italics: true })),
          ...lines(t.descriptors),
        ]),
        heading('Саралау'),
        para(run(d.differentiation)),
        heading('Күтілетін нәтиже'),
        para(run(d.expected_result)),
        heading('Оқыту әдістері'),
        ...d.methods.map((mm) => para([run(`${mm.name}: `, { bold: true }), run(mm.description)])),
        heading('Рефлексия'),
        para(run(d.reflection)),
        heading('Үй тапсырмасы'),
        para(run(d.homework)),
      ],
    }],
  });
  return Packer.toBuffer(doc);
}

/* -------------------------------------------------- Презентация → PPTX */

const THEMES = {
  minimal: { bg: 'FBF7F0', ink: '1C1B2E', soft: '615D7A', accent: 'E0733D', accent2: '2F7D74', titleBg: '1B2438', titleInk: 'FFFFFF' },
  colorful: { bg: 'FFF8EE', ink: '1C1B2E', soft: '5B5670', accent: 'E0733D', accent2: '6C4AB6', titleBg: 'E0733D', titleInk: 'FFFFFF' },
  science: { bg: 'F4F7FA', ink: '15202B', soft: '4A5A6A', accent: '2F7D74', accent2: '1B2438', titleBg: '1B2438', titleInk: 'FFFFFF' },
  kids: { bg: 'FFFBEA', ink: '2A2440', soft: '5E5873', accent: 'F2A33A', accent2: '2F9D8F', titleBg: '2F9D8F', titleInk: 'FFFFFF' },
};
export const presentationThemes = THEMES;

export async function presentationToPptx(project) {
  const d = project.data;
  const t = THEMES[project.meta?.style] || THEMES.minimal;
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.title = d.title;
  const base = { fontFace: FONT, color: t.ink };
  const bullets = (items, color = t.ink) => items.map((text) => ({ text, options: { bullet: true, color, fontFace: FONT, fontSize: 20, paraSpaceAfter: 8 } }));

  for (const s of d.slides) {
    const slide = pptx.addSlide();
    if (s.notes) slide.addNotes(s.notes);
    const dark = s.layout === 'title' || s.layout === 'closing';
    slide.background = { color: dark ? (s.layout === 'closing' ? t.accent2 : t.titleBg) : t.bg };
    if (dark) {
      slide.addText(s.heading, { ...base, x: 0.6, y: 1.8, w: 8.8, h: 1.2, fontSize: 38, bold: true, align: 'center', color: t.titleInk });
      if (s.subheading) slide.addText(s.subheading, { ...base, x: 0.6, y: 3.0, w: 8.8, h: 0.6, fontSize: 18, align: 'center', color: t.titleInk });
      continue;
    }
    slide.addShape(pptx.ShapeType.rect, { x: 0.6, y: 0.45, w: 0.9, h: 0.08, fill: { color: t.accent }, line: { color: t.accent } });
    slide.addText(s.heading, { ...base, x: 0.6, y: 0.6, w: 8.8, h: 0.8, fontSize: 28, bold: true });
    if (s.subheading) slide.addText(s.subheading, { ...base, x: 0.6, y: 1.3, w: 8.8, h: 0.4, fontSize: 14, color: t.soft });
    if (s.layout === 'two_column') {
      [[s.left_title, s.left, 0.6, t.accent], [s.right_title, s.right, 5.1, t.accent2]].forEach(([title, items, x, c]) => {
        slide.addText(title, { ...base, x, y: 1.8, w: 4.3, h: 0.5, fontSize: 18, bold: true, color: c });
        slide.addText(bullets(items), { x, y: 2.3, w: 4.3, h: 2.9, valign: 'top' });
      });
    } else if (s.layout === 'highlight') {
      slide.addShape(pptx.ShapeType.roundRect, { x: 1.0, y: 1.9, w: 8.0, h: 2.4, fill: { color: 'FFFFFF' }, line: { color: t.accent, width: 2 }, rectRadius: 0.2 });
      slide.addText(s.highlight, { ...base, x: 1.2, y: 2.0, w: 7.6, h: 2.2, fontSize: 24, bold: true, align: 'center', valign: 'middle' });
    } else if (s.layout === 'quiz') {
      slide.addText(s.bullets.map((q, i) => ({ text: `${i + 1}. ${q}`, options: { fontFace: FONT, fontSize: 20, color: t.ink, breakLine: true, paraSpaceAfter: 10 } })),
        { x: 0.6, y: 1.8, w: 8.8, h: 3.4, valign: 'top' });
    } else {
      slide.addText(bullets(s.bullets), { x: 0.6, y: 1.8, w: 8.8, h: 3.4, valign: 'top' });
    }
  }
  return pptx.write({ outputType: 'nodebuffer' });
}
