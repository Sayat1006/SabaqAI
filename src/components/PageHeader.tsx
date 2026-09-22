import { Link } from "react-router-dom";

export function PageHeader({ crumb, title, subtitle }: { crumb: string; title: string; subtitle: string }) {
  return (
    <div className="print:hidden">
      <div className="mb-2 text-[12.5px] text-slate-500">
        <Link to="/" className="hover:text-violet-600">
          Басты бет
        </Link>{" "}
        / {crumb}
      </div>
      <h1 className="text-[28px] font-bold">{title}</h1>
      <p className="mt-1.5 max-w-[680px] text-[14.5px] text-slate-500">{subtitle}</p>
    </div>
  );
}
