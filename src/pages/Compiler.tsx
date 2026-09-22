import { useRef, useState } from "react";
import { Badge, Button, Card } from "../components/ui";

const sample = `// JavaScript кодын осында жазып, "Іске қосу" батырмасын басыңыз
function isPrime(n) {
  if (n < 2) return false;
  for (let i = 2; i * i <= n; i++) {
    if (n % i === 0) return false;
  }
  return true;
}

const primes = [];
for (let n = 2; n <= 30; n++) {
  if (isPrime(n)) primes.push(n);
}
console.log("Жай сандар (30-ға дейін):", primes.join(", "));
`;

interface LogLine {
  kind: "log" | "error";
  text: string;
}

export default function CompilerPage() {
  const [code, setCode] = useState(sample);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [running, setRunning] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const runIdRef = useRef(0);

  function runCode() {
    setLogs([]);
    setRunning(true);
    const runId = ++runIdRef.current;

    const handler = (event: MessageEvent) => {
      if (event.data?.__saiRunId !== runId) return;
      if (event.data.type === "log") {
        setLogs((prev) => [...prev, { kind: "log", text: event.data.text }]);
      } else if (event.data.type === "error") {
        setLogs((prev) => [...prev, { kind: "error", text: event.data.text }]);
        setRunning(false);
      } else if (event.data.type === "done") {
        setRunning(false);
      }
    };
    window.addEventListener("message", handler);
    window.setTimeout(() => window.removeEventListener("message", handler), 8000);

    const srcdoc = `<!doctype html><html><body><script>
      const runId = ${runId};
      function send(type, text) { parent.postMessage({ __saiRunId: runId, type, text }, "*"); }
      const fmt = (a) => a.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(" ");
      console.log = (...a) => send("log", fmt(a));
      console.error = (...a) => send("error", fmt(a));
      window.onerror = (msg) => { send("error", String(msg)); return true; };
      try {
        ${code}
        send("done", "");
      } catch (e) {
        send("error", e && e.message ? e.message : String(e));
      }
    </script></body></html>`;

    if (iframeRef.current) {
      iframeRef.current.srcdoc = srcdoc;
    }

    window.setTimeout(() => {
      setRunning((r) => {
        if (r) window.removeEventListener("message", handler);
        return false;
      });
    }, 6000);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Badge>Sabaq Компилятор</Badge>
      <h1 className="mt-3 mb-2 text-3xl font-semibold text-slate-900 dark:text-white">
        Браузер ішіндегі код ортасы
      </h1>
      <p className="mb-8 text-slate-600 dark:text-slate-300">
        Информатика сабағында оқушылар қосымша бағдарлама орнатпай-ақ, JavaScript кодын жазып,
        нәтижесін бірден көре алады. Код оқшауланған (sandboxed) ортада орындалады.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-2 font-semibold text-slate-900 dark:text-white">Код</h3>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            className="h-80 w-full rounded-lg border border-violet-200 bg-slate-900 p-3 font-mono text-sm text-emerald-300 outline-none focus:border-violet-500 dark:border-violet-800"
          />
          <Button className="mt-3" type="button" onClick={runCode} disabled={running}>
            {running ? "Орындалуда..." : "▶ Іске қосу"}
          </Button>
        </Card>

        <Card>
          <h3 className="mb-2 font-semibold text-slate-900 dark:text-white">Нәтиже (консоль)</h3>
          <div className="h-80 overflow-y-auto rounded-lg bg-slate-950 p-3 font-mono text-sm">
            {logs.length === 0 && <p className="text-slate-500">Нәтиже осында шығады...</p>}
            {logs.map((l, i) => (
              <p key={i} className={l.kind === "error" ? "text-rose-400" : "text-slate-200"}>
                {l.kind === "error" ? "✕ " : "› "}
                {l.text}
              </p>
            ))}
          </div>
          <iframe ref={iframeRef} sandbox="allow-scripts" title="Sabaq code runner" className="hidden" />
        </Card>
      </div>
    </div>
  );
}
