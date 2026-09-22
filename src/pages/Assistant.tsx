import { useState } from "react";
import { Badge, Button, Card, TextInput } from "../components/ui";
import { generateAssistantReply } from "../lib/generators";

interface Message {
  from: "user" | "sai";
  text: string;
}

const suggestions = [
  "5-сыныпқа математикадан ҚМЖ керек",
  "Тарихтан Дода жасағым келеді",
  "Мәтінді диктантқа айналдыру",
  "Оқушылардың бағасын қалай бақылаймын?",
];

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      from: "sai",
      text: "Сәлеметсіз бе! Мен Sabaq — сіздің жеке AI-көмекшіңізбін. Сабаққа дайындықтың қай кезеңінде көмек керек?",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setMessages((prev) => [...prev, { from: "user", text: trimmed }]);
    setInput("");
    setSending(true);
    try {
      const reply = await generateAssistantReply(trimmed);
      setMessages((prev) => [...prev, { from: "sai", text: reply }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Badge>Sabaq · AI-көмекші</Badge>
      <h1 className="mt-3 mb-2 text-3xl font-semibold text-slate-900 dark:text-white">
        Sabaq көмекшісімен сөйлесу
      </h1>
      <p className="mb-2 text-slate-600 dark:text-slate-300">
        Сабаққа дайындық бойынша сұрағыңызды жазыңыз — көмекші қажет құралды ұсынады.
      </p>
      <p className="mb-6 text-xs text-slate-400 dark:text-slate-500">
        Көмекші жауаптарды нақты ЖИ (Gemini) арқылы генерациялайды.
      </p>

      <Card className="flex h-[480px] flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                  m.from === "user"
                    ? "bg-violet-600 text-white"
                    : "bg-violet-50 text-slate-700 dark:bg-violet-900/30 dark:text-slate-200"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl bg-violet-50 px-4 py-2 text-sm text-slate-400 dark:bg-violet-900/30 dark:text-slate-500">
                Көмекші теруде...
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              className="rounded-full border border-violet-200 px-3 py-1 text-xs text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-900/30"
            >
              {s}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mt-3 flex gap-2"
        >
          <TextInput
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Хабарламаңызды жазыңыз..."
            className="flex-1"
            disabled={sending}
          />
          <Button type="submit" disabled={sending}>
            Жіберу
          </Button>
        </form>
      </Card>
    </div>
  );
}
