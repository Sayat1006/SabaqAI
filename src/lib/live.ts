// Тірі викторина (Kahoot сияқты): мұғалім тақтаға сұрақ шығарады, оқушылар
// телефоннан 6 таңбалы кодпен кіріп жауап береді. Барлық тексеру Supabase-тегі
// функцияларда (7-жаңарту): дұрыс жауап оқушыға тек «reveal» кезеңінде көрінеді.
// Нақты уақыт үшін екі жақ та күйді секунд сайын сұрайды (Realtime баптауын қажет етпейді).

import { tr } from "../i18n";
import type { Lang } from "./lang";
import { supabase } from "./supabaseClient";

export type { Lang };
export type LiveStateName = "lobby" | "question" | "reveal" | "finished";

export interface LiveQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface LiveGame {
  id: string;
  code: string;
  title: string;
  questions: LiveQuestion[];
  timeLimit: number;
  lang: Lang;
}

export interface HostState {
  code: string;
  state: LiveStateName;
  current: number;
  total: number;
  timeLimit: number;
  remaining: number | null;
  players: { id: string; name: string; score: number }[];
  answers: { player: string; choice: number; correct: boolean; points: number }[];
}

export interface PlayerState {
  title: string;
  lang: Lang;
  state: LiveStateName;
  current: number;
  total: number;
  timeLimit: number;
  remaining: number | null;
  question: { question: string; options: string[] } | null;
  correct: number | null;
  answer: { choice: number; correct: boolean | null; points: number | null } | null;
  name: string;
  score: number | null;
  rank: number | null;
  players: number;
}

export interface LiveSeat {
  player: string;
  token: string;
  name: string;
}

/** Сервер қайтаратын қате кодтары: not_found, name_taken, full, bad_name, closed, setup. */
export class LiveError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

const KNOWN = ["not_found", "name_taken", "full", "bad_name", "closed", "bad_choice", "bad_questions", "not_allowed"];

function wrap(error: { message: string; code?: string }): LiveError {
  if (error.code === "PGRST202" || error.code === "42P01" || /Could not find the (function|table)|does not exist/i.test(error.message)) {
    return new LiveError("setup", tr("Тірі викторина әлі қосылмаған. Әкімші Supabase-те supabase/update-7-docs-live.sql файлын орындауы керек."));
  }
  const code = KNOWN.find((k) => error.message.includes(k));
  if (code) return new LiveError(code);
  if (/Failed to fetch|NetworkError|network/i.test(error.message)) return new LiveError("network");
  return new LiveError("unknown", error.message);
}

export async function createLiveGame(title: string, questions: LiveQuestion[], timeLimit: number, lang: Lang): Promise<{ id: string; code: string }> {
  const { data, error } = await supabase.rpc("live_create", {
    p_title: title,
    p_questions: questions.map(({ question, options, correctIndex }) => ({ question, options, correctIndex })),
    p_time: timeLimit,
    p_lang: lang,
  });
  if (error) throw wrap(error);
  return data as { id: string; code: string };
}

export async function getLiveGame(id: string): Promise<LiveGame | null> {
  const { data, error } = await supabase.from("live_games").select("id, code, title, questions, time_limit, lang").eq("id", id).maybeSingle();
  if (error) throw wrap(error);
  if (!data) return null;
  return {
    id: data.id as string,
    code: data.code as string,
    title: data.title as string,
    questions: data.questions as LiveQuestion[],
    timeLimit: data.time_limit as number,
    lang: (data.lang as Lang) ?? "kk",
  };
}

export async function getHostState(id: string): Promise<HostState> {
  const { data, error } = await supabase.rpc("live_host_state", { p_game: id });
  if (error) throw wrap(error);
  return data as HostState;
}

export async function liveControl(id: string, action: "next" | "reveal" | "finish"): Promise<void> {
  const { error } = await supabase.rpc("live_control", { p_game: id, p_action: action });
  if (error) throw wrap(error);
}

export async function joinLive(code: string, name: string): Promise<LiveSeat> {
  const { data, error } = await supabase.rpc("live_join", { p_code: code, p_name: name });
  if (error) throw wrap(error);
  return data as LiveSeat;
}

export async function getPlayerState(code: string, seat: LiveSeat): Promise<PlayerState> {
  const { data, error } = await supabase.rpc("live_state", { p_code: code, p_player: seat.player, p_token: seat.token });
  if (error) throw wrap(error);
  return data as PlayerState;
}

export async function sendLiveAnswer(code: string, seat: LiveSeat, q: number, choice: number): Promise<void> {
  const { error } = await supabase.rpc("live_answer", { p_code: code, p_player: seat.player, p_token: seat.token, p_q: q, p_choice: choice });
  if (error) throw wrap(error);
}

export const liveJoinUrl = (code?: string) => `${window.location.origin}/l${code ? `/${code}` : ""}`;

