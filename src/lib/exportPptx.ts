import PptxGenJS from "pptxgenjs";
import type { LessonPlan, PresentationSlide, Quiz } from "./generators";
import type { SlideData } from "./projects";
import { SLIDE_THEMES } from "./studio";

const WINE = "B85A2A";
const GOLD = "2F7D74";
const DARK = "1C1B2E";
const WHITE = "FFFFFF";
const FONT = "Times New Roman";

export async function exportDodaToPptx(quiz: Quiz, teamAName: string, teamBName: string) {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "SAI_16x9", width: 10, height: 5.63 });
  pptx.layout = "SAI_16x9";

  const title = pptx.addSlide();
  title.background = { color: WINE };
  title.addText("Дода", { x: 0.5, y: 0.7, w: 9, h: 1, fontSize: 44, bold: true, color: WHITE });
  title.addText(quiz.topic, { x: 0.5, y: 1.8, w: 9, h: 0.7, fontSize: 26, color: WHITE });
  title.addText(`Деңгей: ${quiz.difficulty}  ·  ${quiz.questions.length} сұрақ  ·  ${teamAName} vs ${teamBName}`, {
    x: 0.5,
    y: 2.6,
    w: 9,
    h: 0.6,
    fontSize: 16,
    color: "FBF7F0",
  });
  title.addText("Sabaq AI платформасы арқылы құрылды", {
    x: 0.5,
    y: 4.9,
    w: 9,
    h: 0.4,
    fontSize: 12,
    color: "F7DFCB",
  });

  quiz.questions.forEach((q, i) => {
    const questionText = q.question.replace(/^\d+\.\s*/, "");

    const qSlide = pptx.addSlide();
    qSlide.background = { color: WHITE };
    qSlide.addText(`${i + 1}-сұрақ / ${quiz.questions.length}`, {
      x: 0.5,
      y: 0.3,
      w: 9,
      h: 0.5,
      fontSize: 14,
      color: WINE,
      bold: true,
    });
    qSlide.addText(questionText, {
      x: 0.5,
      y: 0.85,
      w: 9,
      h: 1.3,
      fontSize: 26,
      bold: true,
      color: DARK,
      valign: "top",
    });
    q.options.forEach((opt, oi) => {
      qSlide.addText(`${String.fromCharCode(65 + oi)}.  ${opt}`, {
        x: 0.8,
        y: 2.3 + oi * 0.65,
        w: 8.4,
        h: 0.6,
        fontSize: 19,
        color: DARK,
        valign: "middle",
      });
    });

    const aSlide = pptx.addSlide();
    aSlide.background = { color: DARK };
    aSlide.addText("Дұрыс жауап", { x: 0.5, y: 0.6, w: 9, h: 0.5, fontSize: 16, color: GOLD, bold: true });
    aSlide.addText(`${String.fromCharCode(65 + q.correctIndex)}.  ${q.options[q.correctIndex]}`, {
      x: 0.5,
      y: 1.5,
      w: 9,
      h: 1.6,
      fontSize: 30,
      bold: true,
      color: WHITE,
      valign: "top",
    });
  });

  const endSlide = pptx.addSlide();
  endSlide.background = { color: WINE };
  endSlide.addText("Дода аяқталды!", {
    x: 0.5,
    y: 2.3,
    w: 9,
    h: 1,
    fontSize: 36,
    bold: true,
    color: WHITE,
    align: "center",
  });

  await pptx.writeFile({ fileName: `Doda-${quiz.topic}.pptx` });
}

export async function exportPresentationToPptx(plan: LessonPlan, slides: PresentationSlide[]) {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "SAI_16x9", width: 10, height: 5.63 });
  pptx.layout = "SAI_16x9";

  slides.forEach((slide) => {
    const s = pptx.addSlide();
    const isTitle = slide.kind !== "content";
    s.background = { color: isTitle ? (slide.kind === "title" ? WINE : DARK) : WHITE };

    s.addText(slide.title, {
      x: 0.6,
      y: isTitle ? 0.7 : 0.4,
      w: 8.8,
      h: isTitle ? 1.2 : 1,
      fontSize: isTitle ? 36 : 28,
      bold: true,
      color: isTitle ? WHITE : DARK,
      align: isTitle ? "center" : "left",
    });

    slide.bullets.forEach((b, bi) => {
      s.addText(isTitle ? b : `•  ${b}`, {
        x: isTitle ? 0.6 : 0.8,
        y: (isTitle ? 2.1 : 1.6) + bi * 0.75,
        w: isTitle ? 8.8 : 8.4,
        h: 0.7,
        fontSize: isTitle ? 18 : 17,
        color: isTitle ? "FBF7F0" : DARK,
        align: isTitle ? "center" : "left",
        valign: "top",
      });
    });
  });

  await pptx.writeFile({ fileName: `Prezentatsiya-${plan.topic}.pptx` });
}

