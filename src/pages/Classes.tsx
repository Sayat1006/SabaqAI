import { useState } from "react";
import { Badge, Button, Card, Field, TextInput } from "../components/ui";
import type { SchoolClass, Student } from "../lib/classes";
import { useLocalStorage } from "../lib/useLocalStorage";

function uid() {
  return crypto.randomUUID();
}

export default function ClassesPage() {
  const [classes, setClasses] = useLocalStorage<SchoolClass[]>("sai-classes", []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newClassName, setNewClassName] = useState("");
  const [newStudentsRaw, setNewStudentsRaw] = useState("");
  const [studentName, setStudentName] = useState("");
  const [testTitle, setTestTitle] = useState("");
  const [testMax, setTestMax] = useState(10);

  const active = classes.find((c) => c.id === activeId) ?? null;

  function createClass(e: React.FormEvent) {
    e.preventDefault();
    if (!newClassName.trim()) return;
    const students: Student[] = newStudentsRaw
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean)
      .map((name) => ({ id: uid(), name }));
    const cls: SchoolClass = { id: uid(), name: newClassName.trim(), students, tests: [] };
    setClasses((prev) => [...prev, cls]);
    setActiveId(cls.id);
    setNewClassName("");
    setNewStudentsRaw("");
  }

  function updateActive(fn: (c: SchoolClass) => SchoolClass) {
    if (!active) return;
    setClasses((prev) => prev.map((c) => (c.id === active.id ? fn(c) : c)));
  }

  function addStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!studentName.trim() || !active) return;
    updateActive((c) => ({ ...c, students: [...c.students, { id: uid(), name: studentName.trim() }] }));
    setStudentName("");
  }

  function removeStudent(id: string) {
    updateActive((c) => ({ ...c, students: c.students.filter((s) => s.id !== id) }));
  }

  function addTest(e: React.FormEvent) {
    e.preventDefault();
    if (!testTitle.trim() || !active) return;
    updateActive((c) => ({
      ...c,
      tests: [...c.tests, { id: uid(), title: testTitle.trim(), maxScore: testMax, scores: {} }],
    }));
    setTestTitle("");
  }

  function removeTest(id: string) {
    updateActive((c) => ({ ...c, tests: c.tests.filter((t) => t.id !== id) }));
  }

  function setScore(testId: string, studentId: string, value: number) {
    updateActive((c) => ({
      ...c,
      tests: c.tests.map((t) => (t.id === testId ? { ...t, scores: { ...t.scores, [studentId]: value } } : t)),
    }));
  }

  function removeClass(id: string) {
    setClasses((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Badge>Сыныптар мен тесттер</Badge>
      <h1 className="mt-3 mb-2 text-3xl font-semibold text-slate-900 dark:text-white">
        Сыныпты құрып, нәтижелерді бақылаңыз
      </h1>
      <p className="mb-8 text-slate-600 dark:text-slate-300">
        Сынып құрып, оқушыларды қосыңыз, тест тағайындаңыз және бағаларды осы жерде жазып,
        орташа көрсеткішті автоматты бақылаңыз. Деректер осы браузерде сақталады.
      </p>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <Card>
            <h3 className="mb-3 font-semibold text-slate-900 dark:text-white">Жаңа сынып</h3>
            <form onSubmit={createClass}>
              <Field>
                Сынып атауы
                <TextInput placeholder="мысалы: 7Ә" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} required />
              </Field>
              <Field>
                Оқушылар (үтірмен)
                <TextInput placeholder="Айгерім, Дәурен, Мадина..." value={newStudentsRaw} onChange={(e) => setNewStudentsRaw(e.target.value)} />
              </Field>
              <Button type="submit" className="w-full">
                Құру
              </Button>
            </form>
          </Card>

          <Card>
            <h3 className="mb-3 font-semibold text-slate-900 dark:text-white">Сыныптар</h3>
            {classes.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">Әзірге сынып жоқ.</p>}
            <div className="space-y-1">
              {classes.map((c) => (
                <div key={c.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveId(c.id)}
                    className={`flex-1 rounded-lg px-3 py-2 text-left text-sm transition ${
                      activeId === c.id
                        ? "bg-violet-600 text-white"
                        : "text-slate-600 hover:bg-violet-100 dark:text-slate-300 dark:hover:bg-violet-900/40"
                    }`}
                  >
                    {c.name} <span className="opacity-70">({c.students.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeClass(c.id)}
                    className="px-2 text-xs text-rose-500 hover:text-rose-700"
                    aria-label="Сыныпты жою"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div>
          {!active && (
            <Card className="text-center text-slate-500 dark:text-slate-400">
              Сол жақтан сынып таңдаңыз немесе жаңа сынып құрыңыз.
            </Card>
          )}

          {active && (
            <div className="space-y-6">
              <Card>
                <h3 className="mb-3 font-semibold text-slate-900 dark:text-white">Оқушы қосу</h3>
                <form onSubmit={addStudent} className="flex gap-2">
                  <TextInput
                    placeholder="Оқушының аты-жөні"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit">Қосу</Button>
                </form>
              </Card>

              <Card>
                <h3 className="mb-3 font-semibold text-slate-900 dark:text-white">Тест тағайындау</h3>
                <form onSubmit={addTest} className="grid gap-3 sm:grid-cols-[1fr_120px_auto] sm:items-end">
                  <Field className="sm:mb-0">
                    Тест атауы
                    <TextInput placeholder="мысалы: Фотосинтез — Дода" value={testTitle} onChange={(e) => setTestTitle(e.target.value)} required />
                  </Field>
                  <Field className="sm:mb-0">
                    Макс. балл
                    <TextInput type="number" min={1} max={100} value={testMax} onChange={(e) => setTestMax(Number(e.target.value))} />
                  </Field>
                  <Button type="submit">Тағайындау</Button>
                </form>
              </Card>

              {active.tests.length > 0 && active.students.length > 0 && (
                <Card className="overflow-x-auto">
                  <h3 className="mb-3 font-semibold text-slate-900 dark:text-white">Бағалар кестесі</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500 dark:text-slate-400">
                        <th className="py-1.5 pr-3">Оқушы</th>
                        {active.tests.map((t) => (
                          <th key={t.id} className="py-1.5 pr-3">
                            <div className="flex items-center gap-1">
                              {t.title}
                              <button type="button" onClick={() => removeTest(t.id)} className="text-rose-500 hover:text-rose-700" aria-label="Тестті жою">
                                ✕
                              </button>
                            </div>
                            <span className="font-normal text-xs">max {t.maxScore}</span>
                          </th>
                        ))}
                        <th className="py-1.5 pr-3">Орташа</th>
                      </tr>
                    </thead>
                    <tbody>
                      {active.students.map((s) => {
                        const scores = active.tests.map((t) => t.scores[s.id]).filter((v): v is number => v !== undefined);
                        const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "—";
                        return (
                          <tr key={s.id} className="border-t border-violet-50 dark:border-violet-900/30">
                            <td className="py-1.5 pr-3 text-slate-800 dark:text-slate-100">
                              <div className="flex items-center gap-1">
                                {s.name}
                                <button type="button" onClick={() => removeStudent(s.id)} className="text-rose-400 hover:text-rose-600" aria-label="Оқушыны жою">
                                  ✕
                                </button>
                              </div>
                            </td>
                            {active.tests.map((t) => (
                              <td key={t.id} className="py-1.5 pr-3">
                                <input
                                  type="number"
                                  min={0}
                                  max={t.maxScore}
                                  value={t.scores[s.id] ?? ""}
                                  onChange={(e) => setScore(t.id, s.id, Number(e.target.value))}
                                  className="w-16 rounded-md border border-violet-200 px-2 py-1 text-sm dark:border-violet-800 dark:bg-[#1d1d1f]"
                                />
                              </td>
                            ))}
                            <td className="py-1.5 pr-3 font-medium text-violet-700 dark:text-violet-300">{avg}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Card>
              )}

              {active.students.length === 0 && (
                <Card className="text-center text-slate-500 dark:text-slate-400">Бұл сыныпта әлі оқушы жоқ.</Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
