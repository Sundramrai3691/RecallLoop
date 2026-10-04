import { useEffect, useState } from "react";
import { ArrowRight, Plus, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { EmptyState, PageHeader } from "../components/Ui";
import { ApiError, type Goal, type Skill } from "../types";

export function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [skills, setSkills] = useState<Record<string, Skill[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    void api.listGoals().then(async ({ goals: result }) => {
      const entries = await Promise.all(result.map(async (goal) => [goal.id, (await api.listSkills(goal.id)).skills] as const));
      if (alive) { setGoals(result); setSkills(Object.fromEntries(entries)); }
    }).catch((err) => { if (alive) setError(err instanceof ApiError && err.status === 401 ? "Sign in to see and manage your learning goals." : "We couldn’t load your goals. Please try again."); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);
  return <div>
    <PageHeader eyebrow="Your direction" title="Goals" description="Choose an outcome. RecallLoop will help turn it into focused practice." action={<Link className="btn btn-primary" to="/goals/new"><Plus size={16}/> New goal</Link>} />
    {error ? <section className="error" role="alert">{error} {error.startsWith("Sign in") ? <Link to="/login">Sign in</Link> : null}</section> : loading ? <div className="card grid"><div className="skeleton"/><div className="skeleton"/></div> : goals.length === 0 ? <EmptyState title="What do you want to become good at?" to="/goals/new" action="Set your first goal" icon={<Target size={18}/>}>Start with an outcome like becoming a backend engineer or preparing for an exam.</EmptyState> : <div className="grid grid-2">{goals.map((goal) => <article className="card card-interactive goal-card" key={goal.id}>
      <div className="goal-card-top"><span className="status-chip">{goal.status.replaceAll("_", " ")}</span><span className="metadata">{goal.weeklyTimeBudgetMinutes} min / week</span></div><h2>{goal.title}</h2><p className="muted">{goal.description || "Build capability through focused study and recall."}</p>
      <div className="goal-skills"><strong className="metadata">FOCUS AREAS</strong>{skills[goal.id]?.length ? skills[goal.id].slice(0, 3).map((skill) => <div className="row" key={skill.id}><span>{skill.name}</span><span className="badge">{skill.currentMastery === null ? "Not assessed" : `${Math.round(skill.currentMastery * 100)}% evidence`}</span></div>) : <p className="muted">Choose a skill to establish your starting point.</p>}</div>
      <div className="actions"><Link className="btn btn-primary" to={`/goals/${goal.id}`}>Open goal <ArrowRight size={15}/></Link><Link className="btn" to={`/plan?goalId=${goal.id}`}>Today's plan</Link></div>
    </article>)}</div>}
  </div>;
}