/** AI студиядағы тақырыптық презентацияны PPTX-ке айналдырады (слайд түстері SLIDE_THEMES-пен бірдей). */
export async function exportSlidesToPptx(title: string, slides: SlideData[], style: string) {
  const t = SLIDE_THEMES[style] ?? SLIDE_THEMES.minimal;
  const c = (hex: string) => hex.replace("#", "");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.title = title;
  const base = { fontFace: FONT, color: c(t.ink) };
  const bullets = (items: string[]) =>
    items.map((text) => ({
      text,
      options: { bullet: true, color: c(t.ink), fontFace: FONT, fontSize: 20, paraSpaceAfter: 8 },
    }));

  for (const s of slides) {
    const slide = pptx.addSlide();
    if (s.notes) slide.addNotes(s.notes);
    const dark = s.layout === "title" || s.layout === "closing";
    slide.background = { color: c(dark ? (s.layout === "closing" ? t.accent2 : t.dark) : t.bg) };
    if (dark) {
      slide.addText(s.heading, { ...base, x: 0.6, y: 1.8, w: 8.8, h: 1.2, fontSize: 38, bold: true, align: "center", color: WHITE });
      if (s.subheading) slide.addText(s.subheading, { ...base, x: 0.6, y: 3.0, w: 8.8, h: 0.6, fontSize: 18, align: "center", color: WHITE });
      continue;
    }
    slide.addShape(pptx.ShapeType.rect, { x: 0.6, y: 0.45, w: 0.9, h: 0.08, fill: { color: c(t.accent) }, line: { color: c(t.accent) } });
    slide.addText(s.heading, { ...base, x: 0.6, y: 0.6, w: 8.8, h: 0.8, fontSize: 28, bold: true });
    if (s.subheading) slide.addText(s.subheading, { ...base, x: 0.6, y: 1.3, w: 8.8, h: 0.4, fontSize: 14 });
    if (s.layout === "two_column") {
      ([[s.left_title, s.left, 0.6, t.accent], [s.right_title, s.right, 5.1, t.accent2]] as const).forEach(([ttl, items, x, col]) => {
        slide.addText(ttl, { ...base, x, y: 1.8, w: 4.3, h: 0.5, fontSize: 18, bold: true, color: c(col) });
        slide.addText(bullets([...items]), { x, y: 2.3, w: 4.3, h: 2.9, valign: "top" });
      });
    } else if (s.layout === "highlight") {
      slide.addShape(pptx.ShapeType.roundRect, { x: 1.0, y: 1.9, w: 8.0, h: 2.4, fill: { color: WHITE }, line: { color: c(t.accent), width: 2 }, rectRadius: 0.2 });
      slide.addText(s.highlight, { ...base, x: 1.2, y: 2.0, w: 7.6, h: 2.2, fontSize: 24, bold: true, align: "center", valign: "middle" });
    } else if (s.layout === "quiz") {
      slide.addText(
        s.bullets.map((q, i) => ({ text: `${i + 1}. ${q}`, options: { fontFace: FONT, fontSize: 20, color: c(t.ink), breakLine: true, paraSpaceAfter: 10 } })),
        { x: 0.6, y: 1.8, w: 8.8, h: 3.4, valign: "top" },
      );
    } else {
      slide.addText(bullets(s.bullets), { x: 0.6, y: 1.8, w: 8.8, h: 3.4, valign: "top" });
    }
  }
  const safe = title.replace(/[\\/:*?"<>|]+/g, " ").trim() || "Sabaq";
  await pptx.writeFile({ fileName: `${safe}.pptx` });
}
