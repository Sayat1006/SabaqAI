// ҚМЖ үлгісіндегі ұяшық мәтіні: әр жол — бір абзац. Жол басындағы «• » — тізім белгісі,
// **...** — қалың мәтін (үлгідегі «Ұйымдастыру кезеңі.», «Дескриптор:», «2 балл» сияқты).
// Бұл белгілерді AI да, мұғалім де (өңдегіште) жаза алады.

export interface RichPart {
  text: string;
  bold: boolean;
}

export interface RichLine {
  bullet: boolean;
  parts: RichPart[];
}

const BULLET = /^\s*(?:[•●▪◦]|[-–—*](?=\s))\s*/;

export function parseRichLine(raw: string): RichLine {
  let line = String(raw ?? "").trim();
  let bullet = false;
  // «**• А:** ...» түріндегі жолда белгі қалың бөліктің ішінде тұруы мүмкін.
  const inside = line.match(/^\*\*\s*[•●▪◦]\s*/);
  if (inside) {
    bullet = true;
    line = `**${line.slice(inside[0].length)}`;
  } else if (BULLET.test(line) && !line.startsWith("**")) {
    bullet = true;
    line = line.replace(BULLET, "");
  }
  const parts: RichPart[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  for (let m = re.exec(line); m; m = re.exec(line)) {
    if (m.index > last) parts.push({ text: line.slice(last, m.index), bold: false });
    parts.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < line.length) parts.push({ text: line.slice(last), bold: false });
  // Жабылмай қалған ** белгілерін көрсетпейміз.
  for (const p of parts) p.text = p.text.replace(/\*\*/g, "");
  return { bullet, parts: parts.filter((p) => p.text) };
}

/** Белгілерсіз таза мәтін (презентация, AI контексті үшін). */
export const plainText = (s: string) => String(s ?? "").replace(/\*\*/g, "").replace(BULLET, "").trim();

/** Мәтінді жолдарға бөлу (бос жолдар алынып тасталады). */
export const splitLines = (s: string | undefined) =>
  String(s ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
