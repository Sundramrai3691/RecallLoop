import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, BrainCircuit, CalendarClock, RotateCcw, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { EmptyState, PageHeader } from "../components/Ui";
import { WhyThis } from "../components/WhyThis";
import { useDashboard } from "../hooks/useDashboard";
import type { Goal, LearnerSummary, PlanTask } from "../types";
import { readableTitle } from "../utils/presentation";

export function DashboardPage() {
  const { data, error } = useDashboard();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [tasks, setTasks] = useState<PlanTask[]>([]);
  const [learner, setLearner] = useState<LearnerSummary | null>(null);
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);

  useEffect(() => {
    void Promise.allSettled([api.listGoals(), api.todayPlan(), api.learnerSummary()]).then(([goals, plan, summary]) => {
      if (goals.status === "fulfilled") setGoal(goals.value.goals.find((item) => item.status === "active") ?? null);
      if (plan.status === "fulfilled") setTasks(plan.value.tasks);
      if (summary.status === "fulfilled") setLearner(summary.value);
      setWorkspaceLoaded(true);
    });
  }, []);

  if (error) return <div className="grid"><PageHeader eyebrow="Your learning workspace" title="Home"/><section className="error"><strong>We couldn’t load your learning data.</strong><p>{error.status === 401 ? "Sign in to see your learning workspace." : "Check that the app server and database are available, then refresh."}</p><div className="actions">{error.status === 401 ? <Link className="btn btn-primary" to="/login">Sign in</Link> : <button className="btn btn-primary" type="button" onClick={() => window.location.reload()}>Try again</button>}</div></section></div>;
  if (!data || !workspaceLoaded) return <div className="grid"><PageHeader eyebrow="Your learning workspace" title="Home"/><div className="card grid"><div className="skeleton"/><div className="skeleton"/></div></div>;

  const due = data.todayDue[0];
  const unfinishedSession = data.recentlyStudied.find((session) => session.status === "in_progress");
  const pendingTask = tasks.find((task) => task.status === "planned" || task.status === "in_progress");
  const weak = learner?.weakConcepts[0];
  const firstVisit = data.recentlyStudied.length === 0 && data.submittedRecallCount === 0 && !goal && !due;
  const continuation = due ? { icon: <RotateCcw size={18}/>, title: readableTitle(due.conceptName, "Scheduled recall"), reason: "This recall is due according to your saved review schedule.", href: `/recall/${due.recallId}`, label: "Review now" }
    : unfinishedSession ? { icon: <BookOpen size={18}/>, title: readableTitle(unfinishedSession.title, "Your study session"), reason: "You have a study session in progress.", href: `/study/${unfinishedSession.id}`, label: "Continue study" }
    : pendingTask ? { icon: <CalendarClock size={18}/>, title: readableTitle(pendingTask.title, "Your next planned step"), reason: pendingTask.reason || "This is the next available task in your plan.", href: "/plan/today", label: "Open today’s plan" }
    : weak ? { icon: <Sparkles size={18}/>, title: readableTitle(weak.conceptName, "A concept to revisit"), reason: "Submitted recall evidence shows knowledge points to strengthen.", href: `/review#weak-${weak.conceptId}`, label: "Review and improve" }
    : goal ? { icon: <TargetIcon/>, title: readableTitle(goal.title, "Your learning goal"), reason: "Continue toward your goal or choose another learning direction.", href: "/goals", label: "View goal" }
    : null;

  return <div className="home-intent-page">
    <PageHeader eyebrow="Your learning workspace" title={firstVisit ? "What would you like to do?" : "Choose your next learning step"} description={firstVisit ? "Start with what matters to you. You can check what you know, learn a topic, or strengthen past learning." : "Your schedule and submitted evidence can guide you, and you can always choose a different path."} />
    <section className="intent-entry-grid" aria-label="Choose a learning intention">
      <article className="intent-choice intent-choice-primary"><div className="intent-choice-icon"><BrainCircuit size={22}/></div><p className="eyebrow">CHECK WHAT YOU KNOW</p><h2>Test my knowledge</h2><p>Choose a subject and see which checks have enough approved questions.</p><Link className="btn btn-primary" to="/knowledge-check">Choose a knowledge check <ArrowRight size={15}/></Link></article>
      <div className="intent-choice-secondary">
        <article className="intent-choice"><div className="intent-choice-icon"><BookOpen size={20}/></div><div><p className="eyebrow">START FRESH</p><h2>Learn something new</h2><p>Pick a catalog topic or study notes you provide.</p></div><Link className="btn" to="/study/new">Choose a topic or add notes <ArrowRight size={15}/></Link></article>
        <article className="intent-choice"><div className="intent-choice-icon"><RotateCcw size={20}/></div><div><p className="eyebrow">BUILD ON PAST WORK</p><h2>Review and improve</h2><p>See due reviews, unfinished activities, and assessed weak concepts.</p></div><Link className="btn" to="/review">Choose what to strengthen <ArrowRight size={15}/></Link></article>
      </div>
    </section>

    {continuation ? <section className="home-continuation card"><div className="home-continuation-icon" aria-hidden="true">{continuation.icon}</div><div className="home-continuation-copy"><p className="eyebrow">A useful next step</p><h2>{continuation.title}</h2><p className="muted">{continuation.reason}</p>{due ? <WhyThis reason="Due status comes from the existing review schedule."/> : null}</div><Link className="btn btn-primary" to={continuation.href}>{continuation.label} <ArrowRight size={15}/></Link></section> : null}

    <section className="home-utilities" aria-label="Learning tools"><div><h2>Your learning tools</h2><p className="muted">Goals, maps, evidence, and planning stay available whenever you need them.</p></div><div className="utility-links"><Link to="/readiness">My Readiness</Link><Link to="/plan/today">Today’s plan</Link><Link to="/goals">Goals</Link><Link to="/knowledge">Knowledge map</Link><Link to="/resources">Resources</Link><Link to="/learner">Learner evidence</Link><Link to="/settings">Review settings</Link></div></section>
    {!firstVisit && goal ? <section className="home-context-strip"><span><strong>Active goal</strong> {readableTitle(goal.title, "Learning goal")}</span><Link to={`/goals/${goal.id}`}>View details</Link></section> : null}
    {!continuation && !firstVisit && !goal ? <EmptyState title="Your next step will appear here" to="/knowledge-check" action="Test my knowledge">Choose any of the three learning paths above to get started.</EmptyState> : null}
  </div>;
}

function TargetIcon() { return <CalendarClock size={18}/>; }
