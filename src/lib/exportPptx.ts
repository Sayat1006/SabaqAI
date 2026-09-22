import PptxGenJS from "pptxgenjs";
import type { SlideData } from "./projects";
import { SLIDE_THEMES } from "./studio";

const WHITE = "FFFFFF";
const FONT = "Times New Roman";

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
