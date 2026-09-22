import { useMemo, useState } from "react";
import { Badge, Button, Card, Field, Select, TextInput } from "../components/ui";
import { useLocalStorage } from "../lib/useLocalStorage";

interface MaterialItem {
  id: string;
  title: string;
  subject: string;
  type: string;
  note: string;
  createdAt: number;
}

const subjects = ["Математика", "Қазақ тілі", "Ағылшын тілі", "Биология", "Тарих", "Информатика", "Физика", "Химия", "Жаратылыстану"];
const types = ["Презентация", "Тапсырма парағы", "Видео", "Сурет/схема", "Тест", "Басқа"];

export default function LibraryPage() {
  const [materials, setMaterials] = useLocalStorage<MaterialItem[]>("sai-materials", []);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState(subjects[0]);
  const [type, setType] = useState(types[0]);
  const [note, setNote] = useState("");
  const [filterSubject, setFilterSubject] = useState("Барлығы");
  const [search, setSearch] = useState("");

  function addMaterial(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const item: MaterialItem = {
      id: crypto.randomUUID(),
      title: title.trim(),
      subject,
      type,
      note: note.trim(),
      createdAt: Date.now(),
    };
    setMaterials((prev) => [item, ...prev]);
    setTitle("");
    setNote("");
  }

  function remove(id: string) {
    setMaterials((prev) => prev.filter((m) => m.id !== id));
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return materials.filter(
      (m) =>
        (filterSubject === "Барлығы" || m.subject === filterSubject) &&
        (!q || m.title.toLowerCase().includes(q) || m.note.toLowerCase().includes(q)),
    );
  }, [materials, filterSubject, search]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Badge>Материалдар кітапханасы</Badge>
      <h1 className="mt-3 mb-2 text-3xl font-semibold text-slate-900 dark:text-white">
        Дидактикалық материалдарды бір жерде сақтау
      </h1>
      <p className="mb-8 text-slate-600 dark:text-slate-300">
        Материалдар осы браузерде (localStorage) сақталады — деректеріңіз тек өзіңіздің
        құрылғыңызда қалады.
      </p>

      <Card>
        <form onSubmit={addMaterial} className="grid gap-1 sm:grid-cols-2 sm:gap-x-6">
          <Field className="sm:col-span-2">
            Материал атауы
            <TextInput
              placeholder="мысалы: «Квадрат теңдеулер» презентациясы"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </Field>
          <Field>
            Пән
            <Select value={subject} onChange={(e) => setSubject(e.target.value)}>
              {subjects.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
          <Field>
            Түрі
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {types.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field className="sm:col-span-2">
            Сілтеме немесе ескертпе (міндетті емес)
            <TextInput placeholder="мысалы: Google Drive сілтемесі" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="pb-4 sm:col-span-2">
            <Button type="submit">Кітапханаға қосу</Button>
          </div>
        </form>
      </Card>

      <Card className="mt-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            Пән бойынша сүзу
            <Select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
              {["Барлығы", ...subjects].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
          <Field>
            Іздеу
            <TextInput placeholder="атауы бойынша іздеу" value={search} onChange={(e) => setSearch(e.target.value)} />
          </Field>
        </div>
      </Card>

      <div className="mt-6 space-y-3">
        {filtered.length === 0 && (
          <Card className="text-center text-slate-500 dark:text-slate-400">
            {materials.length === 0 ? "Әзірге материал қосылмаған." : "Іздеу нәтижесі табылмады."}
          </Card>
        )}
        {filtered.map((m) => (
          <Card key={m.id} className="flex items-start justify-between gap-4 text-left">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <h3 className="font-semibold text-slate-900 dark:text-white">{m.title}</h3>
                <Badge>{m.type}</Badge>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">{m.subject}</p>
              {m.note && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{m.note}</p>}
            </div>
            <Button variant="ghost" className="!px-2 !py-1 text-xs text-rose-600 dark:text-rose-400" type="button" onClick={() => remove(m.id)}>
              Жою
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
