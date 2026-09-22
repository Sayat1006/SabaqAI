import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { IMAGE_STYLES, PRESENTATION_STYLES } from './catalog.js';
import { sanitizeSvg } from './svg.js';

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5';
const EFFORT = process.env.CLAUDE_EFFORT || 'medium';
/**
 * Server-side refusal fallback: if the model's safety classifiers decline a request, the API re-runs it
 * on Anthropic's recommended model for that refusal category inside the same call. CLAUDE_FALLBACKS=off disables it.
 */
const FALLBACKS = process.env.CLAUDE_FALLBACKS !== 'off';

/** Real generation needs a key; without one the app runs in demo mode with template content. */
export const aiEnabled = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const client = aiEnabled ? new Anthropic() : null;

export class AIError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

async function generateJson(schema, system, prompt) {
  let response;
  try {
    response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: EFFORT, format: betaZodOutputFormat(schema) },
      ...(FALLBACKS ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
      system,
      messages: [{ role: 'user', content: prompt }],
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) throw new AIError('AI қызметі қазір бос емес. Бір минуттан соң қайталап көріңіз.', 429);
    if (err instanceof Anthropic.AuthenticationError) throw new AIError('AI кілті жарамсыз. Әкімшіге хабарласыңыз.', 500);
    if (err instanceof Anthropic.APIConnectionError) throw new AIError('AI қызметіне қосылу мүмкін болмады.', 503);
    if (err instanceof Anthropic.APIError) throw new AIError(`AI қатесі: ${err.message}`, 502);
    throw err;
  }
  for (const block of response.content) {
    if (block.type === 'fallback') console.info(`AI fallback: ${block.from?.model} → ${block.to?.model}`);
  }
  if (response.stop_reason === 'refusal') throw new AIError('AI бұл сұранысты орындаудан бас тартты. Тақырыпты өзгертіп көріңіз.', 422);
  if (response.stop_reason === 'max_tokens') throw new AIError('Жауап тым ұзын болып кетті. Сұранысты қысқартып көріңіз.', 422);
  if (!response.parsed_output) throw new AIError('AI жауабын талдау мүмкін болмады. Қайталап көріңіз.', 502);
  return response.parsed_output;
}

/* ------------------------------------------------------------------ ҚМЖ */

const QmzSchema = z.object({
  section: z.string().describe('Бөлім / ұзақ мерзімді жоспар бөлімінің атауы'),
  topic: z.string(),
  learning_objectives: z.array(z.string()).describe('Оқу бағдарламасына сай оқу мақсаттары, кодымен'),
  lesson_objectives: z.array(z.string()).describe('Сабақтың мақсаттары: барлығы / көпшілігі / кейбірі'),
  assessment_criteria: z.array(z.string()),
  value_integration: z.string().describe('Таңдалған құндылықтың сабақта қалай дарытылатыны'),
  cross_curricular: z.string().describe('Пәнаралық байланыс'),
  prior_knowledge: z.string().describe('Алдыңғы білім'),
  stages: z.array(z.object({
    name: z.string().describe('Сабақтың басы / ортасы / соңы'),
    time: z.string().describe('мыс.: 1-6 мин'),
    teacher: z.array(z.string()),
    students: z.array(z.string()),
    assessment: z.string(),
    resources: z.string(),
  })),
  tasks: z.array(z.object({
    code: z.string().describe('T1, T2, ...'),
    level: z.string().describe('Блум деңгейі: БІЛУ, ТҮСІНУ, ҚОЛДАНУ, ТАЛДАУ, ...'),
    title: z.string(),
    description: z.string(),
    descriptors: z.array(z.string()),
  })),
  differentiation: z.string(),
  expected_result: z.string(),
  methods: z.array(z.object({ name: z.string(), description: z.string() })),
  reflection: z.string(),
  homework: z.string(),
});