/** Жауап нұсқаларының түсі мен белгісі (тақтада да, телефонда да бірдей). */
export const OPTION_STYLES = [
  { shape: "▲", bg: "bg-rose-500", soft: "bg-rose-100 text-rose-800" },
  { shape: "◆", bg: "bg-sky-600", soft: "bg-sky-100 text-sky-800" },
  { shape: "●", bg: "bg-amber-500", soft: "bg-amber-100 text-amber-900" },
  { shape: "■", bg: "bg-emerald-600", soft: "bg-emerald-100 text-emerald-800" },
  { shape: "★", bg: "bg-violet-600", soft: "bg-violet-100 text-violet-800" },
  { shape: "♥", bg: "bg-fuchsia-600", soft: "bg-fuchsia-100 text-fuchsia-800" },
];

/** Тақта мен оқушы экранындағы мәтіндер ойын тілімен шығады. */
export const LIVE_TEXT = {
  kk: {
    goTo: "Телефоннан кіріңіз:",
    orScan: "немесе QR-кодты сканерлеңіз",
    code: "Ойын коды",
    players: "Қатысушылар",
    waitingPlayers: "Оқушылардың қосылуын күтудеміз...",
    start: "Ойынды бастау",
    question: "Сұрақ",
    answered: "жауап берді",
    showAnswer: "Жауапты көрсету",
    next: "Келесі сұрақ",
    results: "Нәтижелер",
    leaderboard: "Көшбасшылар",
    finished: "Ойын аяқталды!",
    points: "ұпай",
    place: "орын",
    name: "Атыңыз",
    namePh: "Мыс.: Айгерім С.",
    codePh: "6 таңбалы код",
    enter: "Кіру",
    youAreIn: "Сіз ойындасыз!",
    waitStart: "Мұғалім ойынды бастағанша күтіңіз",
    accepted: "Жауап қабылданды",
    waitOthers: "Басқаларды күтеміз...",
    timeUp: "Уақыт бітті",
    correct: "Дұрыс!",
    wrong: "Қате",
    correctWas: "Дұрыс жауап",
    noAnswer: "Жауап берілмеді",
    yourScore: "Ұпайыңыз",
    endGame: "Ойынды аяқтау",
    thanks: "Қатысқаныңызға рақмет!",
    leave: "Басқа ойынға кіру",
    liveQuiz: "Тірі викторина",
    hint: (n: number, t: number) => `${n} сұрақ · әр сұраққа ${t} секунд. Жылдам әрі дұрыс жауапқа көбірек ұпай (500–1000).`,
    errors: {
      not_found: "Ойын табылмады немесе аяқталған. Кодты тексеріңіз.",
      name_taken: "Бұл есім бос емес — басқаша жазыңыз (мыс. фамилиясының бас әрпімен).",
      full: "Ойында орын қалмады.",
      bad_name: "Атыңызды жазыңыз (кемінде 2 әріп).",
      network: "Интернет байланысын тексеріңіз.",
      unknown: "Қате шықты. Қайталап көріңіз.",
    } as Record<string, string>,
  },
  ru: {
    goTo: "Зайдите с телефона:",
    orScan: "или отсканируйте QR-код",
    code: "Код игры",
    players: "Участники",
    waitingPlayers: "Ждём участников...",
    start: "Начать игру",
    question: "Вопрос",
    answered: "ответили",
    showAnswer: "Показать ответ",
    next: "Следующий вопрос",
    results: "Результаты",
    leaderboard: "Лидеры",
    finished: "Игра окончена!",
    points: "очков",
    place: "место",
    name: "Ваше имя",
    namePh: "Напр.: Айгерим С.",
    codePh: "Код из 6 цифр",
    enter: "Войти",
    youAreIn: "Вы в игре!",
    waitStart: "Ждите, пока учитель начнёт игру",
    accepted: "Ответ принят",
    waitOthers: "Ждём остальных...",
    timeUp: "Время вышло",
    correct: "Верно!",
    wrong: "Неверно",
    correctWas: "Правильный ответ",
    noAnswer: "Нет ответа",
    yourScore: "Ваши очки",
    endGame: "Завершить игру",
    thanks: "Спасибо за участие!",
    leave: "Войти в другую игру",
    liveQuiz: "Живая викторина",
    hint: (n: number, t: number) => `${n} вопросов · ${t} секунд на вопрос. За быстрый и верный ответ — больше очков (500–1000).`,
    errors: {
      not_found: "Игра не найдена или уже завершена. Проверьте код.",
      name_taken: "Это имя уже занято — добавьте первую букву фамилии.",
      full: "В игре не осталось мест.",
      bad_name: "Введите имя (минимум 2 буквы).",
      network: "Проверьте подключение к интернету.",
      unknown: "Произошла ошибка. Попробуйте ещё раз.",
    } as Record<string, string>,
  },
} satisfies Record<Lang, unknown>;
