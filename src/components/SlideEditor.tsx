import { ImagePlus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { SlideData } from "../lib/slides";
import type { LessonItem, LessonSlide } from "../lib/lessonDeck";
import { tr } from "../i18n";

// Слайд өңдегіші. Тізім өрістері мәтін күйінде жергілікті сақталады (жол = бір элемент),
// сонда жазып отырғанда курсор секірмейді; әр өзгеріс слайдқа бірден қолданылады.
// Компонент әр слайд үшін `key` арқылы қайта құрылады.

const field = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-fuchsia-500";
const lines = (text: string) => text.split("\n");

function Label({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-semibold text-slate-500">
        {title}
        {hint && <span className="font-normal"> — {hint}</span>}
      </span>
      {children}
    </label>
  );
}

function TextInput({ title, hint, value, onChange, max = 200 }: { title: string; hint?: string; value: string; onChange: (v: string) => void; max?: number }) {
  return (
    <Label title={title} hint={hint}>
      <input value={value} onChange={(e) => onChange(e.target.value)} maxLength={max} className={field} />
    </Label>
  );
}

/** Көпжолды өріс: мәтінді өзі сақтайды, өзгергенде parse арқылы слайдқа жібереді. */
function LinesInput<T>({
  title,
  hint,
  initial,
  parse,
  onChange,
  rows = 4,
}: {
  title: string;
  hint?: string;
  initial: string;
  parse: (text: string) => T;
  onChange: (v: T) => void;
  rows?: number;
}) {
  const [text, setText] = useState(initial);
  return (
    <Label title={title} hint={hint}>
      <textarea
        value={text}
        rows={rows}
        maxLength={2000}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parse(e.target.value));
        }}
        className={`${field} resize-y`}
      />
    </Label>
  );
}

const cells = (line: string) => line.split("|").map((c) => c.trim());
const nonEmpty = (text: string) => lines(text).map((l) => l.trim()).filter(Boolean);

