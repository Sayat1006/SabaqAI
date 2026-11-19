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
  | "opiq"
  | "custom";

const google = (site: string) => (q: string) => `https://www.google.com/search?q=${encodeURIComponent(`${q} site:${site}`)}`;

export const PLATFORMS: Record<Exclude<ResourcePlatform, "custom">, { label: string; kind: string; home: string; url: (q: string) => string }> = {
  bilimland: { label: "BilimLand", kind: "Видеосабақ, интерактив", home: "https://bilimland.kz/", url: google("bilimland.kz") },
  youtube: { label: "YouTube", kind: "Бейнематериал", home: "https://www.youtube.com/", url: (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}` },
  wikipedia: { label: "Уикипедия", kind: "Анықтамалық", home: "https://kk.wikipedia.org/", url: (q) => `https://kk.wikipedia.org/w/index.php?search=${encodeURIComponent(q)}` },
  okulyk: { label: "Okulyk.kz", kind: "Электронды оқулық", home: "https://okulyk.kz/", url: google("okulyk.kz") },
  phet: { label: "PhET", kind: "Интерактивті модель", home: "https://phet.colorado.edu/", url: google("phet.colorado.edu") },
  geogebra: { label: "GeoGebra", kind: "Интерактивті модель", home: "https://www.geogebra.org/", url: google("geogebra.org") },
  wordwall: { label: "Wordwall", kind: "Интерактивті ойын", home: "https://wordwall.net/", url: google("wordwall.net") },
  learningapps: { label: "LearningApps", kind: "Интерактивті жаттығу", home: "https://learningapps.org/", url: google("learningapps.org") },
  kahoot: { label: "Kahoot!", kind: "Викторина", home: "https://kahoot.com/", url: google("create.kahoot.it") },
  padlet: { label: "Padlet", kind: "Онлайн тақта", home: "https://padlet.com/", url: () => "https://padlet.com" },
  mentimeter: { label: "Mentimeter", kind: "Сауалнама, рефлексия", home: "https://www.mentimeter.com/", url: () => "https://www.mentimeter.com" },
  canva: { label: "Canva", kind: "Постер, инфографика", home: "https://www.canva.com/", url: () => "https://www.canva.com" },
  google_forms: { label: "Google Forms", kind: "Онлайн сауалнама", home: "https://forms.google.com/", url: () => "https://forms.google.com" },
  opiq: { label: "OPIQ", kind: "Цифрлық оқулық", home: "https://www.opiq.kz/", url: () => "https://www.opiq.kz/" },
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

/**
 * ҚМЖ үлгісінің «Сандық ресурстар (QR-кодтар)» бөлімі: үлгідегідей платформаның басты беті
 * (мыс. https://kahoot.com/) — QR-код әрдайым ашылатын сенімді бетке апарады.
 */
export function templateResource(raw: { title?: string; platform?: string; note?: string }): QmzhResource | null {
  const key = PLATFORM_KEYS.find((k) => k === raw.platform);
  if (!key) return null;
  const p = PLATFORMS[key];
  return { title: raw.title?.trim() || p.kind.toLowerCase(), platform: key, url: p.home, note: raw.note?.trim() ?? "" };
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
