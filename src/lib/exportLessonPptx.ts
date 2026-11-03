import PptxGenJS from "pptxgenjs";
import QRCode from "qrcode";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LESSON_ICONS } from "./lessonIcons";
import type { Lang } from "./lang";
import { LESSON_COLORS, lessonShapes, type IconName, type Shape } from "./lessonDeck";
import { svgDataUrl } from "./projects";
import type { SlideData } from "./slides";

// ҚМЖ үлгісіндегі презентацияны PowerPoint-қа шығару: LAYOUT_WIDE (13,33 × 7,5 дюйм = 960 × 540 pt),
// Times New Roman, үлгі тақырыбының түстері. Фигуралар экрандағы көрініспен бірдей (lessonShapes).

const FONT = "Times New Roman";
const IN = (pt: number) => pt / 72;

/** SVG-ді берілген қорапқа (пропорциясын сақтап) PNG етіп салу. */
async function svgToPng(svgUrl: string, w: number, h: number, scale = 4): Promise<string | null> {
  try {
    const img = new Image();
    img.src = svgUrl;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d")!;
    const iw = img.naturalWidth || canvas.width;
    const ih = img.naturalHeight || canvas.height;
    const k = Math.min(canvas.width / iw, canvas.height / ih);
    const dw = iw * k;
    const dh = ih * k;
    ctx.drawImage(img, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

const iconCache = new Map<IconName, Promise<string | null>>();
function iconPng(name: IconName): Promise<string | null> {
  if (!iconCache.has(name)) {
    const svg = renderToStaticMarkup(createElement(LESSON_ICONS[name], { color: "#ffffff", size: 96, strokeWidth: 2.2 }));
    iconCache.set(name, svgToPng(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, 96, 96, 2));
  }
  return iconCache.get(name)!;
}

async function drawShape(pptx: PptxGenJS, slide: PptxGenJS.Slide, s: Shape, data: SlideData) {
  const pos = { x: IN(s.x), y: IN(s.y), w: IN(s.w), h: IN(s.h) };
  switch (s.k) {
    case "rect":
    case "ellipse": {
      const rounded = s.k === "rect" && (s.r ?? 0) > 0;
      slide.addShape(s.k === "ellipse" ? pptx.ShapeType.ellipse : rounded ? pptx.ShapeType.roundRect : pptx.ShapeType.rect, {
        ...pos,
        rectRadius: rounded ? IN(s.r!) : undefined,
        fill: s.fill ? { color: LESSON_COLORS[s.fill], transparency: s.alpha === undefined ? 0 : 100 - s.alpha } : { type: "none" },
        line: s.line ? { color: LESSON_COLORS[s.line], width: s.lineW ?? 1 } : { type: "none" },
        shadow: s.shadow ? { type: "outer", blur: 8, offset: 3, angle: 90, color: "000000", opacity: 0.18 } : undefined,
      });
      return;
    }
    case "icon": {
      const png = await iconPng(s.name);
      if (png) slide.addImage({ data: png, ...pos });
      return;
    }
    case "image": {
      if (!data.image_svg) return;
      const png = await svgToPng(svgDataUrl(data.image_svg), s.w, s.h);
      if (png) slide.addImage({ data: png, ...pos });
      return;
    }
    case "qr": {
      const png = await QRCode.toDataURL(s.url, { width: 600, margin: 1, errorCorrectionLevel: "M" }).catch(() => null);
      if (png) slide.addImage({ data: png, ...pos });
      return;
    }
    case "text": {
      const runs: PptxGenJS.TextProps[] = [];
      s.paras.forEach((p, pi) => {
        p.runs.forEach((r, ri) => {
          runs.push({
            text: r.text,
            options: {
              bold: r.bold,
              italic: r.italic,
              color: r.color ? LESSON_COLORS[r.color] : undefined,
              bullet: p.bullet ? { indent: s.size } : undefined,
              paraSpaceBefore: pi > 0 && ri === 0 ? s.size * 0.25 : undefined,
              breakLine: ri === p.runs.length - 1 && pi < s.paras.length - 1,
            },
          });
        });
      });
      if (!runs.length) return;
      slide.addText(runs, {
        ...pos,
        fontFace: FONT,
        fontSize: s.size,
        color: LESSON_COLORS[s.color],
        align: s.align ?? "left",
        valign: s.anchor === "top" ? "top" : "middle",
        margin: s.inset ?? 0,
        lineSpacingMultiple: 1.0,
        fit: "none",
      });
      return;
    }
  }
}

export async function exportLessonPptx(title: string, slides: SlideData[], lang?: Lang) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = title;
  pptx.theme = { headFontFace: FONT, bodyFontFace: FONT };
  for (let i = 0; i < slides.length; i++) {
    const data = slides[i];
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    for (const shape of lessonShapes(data, i + 1, lang)) await drawShape(pptx, slide, shape, data);
    if (data.notes) slide.addNotes(data.notes);
  }
  const safe = title.replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 80) || "Presentation";
  await pptx.writeFile({ fileName: `${safe}.pptx` });
}
