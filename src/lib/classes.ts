// Сыныптар мен тесттер деректерінің ортақ түрлері мен localStorage оқу
// функциясы — Classes.tsx (CRUD) және Бақылау тақтасы (статистика) осыны
// бірге қолданады, деректер бір ғана "sai-classes" кілтінде сақталады.

export interface Student {
  id: string;
  name: string;
}

export interface TestRecord {
  id: string;
  title: string;
  maxScore: number;
  scores: Record<string, number>;
}

export interface SchoolClass {
  id: string;
  name: string;
  students: Student[];
  tests: TestRecord[];
}

const CLASSES_KEY = "sai-classes";

export function getClasses(): SchoolClass[] {
  try {
    const raw = localStorage.getItem(CLASSES_KEY);
    return raw ? (JSON.parse(raw) as SchoolClass[]) : [];
  } catch {
    return [];
  }
}

// Әр тестте әр оқушыға баға қойылмаған болса, оны "бағаланбаған жұмыс" деп санайды.
export function countPendingGrades(classes: SchoolClass[]): number {
  let pending = 0;
  for (const cls of classes) {
    for (const test of cls.tests) {
      for (const student of cls.students) {
        if (test.scores[student.id] === undefined) pending++;
      }
    }
  }
  return pending;
}
