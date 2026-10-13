// Сабақтағы оқу ойындары: public/games ішіндегі дайын HTML ойындар.
// Мұғалім сайт ішінде (толық экранмен) ашады, оқушылар сілтеме арқылы жүйеге кірмей ойнайды.

import { tr } from "../i18n";

export interface Game {
  id: string;
  emoji: string;
  title: string;
  subject: string;
  grade: string;
  topic: string;
  description: string;
  /** public/ ішіндегі файл. */
  src: string;
  skills: string[];
}

export const GAMES: Game[] = [
  {
    id: "robo-algoritm",
    emoji: "🤖",
    title: tr("Робо-Алгоритм"),
    subject: "Информатика",
    grade: "6-сынып",
    topic: tr("Алгоритм және цикл"),
    description: tr("Оқушы командалар мен цикл блоктарынан алгоритм құрып, роботты кедергілерден айналып өтіп мәреге жеткізеді. «Қатені түзету» режимінде қате алгоритмді тауып түзетеді."),
    src: "/games/robo-algoritm.html",
    skills: [tr("Алгоритм құру"), tr("Цикл"), tr("Қатені түзету (debugging)"), tr("3 деңгей")],
  },
  {
    id: "konil-kui-dongelegi",
    emoji: "🎡",
    title: tr("Сиқырлы көңіл-күй дөңгелегі"),
    subject: "Сынып сағаты",
    grade: "1–4-сынып",
    topic: tr("Жағымды көңіл-күй"),
    description: tr("Сабақ басындағы сергіту сәті: оқушы дөңгелекті айналдырып, күлімдеу, жылы сөз айту, терең дем алу сияқты жағымды тапсырманы орындайды. Тапсырма қазақша дауыстап оқылады."),
    src: "/games/konil-kui-dongelegi.html",
    skills: [tr("Сергіту сәті"), tr("Ынтымақтастық"), tr("Дауыстап оқу")],
  },
];

export const gameUrl = (g: Game) => `${window.location.origin}${g.src}`;
