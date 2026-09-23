import { useState } from "react";
import { svgDataUrl } from "../lib/projects";
import type { SlideData } from "../lib/slides";
import { SLIDE_THEMES } from "../lib/studio";
import "./slides.css";

type Theme = (typeof SLIDE_THEMES)[string];

const letter = (i: number) => String.fromCharCode(65 + i);

/** SVG мәтінін жолдарға бөледі (SVG өзі мәтінді тасымалдамайды). */
function wrap(text: string, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if ((line + " " + word).trim().length > max && line) {
      lines.push(line);
      line = word;
    } else line = (line + " " + word).trim();
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function SvgLines({ x, y, lines, size, color, weight = 700 }: { x: number; y: number; lines: string[]; size: number; color: string; weight?: number }) {
  const start = y - ((lines.length - 1) * size * 1.15) / 2;
  return (
    <text x={x} textAnchor="middle" fontFamily="Times New Roman, serif" fontSize={size} fontWeight={weight} fill={color}>
      {lines.map((l, i) => (
        <tspan key={i} x={x} y={start + i * size * 1.15} dominantBaseline="middle">
          {l}
        </tspan>
      ))}
    </text>
  );
}

const palette = (t: Theme) => [t.accent, t.accent2, t.dark, "#8C6BB1", "#D4A017", "#5B8DB8", "#C2185B", "#6D8B3A"];

/* ------------------------------------------------------------------ сызбалар */

function Diagram({ type, nodes, t }: { type: SlideData["diagram_type"]; nodes: string[]; t: Theme }) {
  const colors = palette(t);
  if (type === "cycle") {
    const cx = 500, cy = 250, r = 180, n = nodes.length;
    const pts = nodes.map((_, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
    });
    return (
      <svg viewBox="0 0 1000 500" className="s-svg" role="img" aria-label={nodes.join(" → ")}>
        <defs>
          <marker id="cyc-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" fill={t.ink} opacity=".55" />
          </marker>
        </defs>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={t.ink} strokeOpacity=".12" strokeWidth="26" />
        {pts.map((p, i) => {
          const q = pts[(i + 1) % n];
          const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
          const ox = (mx - cx) * 0.35, oy = (my - cy) * 0.35;
          const shrink = (a: { x: number; y: number }, b: { x: number; y: number }) => {
            const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
            return { x: a.x + (dx / len) * 78, y: a.y + (dy / len) * 78 };
          };
          const s0 = shrink(p, { x: mx + ox, y: my + oy }), e0 = shrink(q, { x: mx + ox, y: my + oy });
          return <path key={i} d={`M${s0.x} ${s0.y} Q${mx + ox} ${my + oy} ${e0.x} ${e0.y}`} fill="none" stroke={t.ink} strokeOpacity=".55" strokeWidth="4" markerEnd="url(#cyc-arrow)" />;
        })}
        {pts.map((p, i) => (
          <g key={i}>
            <ellipse cx={p.x} cy={p.y + 8} rx="92" ry="52" fill="#000" opacity=".12" />
            <ellipse cx={p.x} cy={p.y} rx="92" ry="52" fill={colors[i % colors.length]} />
            <SvgLines x={p.x} y={p.y} lines={wrap(nodes[i], 12)} size={24} color="#fff" />
          </g>
        ))}
      </svg>
    );
  }
  if (type === "hierarchy") {
    const [root, ...kids] = nodes;
    const w = 1000 / kids.length;
    return (
      <svg viewBox="0 0 1000 460" className="s-svg" role="img" aria-label={`${root}: ${kids.join(", ")}`}>
        {kids.map((_, i) => (
          <path key={i} d={`M500 150 C500 230 ${w * i + w / 2} 210 ${w * i + w / 2} 300`} fill="none" stroke={t.ink} strokeOpacity=".35" strokeWidth="4" />
        ))}
        <rect x="330" y="46" width="340" height="104" rx="22" fill={t.dark} />
        <SvgLines x={500} y={98} lines={wrap(root, 18)} size={30} color="#fff" />
        {kids.map((k, i) => (
          <g key={i}>
            <rect x={w * i + 12} y="306" width={w - 24} height="108" rx="20" fill="#000" opacity=".1" transform="translate(0 7)" />
            <rect x={w * i + 12} y="306" width={w - 24} height="108" rx="20" fill={colors[i % colors.length]} />
            <SvgLines x={w * i + w / 2} y={360} lines={wrap(k, Math.max(8, Math.floor(w / 17)))} size={24} color="#fff" />
          </g>
        ))}
      </svg>
    );
  }
  // process
  const n = nodes.length;
  const gap = 34, w = (1000 - gap * (n - 1)) / n;
  return (
    <svg viewBox="0 0 1000 320" className="s-svg" role="img" aria-label={nodes.join(" → ")}>
      {nodes.map((node, i) => {
        const x = i * (w + gap);
        return (
          <g key={i}>
            <rect x={x} y="96" width={w} height="160" rx="22" fill="#000" opacity=".1" transform="translate(0 8)" />
            <rect x={x} y="96" width={w} height="160" rx="22" fill={colors[i % colors.length]} />
            <circle cx={x + w / 2} cy="96" r="30" fill="#fff" stroke={colors[i % colors.length]} strokeWidth="6" />
            <text x={x + w / 2} y="97" textAnchor="middle" dominantBaseline="middle" fontFamily="Times New Roman, serif" fontSize="28" fontWeight="700" fill={t.ink}>
              {i + 1}
            </text>
            <SvgLines x={x + w / 2} y={186} lines={wrap(node, Math.max(7, Math.floor(w / 15)))} size={n > 4 ? 21 : 25} color="#fff" />
            {i < n - 1 && <path d={`M${x + w + 5} 176 l${gap - 12} 0 m-10 -10 l10 10 l-10 10`} fill="none" stroke={t.ink} strokeOpacity=".55" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />}
          </g>
        );
      })}
    </svg>
  );
}

function Chart({ s, t }: { s: SlideData; t: Theme }) {
  const labels = s.chart_labels ?? [];
  const values = s.chart_values ?? [];
  const colors = palette(t);
  const unit = s.chart_unit ? ` ${s.chart_unit}` : "";
  if (s.chart_type === "pie") {
    const total = values.reduce((a, b) => a + b, 0) || 1;
    const starts = values.map((_, i) => -Math.PI / 2 + (values.slice(0, i).reduce((a, b) => a + b, 0) / total) * Math.PI * 2);
    const arcs = values.map((v, i) => {
      const a0 = starts[i], a1 = a0 + (v / total) * Math.PI * 2;
      const big = a1 - a0 > Math.PI ? 1 : 0;
      const p = (a: number, r: number) => `${250 + r * Math.cos(a)} ${250 + r * Math.sin(a)}`;
      const d = v / total >= 0.999 ? "M250 50 A200 200 0 1 1 249.9 50 L249.9 140 A110 110 0 1 0 250 140Z" : `M${p(a0, 200)} A200 200 0 ${big} 1 ${p(a1, 200)} L${p(a1, 110)} A110 110 0 ${big} 0 ${p(a0, 110)}Z`;
      return <path key={i} d={d} fill={colors[i % colors.length]} stroke="#fff" strokeWidth="4" />;
    });
    return (
      <svg viewBox="0 0 1000 500" className="s-svg" role="img" aria-label={labels.map((l, i) => `${l}: ${values[i]}${unit}`).join(", ")}>
        <ellipse cx="250" cy="468" rx="170" ry="18" fill="#000" opacity=".1" />
        {arcs}
        {labels.map((l, i) => (
          <g key={i} transform={`translate(540 ${70 + i * (360 / Math.max(labels.length, 1))})`}>
            <rect width="30" height="30" rx="8" fill={colors[i % colors.length]} />
            <text x="46" y="16" dominantBaseline="middle" fontFamily="Times New Roman, serif" fontSize="30" fill={t.ink}>
              {l} — <tspan fontWeight="700">{values[i]}{unit}</tspan>
            </text>
          </g>
        ))}
      </svg>
    );
  }
  const max = Math.max(...values, 1);
  const bw = 820 / values.length;
  return (
    <svg viewBox="0 0 1000 480" className="s-svg" role="img" aria-label={labels.map((l, i) => `${l}: ${values[i]}${unit}`).join(", ")}>
      <line x1="120" y1="400" x2="960" y2="400" stroke={t.ink} strokeOpacity=".25" strokeWidth="3" />
      {values.map((v, i) => {
        const h = (v / max) * 320;
        const x = 130 + i * bw + bw * 0.18, w = bw * 0.64;
        return (
          <g key={i}>
            <path d={`M${x} ${400 - h} l14 -12 h${w} v${h} l-14 12z`} fill={colors[i % colors.length]} opacity=".55" />
            <rect x={x} y={400 - h} width={w} height={h} rx="6" fill={colors[i % colors.length]} />
            <text x={x + w / 2} y={372 - h} textAnchor="middle" fontFamily="Times New Roman, serif" fontSize="26" fontWeight="700" fill={t.ink}>
              {v}{unit}
            </text>
            <SvgLines x={x + w / 2} y={436} lines={wrap(labels[i] ?? "", 12).slice(0, 2)} size={22} color={t.ink} weight={400} />
          </g>
        );
      })}
    </svg>
  );
}

/* ----------------------------------------------------------------- 3D безендіру */

function Decor3D({ big = false }: { big?: boolean }) {
  return (
    <div className={`s-deco ${big ? "big" : ""}`} aria-hidden>
      <div className="s-cube">
        <span className="f1" /><span className="f2" /><span className="f3" /><span className="f4" /><span className="f5" /><span className="f6" />
      </div>
      <div className="s-sphere" />
      <div className="s-ring" />
    </div>
  );
}

function Illustration({ svg, pending }: { svg?: string; pending?: boolean }) {
  if (svg) return <img src={svgDataUrl(svg)} alt="" className="s-img" />;
  if (pending) return <div className="s-img s-img-pending">Сурет салынуда...</div>;
  return <Decor3D big />;
}

/* ------------------------------------------------------------------- слайд */

export function SlideView({
  slide: s,
  style,
  index,
  total,
  interactive = false,
  imagePending = false,
}: {
  slide: SlideData;
  style: string;
  index?: number;
  total?: number;
  interactive?: boolean;
  imagePending?: boolean;
}) {
  const t = SLIDE_THEMES[style] ?? SLIDE_THEMES.minimal;
  const vars = { "--s-bg": t.bg, "--s-ink": t.ink, "--s-accent": t.accent, "--s-accent2": t.accent2, "--s-dark": t.dark } as React.CSSProperties;
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  const head = (
    <>
      <div className="s-rule" />
      <div className="s-h">{s.heading}</div>
      {s.subheading && <div className="s-sub">{s.subheading}</div>}
    </>
  );
  const list = (items: string[], cls = "") => (
    <ul className={`s-list ${cls}`}>
      {items.map((b, i) => (
        <li key={i}>{b}</li>
      ))}
    </ul>
  );

  let body: React.ReactNode;
  let cls = "";
  switch (s.layout) {
    case "title":
      cls = "dark";
      body = (
        <div className="s-hero">
          <div className="s-hero-text">
            <div className="s-kicker">Сабақ</div>
            <div className="s-title">{s.heading}</div>
            {s.subheading && <div className="s-sub">{s.subheading}</div>}
          </div>
          <div className="s-hero-art">
            <Illustration svg={s.image_svg} pending={imagePending} />
          </div>
        </div>
      );
      break;
    case "closing":
      cls = "closing";
      body = (
        <>
          <Decor3D big />
          <div className="s-center">
            <div className="s-title">{s.heading}</div>
            {s.subheading && <div className="s-sub">{s.subheading}</div>}
            {s.bullets.length > 0 && list(s.bullets, "s-light")}
          </div>
        </>
      );
      break;
    case "image":
      body = (
        <>
          {head}
          <div className="s-split">
            <div>{list(s.bullets)}</div>
            <div className="s-img-card">
              <Illustration svg={s.image_svg} pending={imagePending} />
            </div>
          </div>
        </>
      );
      break;
    case "diagram":
      body = (
        <>
          {head}
          <div className="s-figure">
            <Diagram type={s.diagram_type} nodes={s.diagram_nodes ?? []} t={t} />
          </div>
        </>
      );
      break;
    case "chart":
      body = (
        <>
          {head}
          <div className="s-figure">
            <Chart s={s} t={t} />
          </div>
        </>
      );
      break;
    case "table":
      body = (
        <>
          {head}
          <div className="s-table-wrap">
            <table className="s-table">
              <thead>
                <tr>
                  {s.table_headers!.map((h, i) => (
                    <th key={i}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.table_rows!.map((r, ri) => (
                  <tr key={ri}>
                    {s.table_headers!.map((_, ci) => (
                      <td key={ci}>{r.cells[ci] ?? ""}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      );
      break;
    case "two_column":
      body = (
        <>
          {head}
          <div className="s-cols">
            <div className="s-col" style={{ borderColor: t.accent }}>
              <div className="s-col-t" style={{ color: t.accent }}>{s.left_title}</div>
              {list(s.left)}
            </div>
            <div className="s-col" style={{ borderColor: t.accent2 }}>
              <div className="s-col-t" style={{ color: t.accent2 }}>{s.right_title}</div>
              {list(s.right)}
            </div>
          </div>
        </>
      );
      break;
    case "highlight":
      body = (
        <>
          {head}
          <div className="s-highlight">{s.highlight}</div>
          {s.bullets.length > 0 && list(s.bullets)}
        </>
      );
      break;
    case "timeline":
      body = (
        <>
          {head}
          <div className="s-timeline" style={{ gridTemplateColumns: `repeat(${s.timeline!.length}, 1fr)` }}>
            {s.timeline!.map((e, i) => (
              <div key={i} className="s-tl-item">
                <div className="s-tl-label">{e.label}</div>
                <div className="s-tl-dot" style={{ background: palette(t)[i % 8] }} />
                <div className="s-tl-text">{e.text}</div>
              </div>
            ))}
          </div>
        </>
      );
      break;
    case "quiz":
      if (!s.question) {
        // ескі пішім: сұрақтар тізімі
        body = (
          <>
            {head}
            {list(s.bullets, "s-quiz")}
          </>
        );
        break;
      }
      body = (
        <>
          <div className="s-badge">Өзіңді тексер</div>
          <div className="s-h">{s.question}</div>
          <div className="s-options">
            {s.options!.map((o, i) => {
              const show = revealed || picked !== null;
              const state = show && i === s.correct_index ? "ok" : picked === i ? "no" : "";
              const content = (
                <>
                  <span className="s-opt-l">{letter(i)}</span>
                  <span>{o}</span>
                </>
              );
              return interactive ? (
                <button key={i} type="button" className={`s-opt ${state}`} onClick={(e) => { e.stopPropagation(); setPicked(i); }}>
                  {content}
                </button>
              ) : (
                <div key={i} className={`s-opt ${state}`}>{content}</div>
              );
            })}
          </div>
          {(revealed || picked !== null) && s.explanation && <div className="s-explain">{s.explanation}</div>}
        </>
      );
      break;
    case "task":
      body = (
        <>
          <div className="s-badge">Тапсырма</div>
          <div className="s-h">{s.heading}</div>
          <div className="s-task">
            {s.task_text && <div className="s-task-text">{s.task_text}</div>}
            {s.bullets.length > 0 && <ol className="s-steps">{s.bullets.map((b, i) => <li key={i}>{b}</li>)}</ol>}
          </div>
          {s.answer && interactive && (
            revealed ? (
              <div className="s-explain"><b>Жауабы:</b> {s.answer}</div>
            ) : (
              <button type="button" className="s-reveal" onClick={(e) => { e.stopPropagation(); setRevealed(true); }}>
                Жауабын көрсету
              </button>
            )
          )}
        </>
      );
      break;
    default:
      body = (
        <>
          {head}
          {list(s.bullets)}
        </>
      );
  }

  return (
    <div className={`slide ${cls}`} style={vars}>
      {!cls && <Decor3D />}
      <div className="slide-inner">{body}</div>
      {index !== undefined && total !== undefined && (
        <div className="s-num">
          {index + 1} / {total}
        </div>
      )}
    </div>
  );
}