const QMZ_SYSTEM = `Сен Қазақстан Республикасы жалпы білім беретін мектептеріне арналған тәжірибелі әдіскерсің.
Мұғалімге Оқу-ағарту министрлігінің ресми үлгісі бойынша қысқа мерзімді жоспар (ҚМЖ) құрастырасың.
Барлық мәтін әдеби қазақ тілінде жазылады (ағылшын/орыс тілі пәні болса, тапсырма мазмұны сол тілде болуы мүмкін).
Талаптар:
- Сабақ 45 минут: басы (~5 мин), ортасы (~32 мин), соңы (~8 мин). Уақыт аралықтары жалпы 45 минутқа тең болсын.
- Мұғалім мен оқушы әрекеттері нақты, орындалатын, бір-бірімен сәйкес болсын; белсенді оқыту әдістерінің атауын [жақша] ішінде көрсет.
- Оқу мақсаты берілсе, оны өзгертпей қолдан; берілмесе, МЖМБС-қа сай ықтимал кодты ұсын.
- 3 тапсырма (T1–T3) Блум деңгейлері бойынша өсіп отырсын, әрқайсысында 2–4 дескриптор болсын.
- Таңдалған құндылық сабақ мазмұнына табиғи түрде енгізілсін.
- Қалыптастырушы бағалау, саралау, рефлексия және үй тапсырмасы нақты болсын.
- Ойдан шығарылған статистика мен жалған дереккөздерді қолданба.`;

export async function generateQmz(input) {
  if (!aiEnabled) return demoQmz(input);
  const prompt = [
    `Пән: ${input.subject}`,
    `Сынып: ${input.grade}`,
    `Тоқсан: ${input.quarter}`,
    `Сабақ тақырыбы: ${input.topic}`,
    `Оқу мақсаттары: ${input.goals || '(көрсетілмеген — өзің ұсын)'}`,
    `Құндылық: «${input.value.label}» — ${input.value.desc}`,
    input.notes ? `Мұғалімнің қосымша тілегі: ${input.notes}` : '',
  ].filter(Boolean).join('\n');
  return generateJson(QmzSchema, QMZ_SYSTEM, `Осы сабаққа толық ҚМЖ құрастыр.\n\n${prompt}`);
}

function demoQmz({ subject, grade, topic, goals, value }) {
  return {
    section: topic,
    topic,
    learning_objectives: [goals || `${grade}-сынып оқу бағдарламасына сай оқу мақсаты`],
    lesson_objectives: [
      `Барлығы: «${topic}» тақырыбының негізгі ұғымдарын атайды`,
      'Көпшілігі: ұғымдарды мысалдармен түсіндіреді',
      'Кейбірі: алған білімін жаңа жағдаятта қолданады',
    ],
    assessment_criteria: ['Негізгі ұғымдарды анықтайды', 'Мысал келтіріп түсіндіреді', 'Білімін өмірлік жағдаятта қолданады'],
    value_integration: `«${value.label}» — ${value.desc}. Топтық жұмыс барысында оқушылар осы құндылықты талқылайды.`,
    cross_curricular: `${subject} пәнінің басқа пәндермен байланысы (мысал ретінде: математика, дүниетану).`,
    prior_knowledge: 'Алдыңғы сабақта өткен тақырыптар бойынша білім.',
    stages: [
      {
        name: 'Сабақтың басы', time: '1-5 мин',
        teacher: ['Сыныппен амандасып, оқушылардың дайындығын тексереді.', '[Миға шабуыл] Тақырыпқа қатысты сұрақтар қояды.', 'Сабақтың тақырыбы мен мақсатын жариялайды.'],
        students: ['Амандасады, сабаққа дайындалады.', 'Сұрақтарға жауап беріп, болжам айтады.', 'Тақырып пен мақсатты дәптерге жазады.'],
        assessment: 'Ауызша кері байланыс, мадақтау.', resources: 'Слайд, тақта',
      },
      {
        name: 'Сабақтың ортасы', time: '6-37 мин',
        teacher: ['Жаңа тақырыпты түсіндіреді, мысалдар көрсетеді.', '[Топтық жұмыс] T1 тапсырмасын ұйымдастырады.', 'T2 тапсырмасын жеке орындауға береді.', '[Джигсо] T3 тапсырмасы бойынша топтар арасында алмасу ұйымдастырады.'],
        students: ['Тыңдап, негізгі ұғымдарды жазып алады.', 'Топта T1 тапсырмасын орындайды.', 'T2 тапсырмасын жеке орындайды.', 'T3 нәтижесін қорғайды.'],
        assessment: 'Дескрипторлар бойынша қалыптастырушы бағалау, өзара бағалау.', resources: 'Оқулық, тапсырма парақтары',
      },
      {
        name: 'Сабақтың соңы', time: '38-45 мин',
        teacher: ['Сабақты қорытындылайды.', '[Бағдаршам] Рефлексия ұйымдастырады.', 'Үй тапсырмасын түсіндіреді.'],
        students: ['Сабақтан не үйренгенін айтады.', 'Рефлексия парағын толтырады.', 'Үй тапсырмасын жазып алады.'],
        assessment: 'Рефлексия, кері байланыс.', resources: 'Стикерлер',
      },
    ],
    tasks: [
      { code: 'T1', level: 'БІЛУ', title: 'Негізгі ұғымдар', description: `«${topic}» тақырыбының негізгі ұғымдарын анықтау.`, descriptors: ['ұғымдарды атайды', 'анықтамасын береді'] },
      { code: 'T2', level: 'ҚОЛДАНУ', title: 'Мысалмен жұмыс', description: 'Тақырып бойынша мысалдарды талдап, қорытынды жасау.', descriptors: ['мысалды талдайды', 'қорытынды жазады'] },
      { code: 'T3', level: 'ТАЛДАУ', title: 'Өмірлік жағдаят', description: 'Алған білімді күнделікті өмірдегі жағдаятқа қолдану.', descriptors: ['жағдаятты сипаттайды', 'шешім ұсынады', 'дәлелдейді'] },
    ],
    differentiation: 'Қолдау қажет оқушыларға көмекші сызба беріледі; қабілетті оқушыларға қосымша шығармашылық тапсырма ұсынылады.',
    expected_result: `Оқушылар «${topic}» тақырыбының негізгі ұғымдарын меңгеріп, оларды мысалдармен түсіндіре алады.`,
    methods: [
      { name: 'Миға шабуыл', description: 'Тақырыпқа кіріспе ретінде ашық сұрақтар.' },
      { name: 'Джигсо', description: 'Топтар арасында білім алмасу.' },
      { name: 'Бағдаршам', description: 'Сабақ соңындағы рефлексия әдісі.' },
    ],
    reflection: 'Сабақ мақсатына жеттік пе? Қандай тапсырма қиын болды? Келесі сабақта нені өзгертемін?',
    homework: 'Тақырып бойынша 3 мысал жазып келу.',
  };
}

