import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, CalendarClock, RotateCcw, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { PageHeader } from "../components/Ui";
import type { DashboardData, LearnerSummary, PlanTask } from "../types";
import { readableTitle } from "../utils/presentation";

export function ReviewImprovePage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [learner, setLearner] = useState<LearnerSummary | null>(null);
  const [tasks, setTasks] = useState<PlanTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyConcept, setBusyConcept] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([api.dashboard(), api.learnerSummary(), api.todayPlan()]).then(([summary, evidence, plan]) => {
      setDashboard(summary); setLearner(evidence); setTasks(plan.tasks);
    }).catch(() => setError("We couldn’t load your review schedule and submitted evidence. Refresh to try again."));
  }, []);

  const inProgressSessions = dashboard?.recentlyStudied.filter((session) => session.status === "in_progress") ?? [];
  const activeTasks = tasks.filter((task) => task.status === "planned" || task.status === "in_progress");
  async function practice(conceptId: string) {
    setBusyConcept(conceptId); setError(null);
    try { const run = await api.createAssessment(conceptId, "practice"); navigate(`/assessments/${run.assessment.id}?returnTo=${encodeURIComponent("/review")}`); }
    catch { navigate(`/resources?conceptId=${encodeURIComponent(conceptId)}&returnTo=${encodeURIComponent("/review")}`); }
  }

  const hasWork = Boolean(dashboard?.todayDue.length || learner?.weakConcepts.length || inProgressSessions.length || activeTasks.length);
  return <div className="intent-page">
    <PageHeader eyebrow="Review & improve" title="Choose what to strengthen" description="Due reviews follow your saved schedule. Weak concepts appear only when submitted recall evidence shows something to revisit." />
    {error ? <p className="error" role="alert">{error}</p> : null}
    {!dashboard || !learner ? <p className="muted" role="status">Loading your review schedule and evidence…</p> : !hasWork ? <section className="card review-empty"><Sparkles size={24}/><h2>No due reviews or demonstrated weak concepts</h2><p className="muted">There’s nothing scheduled or flagged by submitted answers right now. Choose a fresh topic or check what you already know.</p><div className="actions"><Link className="btn btn-primary" to="/knowledge-check">Test my knowledge <ArrowRight size={15}/></Link><Link className="btn" to="/study/new">Learn something new</Link></div></section> : <div className="review-sections">
      {dashboard.todayDue.length ? <section className="card"><div className="section-heading"><h2>Due now</h2><span className="status-chip">{dashboard.todayDue.length} scheduled</span></div><p className="muted">These recall attempts are due according to the scheduler.</p>{dashboard.todayDue.map((item) => <article className="review-action-row" key={item.recallId}><span className="review-action-icon"><RotateCcw size={17}/></span><span className="review-action-copy"><strong>{readableTitle(item.conceptName, "Scheduled recall")}</strong><span className="metadata">Scheduled for review · {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(item.dueAt))}</span></span><Link className="btn btn-primary" to={`/recall/${item.recallId}?returnTo=${encodeURIComponent("/review")}`}>Start review <ArrowRight size={14}/></Link></article>)}</section> : null}
      {learner.weakConcepts.length ? <section className="card"><div className="section-heading"><h2>Concepts to improve</h2><Link to="/learner">See all evidence</Link></div><p className="muted">These concepts have submitted recall results with missed knowledge points.</p>{learner.weakConcepts.map((item) => <article className="review-action-row" id={`weak-${item.conceptId}`} key={item.conceptId}><span className="review-action-icon"><Sparkles size={17}/></span><span className="review-action-copy"><strong>{readableTitle(item.conceptName, "Assessed concept")}</strong><span className="metadata">{item.mistakeCount ? `${item.mistakeCount} missed point${item.mistakeCount === 1 ? "" : "s"} in submitted evidence` : "Submitted evidence suggests another practice round"}</span></span><span className="actions"><button className="btn btn-primary" disabled={busyConcept === item.conceptId} type="button" onClick={() => void practice(item.conceptId)}>{busyConcept === item.conceptId ? "Preparing…" : "Practice"}</button><Link className="btn" to={`/resources?conceptId=${encodeURIComponent(item.conceptId)}&returnTo=${encodeURIComponent("/review")}`}>Resources</Link></span></article>)}</section> : null}
      {inProgressSessions.length ? <section className="card"><div className="section-heading"><h2>Unfinished study</h2></div>{inProgressSessions.map((item) => <article className="review-action-row" key={item.id}><span className="review-action-icon"><BookOpen size={17}/></span><span className="review-action-copy"><strong>{readableTitle(item.title, "Study session")}</strong><span className="metadata">Study session still in progress</span></span><Link className="btn" to={`/study/${item.id}`}>Continue study <ArrowRight size={14}/></Link></article>)}</section> : null}
      {activeTasks.length ? <section className="card"><div className="section-heading"><h2>Planned next steps</h2><Link to="/plan/today">Today’s plan</Link></div><p className="muted">The planner keeps complete, defer, and skip states separate.</p>{activeTasks.map((task) => <article className="review-action-row" key={task.id}><span className="review-action-icon"><CalendarClock size={17}/></span><span className="review-action-copy"><strong>{readableTitle(task.title, "Planned learning")}</strong><span className="metadata">{task.reason || "Included in your current plan"}</span></span><Link className="btn" to="/plan/today">Open plan <ArrowRight size={14}/></Link></article>)}</section> : null}
    </div>}
  </div>;
}