export function SlideEditor({
  slide,
  onChange,
  onRegenerateImage,
  imageBusy,
}: {
  slide: SlideData;
  onChange: (patch: Partial<SlideData>) => void;
  onRegenerateImage: () => void;
  imageBusy: boolean;
}) {
  const s = slide;
  const hasImage = s.layout === "title" || s.layout === "image" || (s.layout === "lesson" && !!s.image_prompt);

  return (
    <div className="flex flex-col gap-3.5">
      <TextInput title={tr("Тақырып")} value={s.heading} onChange={(heading) => onChange({ heading })} />
      {["title", "closing", "bullets", "image", "diagram", "chart", "table", "highlight", "timeline"].includes(s.layout) && (
        <TextInput title={tr("Қосымша жол")} hint={tr("міндетті емес")} value={s.subheading} onChange={(subheading) => onChange({ subheading })} max={300} />
      )}

      {s.layout === "lesson" && s.lesson && <LessonFields lesson={s.lesson} onChange={(patch) => onChange({ lesson: { ...s.lesson!, ...patch } })} />}

      {s.layout === "highlight" && (
        <Label title={tr("Басты ой / анықтама")}>
          <textarea value={s.highlight} rows={3} maxLength={600} onChange={(e) => onChange({ highlight: e.target.value })} className={`${field} resize-y`} />
        </Label>
      )}

      {["bullets", "image", "closing", "highlight", "task"].includes(s.layout) && (
        <LinesInput
          title={s.layout === "task" ? tr("Орындау қадамдары") : tr("Негізгі ойлар")}
          hint={tr("әр жол — бір пункт")}
          initial={s.bullets.join("\n")}
          parse={nonEmpty}
          onChange={(bullets) => onChange({ bullets })}
        />
      )}

      {s.layout === "task" && (
        <>
          <Label title={tr("Тапсырма шарты")}>
            <textarea value={s.task_text ?? ""} rows={3} maxLength={800} onChange={(e) => onChange({ task_text: e.target.value })} className={`${field} resize-y`} />
          </Label>
          <TextInput title={tr("Жауабы")} value={s.answer ?? ""} onChange={(answer) => onChange({ answer })} max={500} />
        </>
      )}

      {s.layout === "diagram" && (
        <>
          <Label title={tr("Сызба түрі")}>
            <select value={s.diagram_type} onChange={(e) => onChange({ diagram_type: e.target.value as SlideData["diagram_type"] })} className={field}>
              <option value="process">{tr("Процесс (қадамдар)")}</option>
              <option value="cycle">{tr("Цикл (айналым)")}</option>
              <option value="hierarchy">{tr("Иерархия (бірінші жол — негіз)")}</option>
            </select>
          </Label>
          <LinesInput title={tr("Элементтер")} hint={tr("әр жол — бір блок, 2–6")} initial={(s.diagram_nodes ?? []).join("\n")} parse={nonEmpty} onChange={(diagram_nodes) => onChange({ diagram_nodes: diagram_nodes.slice(0, 6) })} />
        </>
      )}

      {s.layout === "chart" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Label title={tr("Диаграмма түрі")}>
              <select value={s.chart_type} onChange={(e) => onChange({ chart_type: e.target.value as SlideData["chart_type"] })} className={field}>
                <option value="bar">{tr("Бағаналы")}</option>
                <option value="pie">{tr("Дөңгелек")}</option>
              </select>
            </Label>
            <TextInput title={tr("Өлшем бірлігі")} value={s.chart_unit ?? ""} onChange={(chart_unit) => onChange({ chart_unit })} max={20} />
          </div>
          <LinesInput
            title={tr("Деректер")}
            hint={tr("әр жол: Атауы: сан")}
            initial={(s.chart_labels ?? []).map((l, i) => `${l}: ${s.chart_values?.[i] ?? 0}`).join("\n")}
            parse={(text) => {
              const rows = nonEmpty(text)
                .map((l) => {
                  const at = l.lastIndexOf(":");
                  return { label: (at > 0 ? l.slice(0, at) : l).trim(), value: Number((at > 0 ? l.slice(at + 1) : "").replace(",", ".").trim()) };
                })
                .filter((r) => r.label && Number.isFinite(r.value) && r.value >= 0)
                .slice(0, 8);
              return { chart_labels: rows.map((r) => r.label), chart_values: rows.map((r) => r.value) };
            }}
            onChange={(patch) => onChange(patch)}
          />
        </>
      )}

      {s.layout === "table" && (
        <>
          <LinesInput
            title={tr("Баған атаулары")}
            hint={tr("| белгісімен бөліңіз")}
            rows={1}
            initial={(s.table_headers ?? []).join(" | ")}
            parse={(text) => cells(text.replace(/\n/g, " ")).filter(Boolean).slice(0, 5)}
            onChange={(table_headers) => onChange({ table_headers })}
          />
          <LinesInput
            title={tr("Жолдар")}
            hint={tr("әр жол — кестенің бір жолы, ұяшықтар | арқылы")}
            rows={5}
            initial={(s.table_rows ?? []).map((r) => r.cells.join(" | ")).join("\n")}
            parse={(text) => nonEmpty(text).map((l) => ({ cells: cells(l).slice(0, 5) })).slice(0, 6)}
            onChange={(table_rows) => onChange({ table_rows })}
          />
        </>
      )}

      {s.layout === "two_column" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-3">
            <TextInput title={tr("Сол баған атауы")} value={s.left_title} onChange={(left_title) => onChange({ left_title })} />
            <LinesInput title={tr("Сол баған")} hint={tr("әр жол — пункт")} initial={s.left.join("\n")} parse={nonEmpty} onChange={(left) => onChange({ left })} />
          </div>
          <div className="flex flex-col gap-3">
            <TextInput title={tr("Оң баған атауы")} value={s.right_title} onChange={(right_title) => onChange({ right_title })} />
            <LinesInput title={tr("Оң баған")} hint={tr("әр жол — пункт")} initial={s.right.join("\n")} parse={nonEmpty} onChange={(right) => onChange({ right })} />
          </div>
        </div>
      )}

      {s.layout === "timeline" && (
        <LinesInput
          title={tr("Оқиғалар")}
          hint={tr("әр жол: Күні | сипаттамасы")}
          initial={(s.timeline ?? []).map((t) => `${t.label} | ${t.text}`).join("\n")}
          parse={(text) =>
            nonEmpty(text)
              .map((l) => {
                const [label = "", ...rest] = cells(l);
                return { label, text: rest.join(" ") };
              })
              .slice(0, 5)
          }
          onChange={(timeline) => onChange({ timeline })}
        />
      )}

      {s.layout === "quiz" && (
        <>
          <Label title={tr("Сұрақ")}>
            <textarea value={s.question ?? ""} rows={2} maxLength={500} onChange={(e) => onChange({ question: e.target.value })} className={`${field} resize-y`} />
          </Label>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-[12.5px] font-semibold text-slate-500">{tr("Жауап нұсқалары — дұрысын белгілеңіз")}</legend>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="quiz-correct"
                  aria-label={tr("{letter} нұсқасы дұрыс", { letter: String.fromCharCode(65 + i) })}
                  checked={(s.correct_index ?? 0) === i}
                  onChange={() => onChange({ correct_index: i })}
                  className="h-4 w-4 accent-fuchsia-500"
                />
                <span className="w-4 text-sm font-bold">{String.fromCharCode(65 + i)}</span>
                <input
                  value={s.options?.[i] ?? ""}
                  maxLength={200}
                  onChange={(e) => {
                    const options = [0, 1, 2, 3].map((j) => (j === i ? e.target.value : (s.options?.[j] ?? "")));
                    while (options.length > 2 && !options[options.length - 1]) options.pop();
                    onChange({ options });
                  }}
                  className={field}
                />
              </div>
            ))}
          </fieldset>
          <TextInput title={tr("Түсіндірме")} value={s.explanation ?? ""} onChange={(explanation) => onChange({ explanation })} max={400} />
        </>
      )}

      {hasImage && (
        <div className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3">
          <Label title={tr("Сурет сипаттамасы")} hint={tr("ағылшынша жазған дұрыс")}>
            <textarea value={s.image_prompt ?? ""} rows={2} maxLength={400} onChange={(e) => onChange({ image_prompt: e.target.value })} className={`${field} resize-y`} />
          </Label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onRegenerateImage}
              disabled={imageBusy || !(s.image_prompt ?? "").trim()}
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-fuchsia-500 px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
            >
              <ImagePlus size={15} className={imageBusy ? "animate-pulse" : ""} /> {imageBusy ? tr("Салынуда...") : s.image_svg ? tr("Суретті қайта салу") : tr("Сурет салу")}
            </button>
            {s.image_svg && (
              <button type="button" onClick={() => onChange({ image_svg: undefined })} className="inline-flex items-center gap-1.5 rounded-[10px] border border-slate-200 px-3 py-2 text-[13px] font-semibold hover:border-rose-400 hover:text-rose-700">
                <Trash2 size={14} /> {tr("Суретті алып тастау")}
              </button>
            )}
          </div>
        </div>
      )}

      <Label title={tr("Мұғалімге жазба")} hint={tr("слайдта көрінбейді")}>
        <textarea value={s.notes} rows={2} maxLength={1000} onChange={(e) => onChange({ notes: e.target.value })} className={`${field} resize-y`} />
      </Label>
    </div>
  );
}