/* --------------------------------------------------------- Презентация */

const PresentationSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  slides: z.array(z.object({
    layout: z.enum(['title', 'bullets', 'two_column', 'highlight', 'quiz', 'closing']),
    heading: z.string(),
    subheading: z.string().describe('Қысқа қосалқы тақырып немесе бос жол'),
    bullets: z.array(z.string()).describe('bullets/quiz үшін 2–5 қысқа тармақ'),
    left_title: z.string(),
    left: z.array(z.string()),
    right_title: z.string(),
    right: z.array(z.string()),
    highlight: z.string().describe('highlight слайдындағы басты формула/анықтама/дәйексөз'),
    notes: z.string().describe('Мұғалімге арналған спикер жазбасы'),
  })),
});

const PRESENTATION_SYSTEM = `Сен мұғалімдерге сабақ презентациясын құрастыратын әдіскер-дизайнерсің.
Барлық мәтін қазақ тілінде (егер тақырып шет тілі пәніне қатысты болмаса). Слайд мәтіні қысқа, оқушыға түсінікті, бір слайдта бір идея.
Макеттер: title (бірінші слайд), bullets (тармақтар), two_column (салыстыру: left/right), highlight (басты анықтама немесе формула), quiz (тексеру сұрақтары), closing (соңғы слайд).
Бірінші слайд — title, соңғысы — closing. Пайдаланылмайтын өрістерді бос жол немесе бос тізім етіп қалдыр. Ойдан шығарылған статистика қолданба.`;

export async function generatePresentation({ topic, style, count }) {
  if (!aiEnabled) return demoPresentation({ topic, count });
  const styleLabel = (PRESENTATION_STYLES.find((s) => s.key === style) || PRESENTATION_STYLES[0]).label;
  const prompt = `Тақырып: ${topic}\nСтиль: ${styleLabel}\nСлайд саны: дәл ${count}\n\nОсы тақырыпқа сабақ презентациясын құрастыр.`;
  const result = await generateJson(PresentationSchema, PRESENTATION_SYSTEM, prompt);
  return result;
}

