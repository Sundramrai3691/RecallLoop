import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <header className="page-header"><div>{eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}<h1>{title}</h1>{description ? <p>{description}</p> : null}</div>{action}</header>;
}

export function EmptyState({ title, children, to, action, icon }: { title: string; children: ReactNode; to?: string; action?: string; icon?: ReactNode }) {
  return <section className="empty-state"><span className="empty-icon" aria-hidden="true">{icon ?? <ArrowRight size={18} />}</span><h3>{title}</h3><p>{children}</p>{to && action ? <Link className="btn btn-primary" to={to}>{action}</Link> : null}</section>;
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const safeValue = Math.max(0, Math.min(100, value));
  return <div className="progress-track" role="progressbar" aria-label={label ?? "Progress"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={safeValue}><div className="progress-fill" style={{ width: `${safeValue}%` }} /></div>;
}

export function MasteryBar({ value }: { value: number }) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const state = percent >= 75 ? "strong" : percent < 40 ? "weak" : "";
  const label = state === "strong" ? "Strong" : state === "weak" ? "Developing" : "Developing";
  return <div className="mastery-row"><strong>{label}</strong><div className="mastery-track" role="img" aria-label={`${label} mastery evidence`}><div className={`mastery-fill ${state}`} style={{ width: `${percent}%` }} /></div><span className="metadata">{label}</span></div>;
}
