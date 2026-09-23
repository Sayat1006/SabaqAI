// ҚМЖ ресурстарының сілтемелері. AI сілтеме (URL) ойлап шығармауы үшін ол тек платформа мен
// іздеу сөзін таңдайды, ал нақты сілтемені осы модуль сенімді платформалардың іздеу
// беттеріне немесе басты беттеріне құрастырады — сілтеме әрдайым ашылады.

export type ResourcePlatform =
  | "bilimland"
  | "youtube"
  | "wikipedia"
  | "okulyk"
  | "phet"
  | "geogebra"
  | "wordwall"
  | "learningapps"
  | "kahoot"
  | "padlet"
  | "mentimeter"
  | "canva"
  | "google_forms"
  | "custom";

const google = (site: string) => (q: string) => `https://www.google.com/search?q=${encodeURIComponent(`${q} site:${site}`)}`;

export const PLATFORMS: Record<Exclude<ResourcePlatform, "custom">, { label: string; kind: string; url: (q: string) => string }> = {
  bilimland: { label: "BilimLand", kind: "Видеосабақ, интерактив", url: google("bilimland.kz") },
  youtube: { label: "YouTube", kind: "Бейнематериал", url: (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}` },
  wikipedia: { label: "Уикипедия", kind: "Анықтамалық", url: (q) => `https://kk.wikipedia.org/w/index.php?search=${encodeURIComponent(q)}` },
  okulyk: { label: "Okulyk.kz", kind: "Электронды оқулық", url: google("okulyk.kz") },
  phet: { label: "PhET", kind: "Интерактивті модель", url: google("phet.colorado.edu") },
  geogebra: { label: "GeoGebra", kind: "Интерактивті модель", url: google("geogebra.org") },
  wordwall: { label: "Wordwall", kind: "Интерактивті ойын", url: google("wordwall.net") },
  learningapps: { label: "LearningApps", kind: "Интерактивті жаттығу", url: google("learningapps.org") },
  kahoot: { label: "Kahoot!", kind: "Викторина", url: google("create.kahoot.it") },
  padlet: { label: "Padlet", kind: "Онлайн тақта", url: () => "https://padlet.com" },
  mentimeter: { label: "Mentimeter", kind: "Сауалнама, рефлексия", url: () => "https://www.mentimeter.com" },
  canva: { label: "Canva", kind: "Постер, инфографика", url: () => "https://www.canva.com" },
  google_forms: { label: "Google Forms", kind: "Онлайн сауалнама", url: () => "https://forms.google.com" },
};

export const PLATFORM_KEYS = Object.keys(PLATFORMS) as Exclude<ResourcePlatform, "custom">[];

export interface QmzhResource {
  title: string;
  platform: ResourcePlatform;
  url: string;
  /** Сабақтың қай кезеңінде, не үшін қолданылады. */
  note: string;
}

export function buildResource(raw: { title?: string; platform?: string; query?: string; note?: string }): QmzhResource | null {
  const key = PLATFORM_KEYS.find((k) => k === raw.platform);
  const title = raw.title?.trim();
  if (!key || !title) return null;
  const query = raw.query?.trim() || title;
  return { title, platform: key, url: PLATFORMS[key].url(query), note: raw.note?.trim() ?? "" };
}

/** Мұғалім қосқан сілтеме: тек http(s) мекенжайлары қабылданады. */
export function customResource(title: string, url: string, note = ""): QmzhResource | null {
  const t = title.trim();
  let u = url.trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return { title: t || parsed.hostname, platform: "custom", url: parsed.toString(), note: note.trim() };
  } catch {
    return null;
  }
}

export const platformLabel = (p: ResourcePlatform) => (p === "custom" ? "Мұғалім қосқан" : PLATFORMS[p].label);
export const platformKind = (p: ResourcePlatform) => (p === "custom" ? "Сілтеме" : PLATFORMS[p].kind);

/** Сақталған сілтемені көрсетер алдында тексереміз: тек http(s). */
export const safeUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : "#");