const itemsText = (items: LessonItem[] | undefined, cols: (keyof LessonItem)[]) => (items ?? []).map((it) => cols.map((c) => it[c] ?? "").join(" | ")).join("\n");
const parseItems = (text: string, cols: (keyof LessonItem)[]): LessonItem[] =>
  nonEmpty(text).map((l) => {
    const parts = cells(l);
    const it: LessonItem = { label: "", text: "" };
    cols.forEach((c, i) => (it[c] = parts[i] ?? ""));
    return it;
  });

/** ҚМЖ үлгісіндегі сабақ слайдының өрістері (түріне қарай). */
function LessonFields({ lesson: l, onChange }: { lesson: LessonSlide; onChange: (patch: Partial<LessonSlide>) => void }) {
  const k = l.kind;
  const RICH = tr("әр жол — бір абзац; **қалың**");
  const NOTE: Partial<Record<LessonSlide["kind"], string>> = {
    practice: tr("Әдістің сипаттамасы (көлбеу жол)"),
    problem: tr("Төменгі жолақ"),
    knowledge: tr("Сурет асты жазуы"),
    picture: tr("Суретке сұрақ"),
    levels: tr("Төменгі жол"),
    quiz: tr("QR-код асты жазуы"),
    closing: tr("Нақыл сөз"),
  };
  return (
    <>
      {k !== "title" && k !== "closing" && <TextInput title={tr("Кезең белгісі")} hint={tr("мыс. Сабақтың басы · 6 мин")} value={l.stage ?? ""} onChange={(stage) => onChange({ stage })} />}
      {k === "title" && (
        <>
          <TextInput title={tr("Жоғарғы жол")} value={l.kicker ?? ""} onChange={(kicker) => onChange({ kicker })} />
          <TextInput title={tr("Бөлім")} value={l.section ?? ""} onChange={(section) => onChange({ section })} max={300} />
          <LinesInput title={tr("Ақпарат")} hint={tr("әр жол — бір жол")} initial={(l.info ?? []).join("\n")} parse={nonEmpty} onChange={(info) => onChange({ info })} rows={2} />
        </>
      )}
      {(k === "goals" || k === "warmup") && (
        <>
          <TextInput title={k === "goals" ? tr("Сол жақ карточка атауы") : tr("Құндылық")} value={l.sideTitle ?? ""} onChange={(sideTitle) => onChange({ sideTitle })} />
          <LinesInput title={k === "goals" ? tr("Оқу мақсаттары") : tr("Нақыл сөз")} hint={tr("әр жол — бір пункт")} initial={(l.side ?? []).join("\n")} parse={nonEmpty} onChange={(side) => onChange({ side })} rows={3} />
        </>
      )}
      {k === "goals" && (
        <>
          <TextInput title={tr("Тізім атауы")} value={l.listTitle ?? ""} onChange={(listTitle) => onChange({ listTitle })} />
          <LinesInput title={tr("Сабақтың мақсаттары")} hint={tr("әр жол — бір мақсат")} initial={(l.items ?? []).map((it) => it.text).join("\n")} parse={(t) => nonEmpty(t).map((text, i) => ({ label: String(i + 1), text }))} onChange={(items) => onChange({ items })} />
        </>
      )}
      {["warmup", "practice", "problem", "knowledge", "break", "level", "reflection"].includes(k) && (
        <LinesInput title={k === "knowledge" ? tr("Негізгі ойлар") : tr("Мәтін")} hint={RICH} initial={(l.text ?? []).join("\n")} parse={nonEmpty} onChange={(text) => onChange({ text })} />
      )}
      {NOTE[k] && <TextInput title={NOTE[k]!} value={l.note ?? ""} onChange={(note) => onChange({ note })} max={400} />}
      {k === "level" && <TextInput title={tr("Жауабы")} value={l.answer ?? ""} onChange={(answer) => onChange({ answer })} max={600} />}
      {k === "levels" && (
        <LinesInput title={tr("Деңгейлер")} hint={tr("әр жол: әріп | атауы | сипаттамасы")} initial={itemsText(l.items, ["label", "text", "extra"])} parse={(t) => parseItems(t, ["label", "text", "extra"])} onChange={(items) => onChange({ items })} rows={3} />
      )}
      {k === "quiz" && (
        <>
          <LinesInput title={tr("Сұрақтар")} hint={tr("әр жол: сұрақ | жауабы")} initial={itemsText(l.items, ["text", "extra"])} parse={(t) => parseItems(t, ["text", "extra"]).map((it, i) => ({ ...it, label: String(i + 1) }))} onChange={(items) => onChange({ items })} rows={3} />
          <TextInput title={tr("QR-код сілтемесі")} value={l.qr ?? ""} onChange={(qr) => onChange({ qr: /^https?:\/\//i.test(qr.trim()) ? qr.trim() : "" })} max={1000} />
        </>
      )}
      {k === "reflection" && (
        <LinesInput title={tr("Бағалау шкаласы")} hint={tr("әр жол: балл | бағасы")} initial={itemsText(l.items, ["label", "text"])} parse={(t) => parseItems(t, ["label", "text"])} onChange={(items) => onChange({ items })} rows={4} />
      )}
      {k === "homework" && (
        <LinesInput title={tr("Үй тапсырмасы")} hint={tr("әр жол: деңгей (A, B, C) | атауы | тапсырма")} initial={itemsText(l.items, ["label", "text", "extra"])} parse={(t) => parseItems(t, ["label", "text", "extra"])} onChange={(items) => onChange({ items })} rows={3} />
      )}
    </>
  );
}