function demoPresentation({ topic, count }) {
  const blank = { subheading: '', bullets: [], left_title: '', left: [], right_title: '', right: [], highlight: '', notes: '' };
  const middle = [
    { ...blank, layout: 'bullets', heading: 'Сабақ мақсаттары', bullets: ['Тақырыптың негізгі ұғымдарын білу', 'Мысалдармен түсіндіре алу', 'Өмірде қолдана білу'] },
    { ...blank, layout: 'highlight', heading: 'Негізгі анықтама', highlight: `${topic} — [негізгі анықтаманы осында жазыңыз]` },
    { ...blank, layout: 'two_column', heading: 'Салыстыру', left_title: 'Ұқсастықтар', left: ['[1-тармақ]', '[2-тармақ]'], right_title: 'Айырмашылықтар', right: ['[1-тармақ]', '[2-тармақ]'] },
    { ...blank, layout: 'bullets', heading: 'Мысалдар', bullets: ['[1-мысал]', '[2-мысал]', '[3-мысал]'] },
    { ...blank, layout: 'quiz', heading: 'Өзіңді тексер', bullets: ['[1-сұрақ]', '[2-сұрақ]', '[3-сұрақ]'] },
    { ...blank, layout: 'bullets', heading: 'Практикалық жұмыс', bullets: ['[Тапсырма сипаттамасы]'] },
    { ...blank, layout: 'bullets', heading: 'Қорытынды', bullets: ['[Негізгі тұжырым]'] },
  ];
  const slides = [{ ...blank, layout: 'title', heading: topic, subheading: 'Сабақ презентациясы' }];
  for (let i = 0; slides.length < count - 1; i++) slides.push({ ...middle[i % middle.length] });
  slides.push({ ...blank, layout: 'closing', heading: 'Сұрақтарыңыз бар ма?', subheading: 'Рахмет!' });
  return { title: topic, subtitle: 'Сабақ презентациясы', slides };
}

/* ---------------------------------------------------------------- Сурет */

const ImageSchema = z.object({
  title: z.string().describe('Қазақша қысқа атауы, 2–4 сөз'),
  subject: z.string().describe('Қай пәнге қатысты (қазақша)'),
  svg: z.string().describe('Толық <svg> элементі'),
});

const IMAGE_SYSTEM = `You are an illustrator who draws educational illustrations for school lessons as standalone SVG.
Rules for the svg field:
- A single <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"> root, no width/height attributes.
- Only static shapes: path, rect, circle, ellipse, line, polyline, polygon, g, text, tspan, defs, linearGradient, radialGradient, stop, clipPath, pattern, use (internal #ids only).
- No <script>, <foreignObject>, <image>, <style>, animation, event handlers or external references.
- A full-bleed background rect; the subject centered and clearly readable for children; accurate for teaching.
- Labels only when they help learning, in Kazakh, font-family="Times New Roman, serif".
- Keep it under ~12 KB.
title and subject are in Kazakh.`;

export async function generateImage({ prompt, style }) {
  const styleDef = IMAGE_STYLES.find((s) => s.key === style) || IMAGE_STYLES[0];
  if (!aiEnabled) return demoImage({ prompt, style: styleDef });
  const result = await generateJson(ImageSchema, IMAGE_SYSTEM,
    `Draw: ${prompt}\nVisual style: ${styleDef.label} — ${styleDef.hint}.`);
  const svg = sanitizeSvg(result.svg);
  if (!svg) throw new AIError('Сурет дұрыс генерацияланбады. Қайталап көріңіз.', 502);
  return { ...result, svg };
}

function demoImage({ prompt, style }) {
  const esc = (s) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const label = esc(prompt.slice(0, 40));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect width="800" height="600" fill="#FBF7F0"/><circle cx="400" cy="270" r="150" fill="#F7DFCB"/><circle cx="400" cy="270" r="95" fill="#E0733D" opacity=".85"/><rect x="320" y="190" width="160" height="160" rx="24" fill="#2F7D74" opacity=".75" transform="rotate(20 400 270)"/><text x="400" y="505" font-family="Times New Roman, serif" font-size="30" text-anchor="middle" fill="#1C1B2E">${label}</text><text x="400" y="545" font-family="Times New Roman, serif" font-size="18" text-anchor="middle" fill="#615D7A">Демо режим · ${esc(style.label)}</text></svg>`;
  return { title: prompt.slice(0, 40), subject: '', svg };
}
