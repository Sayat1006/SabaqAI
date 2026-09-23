import PptxGenJS from "pptxgenjs";
import { svgDataUrl } from "./projects";
import type { SlideData } from "./slides";
import { SLIDE_THEMES } from "./studio";

const WHITE = "FFFFFF";
const FONT = "Times New Roman";
const EXTRA = ["8C6BB1", "D4A017", "5B8DB8", "C2185B", "6D8B3A"];

/** Иллюстрацияны (SVG) PowerPoint түсінетін PNG-ге айналдырады. */
async function svgToPng(svg: string): Promise<string | null> {
  try {
    const img = new Image();
    img.src = svgDataUrl(svg);
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 900;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png").replace(/^data:/, "");
  } catch {
    return null;
  }
}

/** Презентацияны PPTX-ке айналдырады: кестелер, диаграммалар (3D баған), суреттер мен сызбалар PowerPoint-тің өз элементтерімен салынады. */
export async function exportSlidesToPptx(title: string, slides: SlideData[], style: string) {
  const t = SLIDE_THEMES[style] ?? SLIDE_THEMES.minimal;
  const c = (hex: string) => hex.replace("#", "");
  const colors = [c(t.accent), c(t.accent2), c(t.dark), ...EXTRA];
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9"; // 10 × 5.625 дюйм
  pptx.title = title;
  const S = pptx.ShapeType;
  const base = { fontFace: FONT, color: c(t.ink) };
  const bullets = (items: string[], size = 18, color = c(t.ink)) =>
    items.map((text) => ({ text, options: { bullet: { code: "25C6" }, color, fontFace: FONT, fontSize: size, paraSpaceAfter: 8 } }));

  const images = await Promise.all(slides.map((s) => (s.image_svg ? svgToPng(s.image_svg) : Promise.resolve(null))));

  slides.forEach((s, idx) => {
    const slide = pptx.addSlide();
    const notes = [s.notes, s.answer && `Жауабы: ${s.answer}`, s.layout === "quiz" && s.options?.length ? `Дұрыс жауап: ${String.fromCharCode(65 + (s.correct_index ?? 0))}. ${s.explanation ?? ""}` : ""]
      .filter(Boolean)
      .join("\n");
    if (notes) slide.addNotes(notes);

    const decorDots = () => {
      slide.addShape(S.ellipse, { x: 8.9, y: -0.5, w: 1.6, h: 1.6, fill: { color: c(t.accent), transparency: 80 }, line: { color: c(t.accent), transparency: 100 } });
      slide.addShape(S.ellipse, { x: 9.2, y: 0.55, w: 0.6, h: 0.6, fill: { color: c(t.accent2), transparency: 70 }, line: { color: c(t.accent2), transparency: 100 } });
    };
    const header = () => {
      slide.background = { color: c(t.bg) };
      decorDots();
      slide.addShape(S.roundRect, { x: 0.55, y: 0.42, w: 0.8, h: 0.08, fill: { color: c(t.accent) }, line: { color: c(t.accent) }, rectRadius: 0.04 });
      slide.addText(s.layout === "quiz" && s.question ? s.question : s.heading, { ...base, x: 0.55, y: 0.52, w: 8.6, h: 0.8, fontSize: s.layout === "quiz" ? 22 : 26, bold: true, valign: "top" });
      if (s.subheading && s.layout !== "quiz") slide.addText(s.subheading, { ...base, x: 0.55, y: 1.2, w: 8.6, h: 0.4, fontSize: 14, color: "6B6680" });
    };
    const top = s.subheading ? 1.7 : 1.45;
    const img = images[idx];

    switch (s.layout) {
      case "title":
      case "closing": {
        slide.background = { color: c(s.layout === "closing" ? t.accent2 : t.dark) };
        slide.addShape(S.ellipse, { x: 7.2, y: -1.2, w: 4, h: 4, fill: { color: c(t.accent), transparency: 60 }, line: { color: c(t.accent), transparency: 100 } });
        slide.addShape(S.ellipse, { x: -1, y: 4, w: 3, h: 3, fill: { color: WHITE, transparency: 85 }, line: { color: WHITE, transparency: 100 } });
        const textW = img && s.layout === "title" ? 5 : 8.8;
        slide.addText(s.heading, { ...base, x: 0.6, y: 1.5, w: textW, h: 1.6, fontSize: 36, bold: true, color: WHITE, align: img ? "left" : "center", valign: "bottom" });
        if (s.subheading) slide.addText(s.subheading, { ...base, x: 0.6, y: 3.15, w: textW, h: 0.7, fontSize: 18, color: WHITE, align: img ? "left" : "center", valign: "top" });
        if (s.bullets.length) slide.addText(bullets(s.bullets, 16, WHITE), { x: 0.6, y: 3.8, w: textW, h: 1.4, valign: "top" });
        if (img && s.layout === "title") slide.addImage({ data: img, x: 5.8, y: 1.0, w: 3.8, h: 2.85, rounding: false });
        break;
      }
      case "image": {
        header();
        slide.addText(bullets(s.bullets), { x: 0.55, y: top, w: 4.4, h: 3.6, valign: "top" });
        if (img) slide.addImage({ data: img, x: 5.2, y: top - 0.1, w: 4.3, h: 3.2 });
        break;
      }
      case "diagram": {
        header();
        const nodes = s.diagram_nodes ?? [];
        if (s.diagram_type === "hierarchy") {
          const [root, ...kids] = nodes;
          slide.addText(root, { ...base, shape: S.roundRect, x: 3.4, y: top, w: 3.2, h: 0.8, fill: { color: c(t.dark) }, color: WHITE, fontSize: 18, bold: true, align: "center", rectRadius: 0.15 });
          const w = 9 / kids.length;
          kids.forEach((k, i) => {
            const x = 0.5 + i * w;
            slide.addShape(S.line, { x: Math.min(5, x + w / 2), y: top + 0.8, w: Math.abs(x + w / 2 - 5), h: 0.9, line: { color: "9C98B3", width: 1.5 }, flipH: x + w / 2 < 5 });
            slide.addText(k, { ...base, shape: S.roundRect, x: x + 0.08, y: top + 1.7, w: w - 0.16, h: 1.1, fill: { color: colors[i % colors.length] }, color: WHITE, fontSize: 15, bold: true, align: "center", rectRadius: 0.15 });
          });
        } else if (s.diagram_type === "cycle") {
          const cx = 5, cy = top + 1.75, r = 1.55, n = nodes.length;
          slide.addShape(S.ellipse, { x: cx - r, y: cy - r, w: r * 2, h: r * 2, fill: { color: WHITE, transparency: 100 }, line: { color: "D6CEBF", width: 8 } });
          nodes.forEach((node, i) => {
            const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
            slide.addText(node, { ...base, shape: S.ellipse, x: cx + r * Math.cos(a) * 1.35 - 0.85, y: cy + r * Math.sin(a) - 0.45, w: 1.7, h: 0.9, fill: { color: colors[i % colors.length] }, color: WHITE, fontSize: 13, bold: true, align: "center" });
          });
        } else {
          const n = nodes.length, gap = 0.3, w = (9 - gap * (n - 1)) / n;
          nodes.forEach((node, i) => {
            const x = 0.5 + i * (w + gap);
            slide.addText(`${i + 1}\n${node}`, { ...base, shape: S.roundRect, x, y: top + 0.6, w, h: 1.9, fill: { color: colors[i % colors.length] }, color: WHITE, fontSize: n > 4 ? 13 : 16, bold: true, align: "center", rectRadius: 0.15 });
            if (i < n - 1) slide.addShape(S.rightArrow, { x: x + w - 0.02, y: top + 1.4, w: gap + 0.04, h: 0.3, fill: { color: c(t.ink) }, line: { color: c(t.ink) } });
          });
        }
        break;
      }
      case "chart": {
        header();
        const data = [{ name: s.chart_unit || s.heading, labels: s.chart_labels ?? [], values: s.chart_values ?? [] }];
        if (s.chart_type === "pie") {
          slide.addChart(pptx.ChartType.doughnut, data, { x: 1, y: top, w: 8, h: 3.7, holeSize: 50, chartColors: colors, showLegend: true, legendPos: "r", legendFontFace: FONT, legendFontSize: 14, showValue: true, dataLabelColor: WHITE, dataLabelFontSize: 12 });
        } else {
          slide.addChart(pptx.ChartType.bar3d, data, { x: 0.8, y: top, w: 8.4, h: 3.7, barDir: "col", chartColors: colors, showValue: true, dataLabelFontSize: 12, catAxisLabelFontFace: FONT, catAxisLabelFontSize: 13, valAxisLabelFontSize: 11, valGridLine: { color: "E9E2D4", size: 0.5 } });
        }
        break;
      }
      case "table": {
        header();
        const headers = s.table_headers ?? [];
        const rows = [
          headers.map((h, i) => ({ text: h, options: { bold: true, color: WHITE, fill: { color: i === 0 ? c(t.accent) : c(t.dark) } } })),
          ...(s.table_rows ?? []).map((r, ri) => headers.map((_, ci) => ({ text: r.cells[ci] ?? "", options: { bold: ci === 0, fill: { color: ri % 2 ? "F7F2EA" : WHITE } } }))),
        ];
        slide.addTable(rows, { x: 0.55, y: top, w: 8.9, fontFace: FONT, fontSize: 14, color: c(t.ink), border: { type: "solid", pt: 0.5, color: "E9E2D4" }, valign: "middle", margin: 0.08 });
        break;
      }
      case "two_column": {
        header();
        ([[s.left_title, s.left, 0.55, t.accent], [s.right_title, s.right, 5.1, t.accent2]] as const).forEach(([ttl, items, x, col]) => {
          slide.addShape(S.roundRect, { x, y: top, w: 4.35, h: 3.6, fill: { color: WHITE }, line: { color: c(col), width: 2 }, rectRadius: 0.15 });
          slide.addText(ttl, { ...base, x: x + 0.2, y: top + 0.15, w: 4, h: 0.5, fontSize: 18, bold: true, color: c(col) });
          slide.addText(bullets([...items], 16), { x: x + 0.2, y: top + 0.7, w: 4, h: 2.8, valign: "top" });
        });
        break;
      }
      case "highlight": {
        header();
        slide.addShape(S.roundRect, { x: 1.15, y: top + 0.2, w: 8, h: 2.3, fill: { color: c(t.accent), transparency: 70 }, line: { color: c(t.accent), transparency: 100 }, rectRadius: 0.2 });
        slide.addText(s.highlight, { ...base, shape: S.roundRect, x: 1.0, y: top + 0.05, w: 8, h: 2.3, fill: { color: WHITE }, line: { color: c(t.accent), width: 2 }, fontSize: 24, bold: true, align: "center", valign: "middle", rectRadius: 0.2 });
        if (s.bullets.length) slide.addText(bullets(s.bullets, 16), { x: 0.9, y: top + 2.5, w: 8.2, h: 1.1, valign: "top" });
        break;
      }
      case "timeline": {
        header();
        const items = s.timeline ?? [];
        const w = 9 / items.length;
        slide.addShape(S.line, { x: 0.6, y: top + 1.6, w: 8.8, h: 0, line: { color: c(t.accent), width: 4 } });
        items.forEach((e, i) => {
          const x = 0.5 + i * w;
          slide.addText(e.label, { ...base, x, y: top + 0.6, w, h: 0.8, fontSize: 18, bold: true, align: "center", valign: "bottom" });
          slide.addShape(S.ellipse, { x: x + w / 2 - 0.16, y: top + 1.44, w: 0.32, h: 0.32, fill: { color: colors[i % colors.length] }, line: { color: WHITE, width: 2 } });
          slide.addText(e.text, { ...base, x: x + 0.05, y: top + 1.9, w: w - 0.1, h: 1.6, fontSize: 13, align: "center", valign: "top" });
        });
        break;
      }
      case "quiz": {
        header();
        if (!s.question) {
          slide.addText(s.bullets.map((q, i) => ({ text: `${i + 1}. ${q}`, options: { fontFace: FONT, fontSize: 18, color: c(t.ink), breakLine: true, paraSpaceAfter: 10 } })), { x: 0.55, y: top, w: 8.9, h: 3.6, valign: "top" });
          break;
        }
        (s.options ?? []).forEach((o, i) => {
          const x = 0.55 + (i % 2) * 4.5, y = top + 0.1 + Math.floor(i / 2) * 1.25;
          slide.addText(`${String.fromCharCode(65 + i)})  ${o}`, { ...base, shape: S.roundRect, x, y, w: 4.3, h: 1.05, fill: { color: WHITE }, line: { color: c(t.accent2), width: 1.5 }, fontSize: 16, valign: "middle", margin: 0.15, rectRadius: 0.15 });
        });
        break;
      }
      case "task": {
        header();
        slide.addText("ТАПСЫРМА", { ...base, shape: S.roundRect, x: 7.9, y: 0.5, w: 1.6, h: 0.4, fill: { color: c(t.accent) }, color: WHITE, fontSize: 11, bold: true, align: "center", rectRadius: 0.2 });
        if (s.task_text) slide.addText(s.task_text, { ...base, shape: S.roundRect, x: 0.55, y: top, w: 4.4, h: 3.5, fill: { color: WHITE }, line: { color: c(t.accent), width: 2 }, fontSize: 16, valign: "top", margin: 0.2, rectRadius: 0.15 });
        if (s.bullets.length)
          slide.addText(s.bullets.map((b, i) => ({ text: `${i + 1}. ${b}`, options: { fontFace: FONT, fontSize: 15, color: c(t.ink), breakLine: true, paraSpaceAfter: 8 } })), { x: s.task_text ? 5.2 : 0.55, y: top, w: s.task_text ? 4.3 : 8.9, h: 3.5, valign: "top" });
        break;
      }
      default: {
        header();
        slide.addText(bullets(s.bullets, 20), { x: 0.55, y: top, w: 8.9, h: 3.6, valign: "top" });
      }
    }
    slide.addText(`${idx + 1} / ${slides.length}`, { x: 8.6, y: 5.2, w: 1.2, h: 0.3, fontFace: FONT, fontSize: 10, color: s.layout === "title" || s.layout === "closing" ? WHITE : "9C98B3", align: "right" });
  });

  const safe = title.replace(/[\\/:*?"<>|]+/g, " ").trim() || "Sabaq";
  await pptx.writeFile({ fileName: `${safe}.pptx` });
}
