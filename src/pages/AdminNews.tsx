import { Megaphone, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Loading } from "../components/Loading";
import { Button, Card, Field, Textarea, TextInput } from "../components/ui";
import { tr } from "../i18n";
import { createAnnouncement, deleteAnnouncement, getAnnouncements, updateAnnouncement, type Announcement } from "../lib/announcements";
import { timeAgo } from "../lib/projects";
import { useLoad } from "../lib/useLoad";

/** Әкімші: мұғалімдерге хабарландыру жазу, өзгерту, жою. */
export default function AdminNewsPage() {
  const { data, setData, error: loadError, loading } = useLoad(() => getAnnouncements(100));
  const list = data ?? [];
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function reset() {
    setTitle("");
    setBody("");
    setEditingId(null);
  }

  function startEdit(a: Announcement) {
    setEditingId(a.id);
    setTitle(a.title);
    setBody(a.body);
    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError(tr("Тақырыбын жазыңыз."));
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (editingId) {
        await updateAnnouncement(editingId, title, body);
        setData(list.map((a) => (a.id === editingId ? { ...a, title: title.trim(), body: body.trim() } : a)));
        setNotice(tr("Хабарландыру өзгертілді."));
      } else {
        const a = await createAnnouncement(title, body);
        setData([a, ...list]);
        setNotice(tr("Хабарландыру жарияланды. Мұғалімдер оны басты беттегі қоңыраудан көреді."));
      }
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("Сақтау мүмкін болмады."));
    } finally {
      setBusy(false);
    }
  }

  async function remove(a: Announcement) {
    if (!window.confirm(tr("«{title}» хабарландыруын жоясыз ба?", { title: a.title }))) return;
    try {
      await deleteAnnouncement(a.id);
      setData(list.filter((x) => x.id !== a.id));
      if (editingId === a.id) reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("Жою мүмкін болмады."));
    }
  }

  return (
    <div className="mx-auto max-w-[980px] px-4 py-9 sm:px-10">
      <h1 className="text-[28px] font-bold">{tr("Хабарландырулар")}</h1>
      <p className="mt-1.5 mb-8 max-w-[680px] text-[14.5px] text-slate-500">
        {tr("Мұғалімдерге хабарландыру жазыңыз: мерзімдер, жиналыстар, семинарлар. Олар басты беттегі қоңыраудан көреді, жаңа хабарландыру санмен белгіленеді.")}
      </p>

      <Card>
        <form onSubmit={submit} noValidate>
          <Field>
            {tr("Тақырыбы")}
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder={tr("Мыс.: ІІ тоқсанның ҚМЖ-ларын тапсыру мерзімі")} />
          </Field>
          <Field>
            {tr("Мәтіні (міндетті емес)")}
            <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} maxLength={3000} className="resize-y" />
          </Field>
          {error && (
            <p role="alert" className="mb-3 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
              {error}
            </p>
          )}
          {notice && <p className="mb-3 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">{notice}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              <Megaphone size={16} /> {busy ? tr("Сақталуда...") : editingId ? tr("Өзгерісті сақтау") : tr("Жариялау")}
            </Button>
            {editingId && (
              <Button type="button" variant="ghost" onClick={reset}>
                {tr("Болдырмау")}
              </Button>
            )}
          </div>
        </form>
      </Card>

      <h2 className="mt-10 mb-4 text-xl font-bold">{tr("Жарияланғандар")}</h2>
      {loading ? (
        <Loading />
      ) : loadError ? (
        <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {loadError}
        </p>
      ) : list.length === 0 ? (
        <p className="rounded-[18px] border border-dashed border-slate-200 p-7 text-center text-sm text-slate-500">{tr("Әзірге хабарландыру жоқ.")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((a) => (
            <li key={a.id} className={`flex items-start gap-3 rounded-[16px] border bg-surface px-5 py-4 ${editingId === a.id ? "border-violet-500" : "border-slate-200"}`}>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{a.title}</div>
                {a.body && <div className="mt-1 text-sm whitespace-pre-line text-slate-500">{a.body}</div>}
                <div className="mt-2 text-xs text-slate-500">{timeAgo(a.createdAt)}</div>
              </div>
              <button type="button" onClick={() => startEdit(a)} aria-label={tr("Өңдеу")} className="rounded-lg p-2 text-slate-500 hover:bg-violet-50 hover:text-violet-600">
                <Pencil size={16} />
              </button>
              <button type="button" onClick={() => remove(a)} aria-label={tr("Жою")} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600">
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
