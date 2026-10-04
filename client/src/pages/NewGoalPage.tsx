import { FormEvent, useState } from "react";
import { ArrowLeft, Clock3 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { ApiError } from "../types";

const outcomes = ["Understand fundamentals", "Build production systems", "Get interview ready", "A mix of these"];

export function NewGoalPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [outcome, setOutcome] = useState(outcomes[0]);
  const [description, setDescription] = useState("");
  const [weeklyTimeBudgetMinutes, setWeeklyTimeBudgetMinutes] = useState(240);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try { const result = await api.createGoal({ title: title.trim(), description: [outcome, description.trim()].filter(Boolean).join(" · "), goalType: "learning", weeklyTimeBudgetMinutes }); navigate(`/goals/${result.goal.id}`); }
    catch (err) { setError(err instanceof ApiError ? "We couldn’t save this goal. Please try again." : "We couldn’t reach the goal service. Please try again."); }
    finally { setBusy(false); }
  }
  return <div className="goal-form-wrap"><Link className="back-link" to="/goals"><ArrowLeft size={15}/> Goals</Link><header className="goal-form-heading"><p className="eyebrow">A direction worth working toward</p><h1>What do you want to become good at?</h1><p className="muted">Set an outcome that can guide what you learn and practice.</p></header>
    <form className="card goal-form" onSubmit={(event) => void submit(event)}>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <label htmlFor="goal-title">Your goal</label><input id="goal-title" required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Backend engineer" />
      <fieldset><legend>What does “good” mean to you?</legend><div className="outcome-options">{outcomes.map((value) => <button type="button" key={value} className={`outcome-option ${outcome === value ? "selected" : ""}`} aria-pressed={outcome === value} onClick={() => setOutcome(value)}>{value}</button>)}</div></fieldset>
      <label htmlFor="goal-context">Anything specific you have in mind? <span className="muted">(optional)</span></label><textarea id="goal-context" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="A role, project, or milestone you’re working toward" />
      <fieldset><legend>How much time can you give it?</legend><div className="time-choice"><Clock3 size={17}/><strong>{weeklyTimeBudgetMinutes / 60} hours a week</strong><span className="metadata">About {Math.round(weeklyTimeBudgetMinutes / 7)} min a day</span></div><input aria-label="Weekly learning time in minutes" type="range" min={60} max={840} step={30} value={weeklyTimeBudgetMinutes} onChange={(event) => setWeeklyTimeBudgetMinutes(Number(event.target.value))}/><div className="range-labels"><span>1 hour</span><span>14 hours</span></div></fieldset>
      <div className="actions"><button className="btn btn-primary" disabled={busy || !title.trim()} type="submit">{busy ? "Saving goal…" : "Create goal"}</button><Link className="btn" to="/goals">Cancel</Link></div>
    </form>
  </div>;
}
