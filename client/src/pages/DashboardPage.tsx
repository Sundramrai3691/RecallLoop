import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, RotateCcw, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { EmptyState, PageHeader, ProgressBar } from "../components/Ui";
import { WhyThis } from "../components/WhyThis";
import { useDashboard } from "../hooks/useDashboard";
import type { Goal, LearnerSummary, PlanTask } from "../types";

export function DashboardPage() {
  const { data, error } = useDashboard();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [tasks, setTasks] = useState<PlanTask[]>([]);
  const [learner, setLearner] = useState<LearnerSummary | null>(null);
  useEffect(() => {
    void Promise.allSettled([api.listGoals(), api.todayPlan(), api.learnerSummary()]).then(([goals, plan, summary]) => {
      if (goals.status === "fulfilled") setGoal(goals.value.goals.find((item) => item.status === "active") ?? null);
      if (plan.status === "fulfilled") setTasks(plan.value.tasks);
      if (summary.status === "fulfilled") setLearner(summary.value);
    });
  }, []);

  if (error) return <div className="grid"><PageHeader eyebrow="Your learning workspace" title="Dashboard"/><section className="error"><strong>We couldn’t load your learning data.</strong><p>{error.status === 401 ? "Sign in to see your learning workspace." : "Check that the app server and database are available, then refresh."}</p><div className="actions">{error.status === 401?<Link className="btn btn-primary" to="/login">Sign in</Link>:<button className="btn btn-primary" type="button" onClick={()=>window.location.reload()}>Try again</button>}</div></section></div>;
  if (!data) return <div className="grid"><PageHeader eyebrow="Your learning workspace" title="Dashboard"/><div className="card grid"><div className="skeleton"/><div className="skeleton"/><div className="skeleton"/></div></div>;
  const nextRecall = data.todayDue[0];
  const pendingTask = tasks.find((task) => task.status !== "completed");
  return <div>
    <PageHeader eyebrow="Your learning workspace" title="What should you work on now?" description="Pick up where your learning will have the most impact." />
    {nextRecall ? <section className="next-action card">
      <div className="next-action-copy"><p className="eyebrow"><Sparkles size={13}/> Next best action</p><h2>{nextRecall.conceptName}</h2><p className="muted">A recall is ready to strengthen what you’ve learned.</p><WhyThis reason="This concept is due for review according to your recall schedule."/><div className="actions"><Link className="btn btn-primary" to={`/recall/${nextRecall.recallId}`}>Start recall <ArrowRight size={16}/></Link></div></div>
      <div className="next-action-mark"><RotateCcw size={30}/><span>RECALL</span></div>
    </section> : <EmptyState title="Your next session starts here" to="/study/new" action="Start a study session" icon={<BookOpen size={18}/>}>{data.submittedRecallCount === 0 ? "Choose a topic to study. Afterward, recall practice helps establish what you know." : "Nothing is due right now. Study something new or explore your learning plan."}</EmptyState>}

    <div className="grid dashboard-secondary" style={{ marginTop: 18 }}>
      <article className="card"><div className="section-heading" style={{ marginTop: 0 }}><h2>Active goal</h2><Link to="/goals">All goals</Link></div>{goal ? <><h3>{goal.title}</h3><p className="muted">{goal.weeklyTimeBudgetMinutes} minutes a week</p><Link to={`/goals/${goal.id}`}>Continue goal <ArrowRight size={14}/></Link></> : <EmptyState title="Set a direction" to="/goals/new" action="Create a goal">A goal helps shape a focused learning plan.</EmptyState>}</article>
      <article className="card"><div className="section-heading" style={{ marginTop: 0 }}><h2>Today's plan</h2><Link to="/plan/today">Open plan</Link></div>{tasks.length ? <><p className="stat">{tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0)} <span className="metadata">min planned</span></p><ProgressBar value={tasks.length ? tasks.filter((task) => task.status === "completed").length / tasks.length * 100 : 0} label="Plan completion"/><p className="muted" style={{ marginTop: 10 }}>{pendingTask ? `Up next: ${pendingTask.title}` : "Today's plan is complete."}</p></> : <p className="muted">A plan will appear when there’s work scheduled for today.</p>}</article>
      <article className="card"><div className="section-heading" style={{ marginTop: 0 }}><h2>Recall attempts</h2><Link to="/learner">See evidence</Link></div>{data.submittedRecallCount?<><p className="stat">{data.submittedRecallCount}</p><p className="muted">submitted recall {data.submittedRecallCount===1?"attempt":"attempts"}</p></>:<p className="muted">No recall evidence yet. Your first completed recall will appear here.</p>}</article>
    </div>
    {learner?.weakConcepts.length ? <><div className="section-heading"><h2>Concepts to revisit</h2><Link to="/learner">See learner evidence</Link></div><section className="card">{learner.weakConcepts.slice(0, 4).map((concept) => <Link className="evidence-row" key={concept.conceptId} to={`/resources?conceptId=${encodeURIComponent(concept.conceptId)}`}><span><strong>{concept.conceptName}</strong><span className="metadata">{concept.mistakeCount ? `${concept.mistakeCount} missed point${concept.mistakeCount === 1 ? "" : "s"}` : "Evaluated recall"}</span></span><span className="evidence-progress"><span className="mastery-track"><span className="mastery-fill" style={{ width: `${Math.round(concept.mastery * 100)}%` }}/></span><span className="metadata">{Math.round(concept.mastery * 100)}%</span></span></Link>)}</section></> : learner && data.submittedRecallCount === 0 ? <EmptyState title="No recall evidence yet" to="/study/new" action="Study a topic">Your learner view takes shape through evaluated recall, not time spent on a page.</EmptyState> : learner ? <section className="card"><p className="muted">No concepts currently need extra review.</p><Link to="/learner">See your learner evidence</Link></section> : null}
    {data.recentlyStudied.length ? <><div className="section-heading"><h2>Recently studied</h2></div><section className="card">{data.recentlyStudied.slice(0,3).map((session)=><Link className="evidence-row" key={session.id} to={`/study/${session.id}`}><span><strong>{session.title}</strong><span className="metadata">{new Date(session.startedAt).toLocaleDateString()}</span></span><span className="status-chip">{session.status.replaceAll("_"," ")}</span></Link>)}</section></> : null}
  </div>;
}
