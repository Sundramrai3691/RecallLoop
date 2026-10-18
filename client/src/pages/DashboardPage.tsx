import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, RotateCcw, Sparkles, Target } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { EmptyState, PageHeader, ProgressBar } from "../components/Ui";
import { WhyThis } from "../components/WhyThis";
import { useDashboard } from "../hooks/useDashboard";
import type { Goal, LearnerSummary, PlanTask } from "../types";
import { readableTitle } from "../utils/presentation";

export function DashboardPage() {
  const navigate = useNavigate();
  const { data, error } = useDashboard();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [hasGoals, setHasGoals] = useState<boolean | null>(null);
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const [tasks, setTasks] = useState<PlanTask[]>([]);
  const [learner, setLearner] = useState<LearnerSummary | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [startingPractice, setStartingPractice] = useState(false);
  useEffect(() => {
    void Promise.allSettled([api.listGoals(), api.todayPlan(), api.learnerSummary()]).then(([goals, plan, summary]) => {
      if (goals.status === "fulfilled") { setHasGoals(goals.value.goals.length > 0); setGoal(goals.value.goals.find((item) => item.status === "active") ?? null); }
      if (plan.status === "fulfilled") setTasks(plan.value.tasks);
      if (summary.status === "fulfilled") setLearner(summary.value);
      setWorkspaceLoaded(true);
    });
  }, []);

  if (error) return <div className="grid"><PageHeader eyebrow="Your learning workspace" title="Home"/><section className="error"><strong>We couldn’t load your learning data.</strong><p>{error.status === 401 ? "Sign in to see your learning workspace." : "Check that the app server and database are available, then refresh."}</p><div className="actions">{error.status === 401?<Link className="btn btn-primary" to="/login">Sign in</Link>:<button className="btn btn-primary" type="button" onClick={()=>window.location.reload()}>Try again</button>}</div></section></div>;
  if (!data || !workspaceLoaded) return <div className="grid"><PageHeader eyebrow="Your learning workspace" title="Home"/><div className="card grid"><div className="skeleton"/><div className="skeleton"/><div className="skeleton"/></div></div>;

  const recentSession = data.recentlyStudied.find((session) => session.status === "in_progress");
  const weakConcept = learner?.weakConcepts[0];
  const firstVisit = hasGoals === false && data.recentlyStudied.length === 0 && data.submittedRecallCount === 0;
  const pendingTask = tasks.find((task) => task.status === "planned" || task.status === "in_progress");
  const action = firstVisit ? "goal" : data.todayDue[0] ? "recall" : recentSession ? "resume" : pendingTask ? "plan" : weakConcept ? "practice" : goal ? "study" : "goal";
  async function practiceWeakConcept() {
    if (!weakConcept) return;
    setStartingPractice(true); setActionError(null);
    try { const run = await api.createAssessment(weakConcept.conceptId, "practice"); navigate(`/assessments/${run.assessment.id}`); }
    catch { setActionError("This concept doesn’t have an approved practice question yet. Open its learning resources or choose another study topic."); }
    finally { setStartingPractice(false); }
  }
  const primary = action === "goal" ? {
    eyebrow: "A good place to begin", title: "Choose a learning goal", detail: hasGoals ? "Choose a new direction to organize your next stretch of learning." : "Tell RecallLoop what you’re working toward. Then add a topic and start your first study session.",
    button: <Link className="btn btn-primary" to="/goals/new">{hasGoals === false ? "Create your first goal" : "Choose or create a goal"} <ArrowRight size={16}/></Link>, icon: <Target size={30}/>,
  } : action === "recall" ? {
    eyebrow: "Due for review", title: readableTitle(data.todayDue[0].conceptName, "A recent study topic"), detail: "A recall is ready. Answer from memory to strengthen what you learned.",
    button: <Link className="btn btn-primary" to={`/recall/${data.todayDue[0].recallId}`}>Start this recall <ArrowRight size={16}/></Link>, icon: <RotateCcw size={30}/>,
  } : action === "resume" ? {
    eyebrow: "Pick up where you left off", title: readableTitle(recentSession?.title, "Your study session"), detail: "This study session is still in progress. Continue reviewing its concepts and start recall when you’re ready.",
    button: <Link className="btn btn-primary" to={`/study/${recentSession?.id}`}>Resume study <ArrowRight size={16}/></Link>, icon: <BookOpen size={30}/>,
  } : action === "plan" ? {
    eyebrow: "Continue today’s plan", title: readableTitle(pendingTask?.title, "Your next planned step"), detail: "Pick up the next step in your learning plan. You can keep it for later or skip it if today has changed.",
    button: <Link className="btn btn-primary" to="/plan/today">Open today’s plan <ArrowRight size={16}/></Link>, icon: <Target size={30}/>,
  } : action === "practice" ? {
    eyebrow: "Focused practice", title: readableTitle(weakConcept?.conceptName, "A concept to revisit"), detail: "Your recall evidence shows this concept could use another pass. Try a focused practice round.",
    button: <button className="btn btn-primary" type="button" disabled={startingPractice} onClick={()=>void practiceWeakConcept()}>{startingPractice ? "Preparing practice…" : "Practice this concept"} <ArrowRight size={16}/></button>, icon: <Sparkles size={30}/>,
  } : {
    eyebrow: "Keep learning", title: readableTitle(goal?.title, "Your learning goal"), detail: "Your next recall isn’t due yet. Study a topic now or check today’s plan for your next step.",
    button: <Link className="btn btn-primary" to="/study/new">Start a study session <ArrowRight size={16}/></Link>, icon: <BookOpen size={30}/>,
  };
  const firstVisitCopy = firstVisit;
  return <div>
    <PageHeader eyebrow="Your learning workspace" title={firstVisitCopy ? "Start with a clear direction" : "What should you work on now?"} description={firstVisitCopy ? "Set one learning goal, then RecallLoop can help you choose a useful next step." : "Your next step is based on what’s due and the evidence from your recent learning."} />
    <section className="next-action card"><div className="next-action-copy"><p className="eyebrow"><Sparkles size={13}/> {primary.eyebrow}</p><h2>{primary.title}</h2><p className="muted">{primary.detail}</p>{action === "recall" ? <WhyThis reason="This concept is due for review according to your recall schedule."/> : null}<div className="actions">{primary.button}{action === "goal" && !firstVisitCopy ? <Link className="btn" to="/goals">View your goals</Link> : null}{firstVisitCopy ? <Link className="btn" to="/knowledge">Explore the knowledge map</Link> : null}</div>{actionError ? <p className="error" role="alert">{actionError} <Link to={`/resources?conceptId=${encodeURIComponent(weakConcept?.conceptId ?? "")}`}>View related resources</Link></p> : null}</div><div className="next-action-mark" aria-hidden="true">{primary.icon}<span>{action === "recall" ? "RECALL" : action === "practice" ? "PRACTICE" : action === "goal" ? "DIRECTION" : "LEARN"}</span></div></section>

    {!firstVisitCopy ? <>
      <div className="grid dashboard-secondary" style={{ marginTop: 18 }}>
        <article className="card"><div className="section-heading" style={{ marginTop: 0 }}><h2>Active goal</h2><Link to="/goals">All goals</Link></div>{goal ? <><h3>{readableTitle(goal.title, "Your learning goal")}</h3><p className="muted">{goal.weeklyTimeBudgetMinutes} minutes a week</p><Link to={`/goals/${goal.id}`}>View goal details <ArrowRight size={14}/></Link></> : <EmptyState title="Set a direction" to="/goals/new" action="Create a goal">A goal helps shape a focused learning plan.</EmptyState>}</article>
        <article className="card"><div className="section-heading" style={{ marginTop: 0 }}><h2>Today’s plan</h2><Link to="/plan/today">Open plan</Link></div>{tasks.length ? <><p className="stat">{tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0)} <span className="metadata">min planned</span></p><ProgressBar value={tasks.length ? tasks.filter((task) => task.status === "completed").length / tasks.length * 100 : 0} label="Plan completion"/><p className="muted" style={{ marginTop: 10 }}>{pendingTask ? `Up next: ${readableTitle(pendingTask.title, "Continue your planned learning")}` : "Today’s plan is complete."}</p></> : <p className="muted">A plan will appear when there’s work scheduled for today.</p>}</article>
        <article className="card"><div className="section-heading" style={{ marginTop: 0 }}><h2>Recall evidence</h2><Link to="/learner">See learner view</Link></div>{data.submittedRecallCount?<><p className="stat">{data.submittedRecallCount}</p><p className="muted">submitted recall {data.submittedRecallCount===1?"attempt":"attempts"}</p></>:<p className="muted">Your first completed recall will appear here.</p>}</article>
      </div>
      {learner?.weakConcepts.length ? <><div className="section-heading"><h2>Concepts to revisit</h2><Link to="/learner">See learner evidence</Link></div><section className="card">{learner.weakConcepts.slice(0, 4).map((concept) => <div className="evidence-row" key={concept.conceptId}><span><strong>{readableTitle(concept.conceptName, "Recent study topic")}</strong><span className="metadata">{concept.mistakeCount ? `${concept.mistakeCount} missed point${concept.mistakeCount === 1 ? "" : "s"}` : "Evaluated recall"}</span></span><Link to={`/resources?conceptId=${encodeURIComponent(concept.conceptId)}`}>Resources</Link></div>)}</section></> : null}
      {data.recentlyStudied.length ? <><div className="section-heading"><h2>Recently studied</h2></div><section className="card">{data.recentlyStudied.slice(0,3).map((session)=><Link className="evidence-row" key={session.id} to={`/study/${session.id}`}><span><strong>{readableTitle(session.title, "Review recent study session")}</strong><span className="metadata">{new Date(session.startedAt).toLocaleDateString()}</span></span><span className="status-chip">{session.status.replaceAll("_"," ")}</span></Link>)}</section></> : null}
    </> : null}
  </div>;
}
