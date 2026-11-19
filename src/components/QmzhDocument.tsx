import QRCode from "qrcode";
import { Link2, Plus, Trash2 } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { tr } from "../i18n";
import { qmzhTplLabels, tplDate } from "../lib/docLabels";
import type { LessonPlan } from "../lib/generators";
import { parseRichLine, splitLines } from "../lib/qmzhText";
import { customResource, platformLabel, safeUrl, type QmzhResource } from "../lib/resources";

// ҚМЖ ресми үлгісі (2-нұсқа) экранда: кестелер, бағандар, жапсырмалар және бөлімдердің
// реті Word үлгісімен бірдей (exportDocx.ts → exportTemplateQmzh).

const border = "border border-slate-400";
const cellPad = "px-2 py-1.5 align-top";
const headFill = "bg-[#D9E2F3] dark:bg-[#26324a]";
const stageFill = "bg-[#F2F2F2] dark:bg-white/5";

/** Ұяшық мәтіні: **қалың** бөліктер және «• » тізімдері. */
export function RichLines({ lines }: { lines: string[] }) {
  const parsed = lines.map(parseRichLine).filter((l) => l.parts.length);
  const out: React.ReactNode[] = [];
  for (let i = 0; i < parsed.length; ) {
    if (parsed[i].bullet) {
      const group = [];
      while (i < parsed.length && parsed[i].bullet) group.push(parsed[i++]);
      out.push(
        <ul key={`u${i}`} className="list-disc pl-5">
          {group.map((l, k) => (
            <li key={k}>
              <Parts line={l} />
            </li>
          ))}
        </ul>,
      );
    } else {
      out.push(
        <p key={`p${i}`}>
          <Parts line={parsed[i++]} />
        </p>,
      );
    }
  }
  return <div className="space-y-0.5">{out}</div>;
}

function Parts({ line }: { line: ReturnType<typeof parseRichLine> }) {
  return (
    <>
      {line.parts.map((p, i) => (p.bold ? <strong key={i}>{p.text}</strong> : <Fragment key={i}>{p.text}</Fragment>))}
    </>
  );
}

function Qr({ url }: { url: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { width: 240, margin: 1, errorCorrectionLevel: "M" })
      .then((d) => alive && setSrc(d))
      .catch(() => alive && setSrc(""));
    return () => {
      alive = false;
    };
  }, [url]);
  return src ? <img src={src} alt={tr("QR-код: {url}", { url })} className="mx-auto mt-1 h-[56px] w-[56px] bg-white" /> : <div className="mx-auto mt-1 h-[56px] w-[56px]" />;
}

/** Ресурс атауы үлгідегідей: «**Kahoot** – викторина». */
const resourceLabel = (r: QmzhResource) => (r.platform === "custom" ? { name: r.title, kind: "" } : { name: platformLabel(r.platform), kind: r.title });

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr>
      <th scope="row" className={`${border} ${cellPad} w-[26%] text-left font-bold`}>
        {label}
      </th>
      <td colSpan={2} className={`${border} ${cellPad}`}>
        {children}
      </td>
    </tr>
  );
}

const SectionTitle = ({ children }: { children: React.ReactNode }) => <p className="mb-1 mt-4 font-bold">{children}</p>;

