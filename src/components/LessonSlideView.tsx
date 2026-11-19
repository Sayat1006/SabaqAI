import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { tr } from "../i18n";
import type { Lang } from "../lib/lang";
import { LESSON_COLORS, lessonShapes, type Shape } from "../lib/lessonDeck";
import { LESSON_ICONS } from "../lib/lessonIcons";
import { svgDataUrl } from "../lib/projects";
import type { SlideData } from "../lib/slides";

// ҚМЖ үлгісіндегі сабақ слайды. Фигуралар lessonShapes-тен (pt, 960 × 540) алынып,
// контейнер еніне қатысты (cqw) орналасады — PowerPoint файлымен бірдей көрінеді.


const u = (pt: number) => `${(pt * 100) / 960}cqw`;
const hex = (c: keyof typeof LESSON_COLORS) => `#${LESSON_COLORS[c]}`;
const withAlpha = (c: keyof typeof LESSON_COLORS, alpha?: number) =>
  alpha === undefined ? hex(c) : `color-mix(in srgb, ${hex(c)} ${alpha}%, transparent)`;

function Qr({ url }: { url: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { width: 360, margin: 1, errorCorrectionLevel: "M" })
      .then((d) => alive && setSrc(d))
      .catch(() => alive && setSrc(""));
    return () => {
      alive = false;
    };
  }, [url]);
  return src ? <img src={src} alt={tr("QR-код: {url}", { url })} style={{ width: "100%", height: "100%" }} /> : null;
}

function ShapeView({ s, slide, pending }: { s: Shape; slide: SlideData; pending: boolean }) {
  const box: React.CSSProperties = { position: "absolute", left: u(s.x), top: u(s.y), width: u(s.w), height: u(s.h) };
  switch (s.k) {
    case "rect":
    case "ellipse":
      return (
        <div
          style={{
            ...box,
            background: s.fill ? withAlpha(s.fill, s.alpha) : undefined,
            border: s.line ? `${u(s.lineW ?? 1)} solid ${hex(s.line)}` : undefined,
            borderRadius: s.k === "ellipse" ? "50%" : u(s.r ?? 0),
            boxShadow: s.shadow ? `0 ${u(4)} ${u(14)} rgba(0,0,0,.18)` : undefined,
            boxSizing: "border-box",
          }}
        />
      );
    case "icon": {
      const Icon = LESSON_ICONS[s.name];
      return (
        <div style={{ ...box, color: "#fff" }}>
          <Icon strokeWidth={2.2} style={{ width: "100%", height: "100%" }} />
        </div>
      );
    }
    case "image":
      return (
        <div style={{ ...box, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {slide.image_svg ? (
            <img src={svgDataUrl(slide.image_svg)} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
          ) : (
            <div className={pending ? "s-img-pending" : ""} style={{ width: "100%", height: "100%", borderRadius: u(6), background: pending ? undefined : withAlpha("accent1", 6) }} />
          )}
        </div>
      );
    case "qr":
      return (
        <div style={{ ...box, background: "#fff" }}>
          <Qr url={s.url} />
        </div>
      );
    case "text":
      return (
        <div
          style={{
            ...box,
            padding: u(s.inset ?? 0),
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            justifyContent: s.anchor === "top" ? "flex-start" : "center",
            textAlign: s.align ?? "left",
            fontSize: u(s.size),
            lineHeight: 1.2,
            color: hex(s.color),
            overflow: "hidden",
          }}
        >
          {s.paras.map((p, i) => (
            <p key={i} style={{ margin: 0, marginTop: i ? u(s.size * 0.25) : 0, paddingLeft: p.bullet ? u(s.size) : 0, position: "relative" }}>
              {p.bullet && <span style={{ position: "absolute", left: u(s.size * 0.25) }}>•</span>}
              {p.runs.map((r, k) => (
                <span key={k} style={{ fontWeight: r.bold ? 700 : 400, fontStyle: r.italic ? "italic" : undefined, color: r.color ? hex(r.color) : undefined }}>
                  {r.text}
                </span>
              ))}
            </p>
          ))}
        </div>
      );
  }
}

export function LessonSlideView({ slide, index = 0, lang, imagePending = false }: { slide: SlideData; index?: number; lang?: Lang; imagePending?: boolean }) {
  const shapes = lessonShapes(slide, index + 1, lang);
  return (
    <div className="slide lesson-slide" style={{ background: "#fff", color: hex("tx1") }}>
      {shapes.map((s, i) => (
        <ShapeView key={i} s={s} slide={slide} pending={imagePending} />
      ))}
    </div>
  );
}
