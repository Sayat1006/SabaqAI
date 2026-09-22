import { useEffect, useState } from "react";
import { Badge, Button, Card, Field, Select } from "../components/ui";

const sampleText =
  "Қазақстан — Орталық Азияда орналасқан мемлекет. Елдің астанасы — Астана қаласы. Қазақстан аумағы жағынан әлемде тоғызыншы орында тұр. Елде түрлі ұлт өкілдері тату-тәтті өмір сүреді.";

const speedPresets = [
  { label: "Баяу", value: 0.7 },
  { label: "Орташа", value: 1 },
  { label: "Жылдам", value: 1.3 },
];

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function DictationPage() {
  const [text, setText] = useState(sampleText);
  const [rate, setRate] = useState(0.7);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState<string>("");
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  const sentences = splitSentences(text);

  useEffect(() => {
    if (!supported) return;
    function loadVoices() {
      const list = window.speechSynthesis.getVoices();
      setVoices(list);
      if (!voiceURI && list.length > 0) {
        const kk = list.find((v) => v.lang.toLowerCase().startsWith("kk"));
        const ru = list.find((v) => v.lang.toLowerCase().startsWith("ru"));
        setVoiceURI((kk ?? ru ?? list[0]).voiceURI);
      }
    }
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  function speak(content: string, onEnd?: () => void) {
    if (!supported) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(content);
    utter.rate = rate;
    const voice = voices.find((v) => v.voiceURI === voiceURI);
    if (voice) utter.voice = voice;
    utter.onstart = () => setSpeaking(true);
    utter.onend = () => {
      setSpeaking(false);
      onEnd?.();
    };
    window.speechSynthesis.speak(utter);
  }

  function playAll() {
    setSentenceIndex(0);
    speak(text);
  }

  function playSentence(i: number) {
    if (i < 0 || i >= sentences.length) return;
    setSentenceIndex(i);
    speak(sentences[i]);
  }

  function stop() {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Badge>ЖИ диктант</Badge>
      <h1 className="mt-3 mb-2 text-3xl font-semibold text-slate-900 dark:text-white">
        Мәтінді дауыстап оқытатын диктант режимі
      </h1>
      <p className="mb-8 text-slate-600 dark:text-slate-300">
        Мәтінді қойып, жылдамдықты таңдаңыз — жүйе оны дауыстап оқиды. Сөйлем-сөйлеп диктант
        жаздыру режимін де қолдануға болады.
      </p>

      {!supported && (
        <Card className="mb-6 border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          Бұл браузерде дауыстап оқу (Web Speech API) қолдау таппады. Chrome немесе Edge
          браузерін қолданып көріңіз.
        </Card>
      )}

      <Card>
        <Field>
          Диктант мәтіні
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            className="w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:border-violet-800 dark:bg-[#1d1d1f] dark:text-slate-100"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            Жылдамдық
            <Select value={rate} onChange={(e) => setRate(Number(e.target.value))}>
              {speedPresets.map((p) => (
                <option key={p.label} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
          {voices.length > 0 && (
            <Field>
              Дауыс
              <Select value={voiceURI} onChange={(e) => setVoiceURI(e.target.value)}>
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={playAll} disabled={!supported}>
            ▶ Толық мәтінді оқу
          </Button>
          <Button type="button" variant="ghost" onClick={stop} disabled={!supported || !speaking}>
            ⏹ Тоқтату
          </Button>
        </div>
      </Card>

      <Card className="mt-6 text-left">
        <h3 className="mb-3 font-semibold text-slate-900 dark:text-white">
          Сөйлем-сөйлеп диктант ({sentenceIndex + 1}/{sentences.length || 1})
        </h3>
        <div className="mb-4 space-y-2">
          {sentences.map((s, i) => (
            <div
              key={i}
              className={`rounded-lg border px-3 py-2 text-sm ${
                i === sentenceIndex
                  ? "border-violet-400 bg-violet-50 text-violet-800 dark:bg-violet-900/30 dark:text-violet-200"
                  : "border-violet-100 text-slate-600 dark:border-violet-900/40 dark:text-slate-300"
              }`}
            >
              {s}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" onClick={() => playSentence(sentenceIndex)} disabled={!supported}>
            🔁 Қайталау
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => playSentence(sentenceIndex + 1)}
            disabled={!supported || sentenceIndex >= sentences.length - 1}
          >
            Келесі сөйлем →
          </Button>
        </div>
      </Card>
    </div>
  );
}