export function QmzhTemplateView({
  plan,
  onResourcesChange,
  savingResources,
}: {
  plan: LessonPlan;
  onResourcesChange?: (next: QmzhResource[]) => void;
  savingResources?: boolean;
}) {
  const L = qmzhTplLabels(plan.lang);
  const objectives = plan.objectives?.length ? plan.objectives : [{ code: plan.objectiveCode, text: plan.objectiveText }];
  const planning = plan.planning;
  const resources = plan.resources ?? [];

  return (
    <div className="text-[13.5px] leading-snug text-slate-900">
      <div className="mb-3">
        <p>{L.approve}</p>
        <p>
          {L.approverRole} {plan.approver?.trim() || "____________________"}
        </p>
      </div>

      <table className="w-full border-collapse">
        <tbody>
          <InfoRow label={L.section}>{plan.section}</InfoRow>
          <InfoRow label={L.teacher}>{plan.teacherName}</InfoRow>
          <InfoRow label={L.date}>{tplDate(plan.date, plan.lang)}</InfoRow>
          <tr>
            <td className={`${border} ${cellPad}`}>
              <strong>{L.grade}</strong> {plan.gradeNumber}
            </td>
            <td className={`${border} ${cellPad}`}>{L.present}</td>
            <td className={`${border} ${cellPad}`}>{L.absent}</td>
          </tr>
          <InfoRow label={L.topic}>
            <strong>{plan.topic}</strong>
          </InfoRow>
          <InfoRow label={L.objectives}>
            {objectives.map((o, i) => (
              <p key={i}>{o.code ? `${o.code} - ${o.text}` : o.text}</p>
            ))}
          </InfoRow>
          <InfoRow label={L.goals}>
            {plan.goals.map((g, i) => (
              <p key={i}>{g}</p>
            ))}
          </InfoRow>
          <InfoRow label={L.values}>
            <p>
              {L.valuesProgram}
              <strong>{plan.valuesTitle}</strong>.
            </p>
            {plan.valuesQuote && <p className="italic">{plan.valuesQuote}</p>}
            <p>{plan.valuesText}</p>
          </InfoRow>
        </tbody>
      </table>

      <SectionTitle>{L.flow}</SectionTitle>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className={headFill}>
              {[
                [L.stageTime, "w-[12%]"],
                [L.teacherAction, "w-[37%]"],
                [L.studentAction, "w-[21%]"],
                [L.assessment, "w-[18%]"],
                [L.resources, "w-[12%]"],
              ].map(([h, w]) => (
                <th key={h} scope="col" className={`${border} ${cellPad} ${w} text-center font-bold`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plan.stages.flatMap((stage, si) =>
              stage.rows.map((row, ri) => (
                <tr key={`${si}-${ri}`}>
                  {ri === 0 && (
                    <td rowSpan={stage.rows.length} className={`${border} ${cellPad} ${stageFill}`}>
                      <p className="font-bold">{stage.name}</p>
                      <p className="font-bold">{stage.timeRange}</p>
                      {stage.purpose && <p className="italic">{stage.purpose}</p>}
                    </td>
                  )}
                  <td className={`${border} ${cellPad}`}>
                    <RichLines lines={row.teacherAction} />
                  </td>
                  <td className={`${border} ${cellPad}`}>
                    <RichLines lines={row.studentAction} />
                  </td>
                  <td className={`${border} ${cellPad}`}>
                    <RichLines lines={row.assessment ?? [row.assessmentType && `**${row.assessmentType}**`, row.assessmentDetail].filter(Boolean)} />
                  </td>
                  <td className={`${border} ${cellPad}`}>
                    <RichLines lines={splitLines(row.resources)} />
                  </td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>

      {planning && (
        <>
          <SectionTitle>{L.planningTitle}</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className={headFill}>
                  {[L.planDiff, L.planSupport, L.planAssess, L.planSafety].map((h) => (
                    <th key={h} scope="col" className={`${border} ${cellPad} text-center font-bold`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {[planning.differentiation, planning.support ?? "", planning.assessment, planning.safety].map((v, i) => (
                    <td key={i} className={`${border} ${cellPad} w-1/4`}>
                      <RichLines lines={splitLines(v)} />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {plan.answerKey && plan.answerKey.length > 0 && (
        <>
          <SectionTitle>{L.keyTitle}</SectionTitle>
          <table className="w-full border-collapse">
            <thead>
              <tr className={headFill}>
                <th scope="col" className={`${border} ${cellPad} w-[8%] text-center font-bold`}>
                  {L.keyLevel}
                </th>
                <th scope="col" className={`${border} ${cellPad} text-center font-bold`}>
                  {L.keyAnswer}
                </th>
              </tr>
            </thead>
            <tbody>
              {plan.answerKey.map((k, i) => (
                <tr key={i}>
                  <td className={`${border} ${cellPad} font-bold`}>{L.levels[k.level] ?? k.level}</td>
                  <td className={`${border} ${cellPad}`}>
                    <RichLines lines={splitLines(k.answer)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {(resources.length > 0 || onResourcesChange) && (
        <>
          <SectionTitle>{L.qrTitle}</SectionTitle>
          {resources.length > 0 && (
            <table className="w-full table-fixed border-collapse">
              <tbody>
                {Array.from({ length: Math.ceil(resources.length / 3) }, (_, row) => (
                  <tr key={row}>
                    {[0, 1, 2].map((col) => {
                      const i = row * 3 + col;
                      const r = resources[i];
                      if (!r) return <td key={col} className={`${border} ${cellPad}`} />;
                      const { name, kind } = resourceLabel(r);
                      return (
                        <td key={col} className={`${border} ${cellPad} relative`}>
                          <p>
                            <strong>{name}</strong>
                            {kind && ` – ${kind}`}
                          </p>
                          <a href={safeUrl(r.url)} target="_blank" rel="noopener noreferrer" className="break-all text-[#0563C1] underline">
                            {r.url}
                          </a>
                          <Qr url={r.url} />
                          {onResourcesChange && (
                            <button
                              type="button"
                              onClick={() => onResourcesChange(resources.filter((_, j) => j !== i))}
                              aria-label={tr("Өшіру: {title}", { title: name })}
                              className="absolute right-1 top-1 rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-700 print:hidden"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {onResourcesChange && <AddLink resources={resources} onChange={onResourcesChange} saving={savingResources} />}
        </>
      )}
    </div>
  );
}

function AddLink({ resources, onChange, saving }: { resources: QmzhResource[]; onChange: (next: QmzhResource[]) => void; saving?: boolean }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  function add(e: React.FormEvent) {
    e.preventDefault();
    const r = customResource(title, url);
    if (!r) {
      setError(tr("Сілтемені дұрыс жазыңыз (мыс.: https://bilimland.kz/...)."));
      return;
    }
    setError("");
    setTitle("");
    setUrl("");
    onChange([...resources, r]);
  }
  const input = "min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-violet-500";
  return (
    <form onSubmit={add} className="mt-3 flex flex-wrap gap-2 print:hidden">
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder={tr("Атауы (мыс.: BilimLand видеосабағы)")} className={`${input} flex-[1_1_180px]`} />
      <input value={url} onChange={(e) => setUrl(e.target.value)} maxLength={1000} inputMode="url" placeholder="https://..." aria-label={tr("Сілтеме")} className={`${input} flex-[2_1_220px]`} />
      <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
        <Plus size={15} /> <Link2 size={14} /> {tr("Сілтеме қосу")}
      </button>
      {error && <p className="w-full text-sm text-rose-700">{error}</p>}
    </form>
  );
}
