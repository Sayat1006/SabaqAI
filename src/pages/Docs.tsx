import { Check, Download, FileText, Pencil, Printer, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { LangPicker } from "../components/LangPicker";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../context/useAuth";
import { GRADES, SUBJECTS } from "../lib/catalog";
import { DOC_LENGTHS, DOC_TYPES, docTypeOf, generateDocument, QUARTERS, type DocData, type DocInput, type DocSection, type DocType } from "../lib/documents";
import type { Lang } from "../lib/lang";
import { deleteProject, getDocument, getDocuments, saveDocument, timeAgo, updateDocument, type SavedDocument } from "../lib/projects";
import { scrollToResult } from "../lib/scrollToResult";
import { tr } from "../i18n";
import { defaultMaterialLang } from "../lib/lang";

const fieldClass = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none focus:border-violet-500";
const ghost =
  "inline-flex items-center gap-2 rounded-[11px] border border-slate-200 bg-surface px-3.5 py-2.5 text-sm font-semibold hover:border-violet-500 hover:text-violet-600 disabled:opacity-60";

function FormField({ label, hint, children }: { label: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-semibold text-slate-500">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export default function DocsPage() {
  const { user } = useAuth();
  const location = useLocation();
  const openedId = (location.state as { docId?: string } | null)?.docId ?? new URLSearchParams(location.search).get("id") ?? undefined;

  const [type, setType] = useState<DocType>("characteristic");
  const [lang, setLang] = useState<Lang>(defaultMaterialLang);
  const [topic, setTopic] = useState("");
  const [grade, setGrade] = useState(user?.grades?.[0] ?? GRADES[4]);
  const [subject, setSubject] = useState(user?.subject && SUBJECTS.includes(user.subject) ? user.subject : SUBJECTS[0]);
  const [student, setStudent] = useState("");
  const [quarter, setQuarter] = useState(QUARTERS[0]);
  const [notes, setNotes] = useState("");
  const [length, setLength] = useState<DocInput["length"]>("medium");
  const [author, setAuthor] = useState(user?.name ?? "");

  const [doc, setDoc] = useState<SavedDocument | null>(null);
  const [history, setHistory] = useState<SavedDocument[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const def = docTypeOf(type);

  function fill(d: SavedDocument) {
    setDoc(d);
    setEditing(false);
    const i = d.input;
    if (!i) return;
    setType(i.type);
    setLang(i.lang);
    setTopic(i.topic);
    setGrade(i.grade);
    setSubject(i.subject || subject);
    setStudent(i.student);
    setQuarter(i.quarter || QUARTERS[0]);
    setNotes(i.notes);
    setLength(i.length);
    if (i.author) setAuthor(i.author);
  }

  useEffect(() => {
    getDocuments()
      .then(setHistory)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!openedId) return;
    getDocument(openedId)
      .then((d) => d && fill(d))
      .catch((e) => setError(e instanceof Error ? e.message : tr("Құжатты ашу мүмкін болмады.")));
    // fill тек форманы толтырады — openedId өзгергенде ғана қайта жүктейміз
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openedId]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (generating) return;
    if (def.fields.includes("student") && student.trim().length < 2) return setError(tr("Оқушының атын жазыңыз."));
    if (def.fields.includes("topic") && topic.trim().length < 3) return setError(tr("{label} жазыңыз.", { label: tr(def.topicLabel) }));
    setError("");
    setGenerating(true);
    setEditing(false);
    scrollToResult();
    try {
      const input: DocInput = {
        type,
        lang,
        topic: def.fields.includes("topic") ? topic.trim() : "",
        grade,
        subject: def.fields.includes("subject") ? subject : "",
        student: def.fields.includes("student") ? student.trim() : "",
        quarter: def.fields.includes("quarter") ? quarter : "",
        notes: notes.trim(),
        length,
        author: author.trim(),
      };
      const saved = await saveDocument(await generateDocument(input));
      setDoc(saved);
      setHistory((h) => [saved, ...h].slice(0, 12));
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("Құжат жасау мүмкін болмады."));
    } finally {
      setGenerating(false);
    }
  }

  async function saveEdited(next: DocData) {
    if (!doc) return;
    setSaving(true);
    setError("");
    try {
      await updateDocument(doc.id, next);
      const updated = { ...doc, ...next };
      setDoc(updated);
      setHistory((h) => h.map((x) => (x.id === doc.id ? updated : x)));
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("Сақтау мүмкін болмады."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm(tr("Құжатты жою керек пе?"))) return;
    try {
      await deleteProject(id);
      setHistory((h) => h.filter((x) => x.id !== id));
      if (doc?.id === id) setDoc(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("Жою мүмкін болмады."));
    }
  }

  async function handleExport() {
    if (!doc) return;
    setExporting(true);
    try {
      const { exportDocumentToDocx } = await import("../lib/exportDocx");
      await exportDocumentToDocx(doc);
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("Word файлын жасау мүмкін болмады."));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-9 sm:px-10 print:p-0">
      <PageHeader
        crumb={tr("Құжаттар")}
        title={tr("Құжаттар")}
        subtitle={tr("Мінездеме, ата-ана жиналысының баяндамасы, тәрбие сағаты мен іс-шара сценарийі, тоқсандық есеп — деректерді жазыңыз, AI ресми құжатты дайындайды. Word-қа жүктеп, өңдей аласыз.")}
      />

      <div className="mt-8 flex flex-wrap items-start gap-7">
        <div className="flex w-full flex-col gap-5 lg:sticky lg:top-24 lg:w-[400px] print:hidden">
          <form
            onSubmit={handleGenerate}
            noValidate
            className="flex flex-col gap-5 rounded-3xl border border-surface/70 bg-surface/75 p-6 shadow-[0_24px_48px_-30px_rgba(27,26,46,.2)] backdrop-blur-xl"
          >
            <fieldset>
              <legend className="mb-2 block text-[13px] font-semibold text-slate-500">{tr("Құжат түрі")}</legend>
              <div className="grid grid-cols-2 gap-2">
                {DOC_TYPES.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    aria-pressed={type === d.id}
                    onClick={() => setType(d.id)}
                    className={`flex flex-col items-start gap-0.5 rounded-2xl border px-3 py-2.5 text-left transition ${type === d.id ? "border-violet-600 bg-violet-50 ring-2 ring-violet-600/20" : "border-slate-200 bg-surface hover:border-violet-400"}`}
                  >
                    <span className="text-[13px] leading-snug font-semibold">
                      {d.emoji} {tr(d.label)}
                    </span>
                    <span className="text-[11.5px] leading-snug text-slate-500">{tr(d.hint)}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <LangPicker value={lang} onChange={setLang} />

            {def.fields.includes("student") && (
              <FormField label={tr("Оқушының аты-жөні")} hint={tr("Құпиялылық үшін тек атын және тегінің бас әрпін жазсаңыз да болады — Word-та толықтырасыз.")}>
                <input value={student} onChange={(e) => setStudent(e.target.value)} maxLength={80} placeholder={tr("Мыс.: Айгерім С.")} className={fieldClass} />
              </FormField>
            )}
            {def.fields.includes("topic") && (
              <FormField label={tr(def.topicLabel)}>
                <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} placeholder={tr(def.topicPh)} className={fieldClass} />
              </FormField>
            )}
            <div className="grid grid-cols-2 gap-3">
              <FormField label={tr("Сынып")}>
                <select value={grade} onChange={(e) => setGrade(e.target.value)} className={fieldClass}>
                  {GRADES.map((g) => (
                    <option key={g} value={g}>{tr(g)}</option>
                  ))}
                </select>
              </FormField>
              {def.fields.includes("quarter") ? (
                <FormField label={tr("Кезең")}>
                  <select value={quarter} onChange={(e) => setQuarter(e.target.value)} className={fieldClass}>
                    {QUARTERS.map((q) => (
                      <option key={q} value={q}>{tr(q)}</option>
                    ))}
                  </select>
                </FormField>
              ) : (
                <FormField label={tr("Көлемі")}>
                  <select value={length} onChange={(e) => setLength(e.target.value as DocInput["length"])} className={fieldClass}>
                    {DOC_LENGTHS.map((l) => (
                      <option key={l.id} value={l.id}>
                        {tr(l.label)}
                      </option>
                    ))}
                  </select>
                </FormField>
              )}
            </div>
            {def.fields.includes("subject") && (
              <FormField label={tr("Пән")}>
                <select value={subject} onChange={(e) => setSubject(e.target.value)} className={fieldClass}>
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>{tr(s)}</option>
                  ))}
                </select>
              </FormField>
            )}
            <FormField label={tr("Деректер мен тілектер")} hint={tr("Неғұрлым нақты жазсаңыз, құжат соғұрлым дәл шығады. AI тек осы деректерге сүйенеді.")}>
              <textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} placeholder={tr(def.notesPh)} className={`${fieldClass} resize-y`} />
            </FormField>
            <FormField label={tr("Мұғалімнің аты-жөні (қолтаңбаға)")}>
              <input value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={80} className={fieldClass} />
            </FormField>
            {error && (
              <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={generating}
              className="flex w-full items-center justify-center gap-2.5 rounded-[14px] bg-violet-600 px-5 py-3.5 text-[15px] font-semibold text-white transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-70"
            >
              <Sparkles size={17} className={generating ? "animate-spin" : ""} />
              {generating ? tr("Дайындалуда...") : tr("Құжат жасау")}
            </button>
          </form>

          {history.length > 0 && (
            <div className="rounded-[18px] border border-slate-200 bg-surface p-5">
              <div className="mb-3 text-sm font-bold">{tr("Соңғы құжаттар")}</div>
              <ul className="flex flex-col gap-1">
                {history.map((d) => (
                  <li key={d.id} className="flex items-center gap-2">
                    <button type="button" onClick={() => fill(d)} className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50">
                      <span className="block truncate font-semibold">{d.title}</span>
                      <span className="block text-xs text-slate-500">
                        {tr(docTypeOf(d.type).label)} · {timeAgo(d.savedAt)}
                      </span>
                    </button>
                    <button type="button" onClick={() => handleDelete(d.id)} aria-label={tr("Жою: {title}", { title: d.title })} className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700">
                      <X size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <section id="result" className="min-w-0 flex-[1_1_560px] scroll-mt-28" aria-live="polite">
          {generating ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-surface">
              <Sparkles size={34} className="animate-spin text-violet-500" />
              <div className="text-base">{tr("Құжат дайындалуда...")}</div>
              <div className="text-[12.5px] text-slate-500">{tr("Әдетте 15–40 секунд алады")}</div>
            </div>
          ) : !doc ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-3.5 rounded-3xl border-2 border-dashed border-slate-200 p-10 text-center text-slate-500">
              <span className="flex h-[72px] w-[72px] items-center justify-center rounded-[20px] bg-violet-100 text-violet-500">
                <FileText size={32} />
              </span>
              <div className="text-base text-slate-900">{tr("Құжат түрін таңдап, деректерді жазыңыз")}</div>
              <div className="text-[13.5px]">{tr("Дайын құжат осы жерде пайда болады және «Жобалар» бөлімінде сақталады.")}</div>
            </div>
          ) : editing ? (
            <DocEditor doc={doc} saving={saving} onSave={saveEdited} onCancel={() => setEditing(false)} />
          ) : (
            <>
              <div className="mb-4 flex flex-wrap gap-2 print:hidden">
                <button type="button" onClick={handleExport} disabled={exporting} className={ghost}>
                  <Download size={16} /> {exporting ? tr("Дайындалуда...") : "Word (.docx)"}
                </button>
                <button type="button" onClick={() => window.print()} className={ghost}>
                  <Printer size={16} /> {tr("Басып шығару / PDF")}
                </button>
                <button type="button" onClick={() => setEditing(true)} className={ghost}>
                  <Pencil size={16} /> {tr("Өңдеу")}
                </button>
              </div>
              <DocView doc={doc} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function DocView({ doc }: { doc: DocData }) {
  return (
    <article lang={doc.lang === "ru" ? "ru" : "kk"} className="animate-[fadeUp_.5s_cubic-bezier(.16,1,.3,1)_both] rounded-[22px] border border-slate-200 bg-surface p-6 text-[15.5px] leading-relaxed sm:p-10 print:border-0 print:p-0">
      <h1 className="text-center text-2xl font-bold">{doc.title}</h1>
      {doc.subtitle && <p className="mt-1 text-center text-slate-500">{doc.subtitle}</p>}
      <div className="mt-6 flex flex-col gap-5">
        {doc.sections.map((s, i) => (
          <section key={i} className="flex flex-col gap-2">
            {s.heading && <h2 className="text-lg font-bold text-violet-700">{s.heading}</h2>}
            {s.paragraphs.map((p, j) => (
              <p key={j} className="indent-8 whitespace-pre-line">
                {p}
              </p>
            ))}
            {s.bullets.length > 0 && (
              <ul className="ml-6 list-disc">
                {s.bullets.map((b, j) => (
                  <li key={j}>{b}</li>
                ))}
              </ul>
            )}
            {s.table && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      {s.table.headers.map((h, j) => (
                        <th key={j} className="border border-violet-200 bg-violet-50 px-2 py-1.5 text-left">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.table.rows.map((r, j) => (
                      <tr key={j}>
                        {r.map((c, k) => (
                          <td key={k} className="border border-violet-200 px-2 py-1.5 align-top">
                            {c}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </div>
      {doc.signature && <p className="mt-8 text-right font-semibold">{doc.signature}</p>}
    </article>
  );
}

const splitParas = (t: string) =>
  t
    .split(/\n\s*\n/)
    .map((x) => x.trim())
    .filter(Boolean);
const splitLines = (t: string) =>
  t
    .split("\n")
    .map((x) => x.replace(/^\s*[-•–]\s*/, "").trim())
    .filter(Boolean);

interface EditSection {
  heading: string;
  paragraphs: string;
  bullets: string;
  table: DocSection["table"];
}

function DocEditor({ doc, saving, onSave, onCancel }: { doc: DocData; saving: boolean; onSave: (d: DocData) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(doc.title);
  const [subtitle, setSubtitle] = useState(doc.subtitle);
  const [signature, setSignature] = useState(doc.signature);
  const [sections, setSections] = useState<EditSection[]>(() =>
    doc.sections.map((s) => ({ heading: s.heading, paragraphs: s.paragraphs.join("\n\n"), bullets: s.bullets.join("\n"), table: s.table ?? null })),
  );
  const patch = (i: number, p: Partial<EditSection>) => setSections((all) => all.map((s, j) => (j === i ? { ...s, ...p } : s)));
  const setCell = (i: number, r: number, c: number, v: string) =>
    setSections((all) =>
      all.map((s, j) => (j === i && s.table ? { ...s, table: { ...s.table, rows: s.table.rows.map((row, rr) => (rr === r ? row.map((x, cc) => (cc === c ? v : x)) : row)) } } : s)),
    );

  function save() {
    onSave({
      ...doc,
      title: title.trim() || doc.title,
      subtitle: subtitle.trim(),
      signature: signature.trim(),
      sections: sections
        .map((s) => ({ heading: s.heading.trim(), paragraphs: splitParas(s.paragraphs), bullets: splitLines(s.bullets), table: s.table }))
        .filter((s) => s.heading || s.paragraphs.length || s.bullets.length || s.table),
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-[22px] border border-slate-200 bg-surface p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{tr("Құжатты өңдеу")}</h2>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className={ghost}>
            <X size={16} /> {tr("Бас тарту")}
          </button>
          <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-[11px] bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            <Check size={16} /> {saving ? tr("Сақталуда...") : tr("Сақтау")}
          </button>
        </div>
      </div>
      <FormField label={tr("Атауы")}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={fieldClass} />
      </FormField>
      <FormField label={tr("Атауының астындағы жол")}>
        <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className={fieldClass} />
      </FormField>
      {sections.map((s, i) => (
        <fieldset key={i} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2">
            <input value={s.heading} onChange={(e) => patch(i, { heading: e.target.value })} aria-label={tr("{n}-бөлім атауы", { n: i + 1 })} placeholder={tr("Бөлім атауы")} className={`${fieldClass} font-semibold`} />
            <button
              type="button"
              onClick={() => setSections((all) => all.filter((_, j) => j !== i))}
              aria-label={tr("{n}-бөлімді өшіру", { n: i + 1 })}
              className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
            >
              <X size={16} />
            </button>
          </div>
          <FormField label={tr("Мәтін")} hint={tr("Азат жолдарды бос жолмен бөліңіз.")}>
            <textarea rows={Math.min(14, 3 + s.paragraphs.length / 90)} value={s.paragraphs} onChange={(e) => patch(i, { paragraphs: e.target.value })} className={`${fieldClass} resize-y`} />
          </FormField>
          <FormField label={tr("Тізім")} hint={tr("Әр тармақ — жаңа жолдан.")}>
            <textarea rows={Math.max(2, s.bullets.split("\n").length)} value={s.bullets} onChange={(e) => patch(i, { bullets: e.target.value })} className={`${fieldClass} resize-y`} />
          </FormField>
          {s.table && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {s.table.headers.map((h, j) => (
                      <th key={j} className="border border-slate-200 bg-slate-50 px-2 py-1 text-left">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.table.rows.map((r, rr) => (
                    <tr key={rr}>
                      {r.map((c, cc) => (
                        <td key={cc} className="border border-slate-200 p-0">
                          <input value={c} onChange={(e) => setCell(i, rr, cc, e.target.value)} aria-label={tr("Кесте {r}:{c}", { r: rr + 1, c: cc + 1 })} className="w-full min-w-[80px] bg-transparent px-2 py-1 outline-none focus:bg-violet-50" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </fieldset>
      ))}
      <button type="button" onClick={() => setSections((all) => [...all, { heading: "", paragraphs: "", bullets: "", table: null }])} className={`${ghost} self-start`}>
        {tr("+ Бөлім қосу")}
      </button>
      <FormField label={tr("Қолтаңба")}>
        <input value={signature} onChange={(e) => setSignature(e.target.value)} className={fieldClass} />
      </FormField>
    </div>
  );
}
