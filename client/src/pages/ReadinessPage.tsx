import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, RotateCcw } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { EmptyState, PageHeader } from "../components/Ui";
import type { Goal } from "../types";

type Readiness = Awaited<ReturnType<typeof api.goalReadiness>>;

export function ReadinessPage() {
  const { id: routeGoalId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalsLoaded, setGoalsLoaded] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState(routeGoalId ?? searchParams.get("goalId") ?? "");
  const [data, setData] = useState<Readiness | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void api.listGoals().then(({ goals: result }) => {
      if (!alive) return;
      setGoals(result);
      setSelectedGoalId((current) => current && result.some((goal) => goal.id === current)
        ? current
        : routeGoalId && result.some((goal) => goal.id === routeGoalId)
          ? routeGoalId
          : searchParams.get("goalId") && result.some((goal) => goal.id === searchParams.get("goalId"))
            ? searchParams.get("goalId")!
            : result.find((goal) => goal.status === "active")?.id ?? result[0]?.id ?? "");
    }).catch(() => { if (alive) setError("We couldn’t load your goals. Please try again."); })
      .finally(() => { if (alive) setGoalsLoaded(true); });
    return () => { alive = false; };
  }, [routeGoalId, searchParams]);

  useEffect(() => {
    if (!selectedGoalId) { setData(null); return; }
    let alive = true;
    setData(null);
    setError(null);
    void api.goalReadiness(selectedGoalId).then((result) => { if (alive) setData(result); })
      .catch(() => { if (alive) setError("We couldn’t load readiness evidence for this goal. Please try again."); });
    return () => { alive = false; };
  }, [selectedGoalId]);

  function chooseGoal(goalId: string) {
    setSelectedGoalId(goalId);
    navigate(`/readiness?goalId=${encodeURIComponent(goalId)}`, { replace: true });
  }

  if (error && !goalsLoaded) return <section className="error" role="alert">{error}</section>;

  return <div className="intent-page">
    <PageHeader eyebrow="Your evidence, in context" title="My Readiness" description="See what your submitted answers show about skills connected to a learning goal. This view reports evidence and gaps; it does not calculate an overall readiness score." />
    {!goalsLoaded ? <p className="muted" role="status">Loading your goals…</p> : goals.length === 0 ? <EmptyState title="Readiness starts with a goal" to="/goals/new" action="Create a learning goal">You can open this page any time. Add a goal and choose its focus skills to see relevant evidence here.</EmptyState> : <>
      <div className="readiness-goal-picker"><label htmlFor="readiness-goal">Goal</label><select id="readiness-goal" value={selectedGoalId} onChange={(event) => chooseGoal(event.target.value)}>{goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></div>
      {error ? <section className="error" role="alert">{error}</section> : !data ? <p className="muted" role="status">Loading submitted evidence…</p> : <>
        <p className="muted">Goal relevance follows the saved focus skills. Evidence includes only submitted recall points mapped to the canonical knowledge map. Counts show the latest submitted outcome for each point.</p>
        <section className="grid grid-2 readiness-grid" aria-label={`Readiness evidence for ${data.goal.title}`}>
          {data.skills.map((skill) => <article className="card readiness-skill" key={skill.skillId}>
            <div className="section-heading"><h2>{skill.name}</h2><span className="status-chip recommended">Priority {skill.priority}</span></div>
            {skill.status === "unmapped" ? <p className="muted">No exact canonical skill mapping is available yet, so there are no canonical points to assess for this goal focus.</p> : <>
              <p>{skill.canonicalSkill?.name} · {skill.assessedPoints} of {skill.totalPoints} knowledge points have submitted evidence.</p>
              <dl className="readiness-outcomes">
                <div><dt>Demonstrated</dt><dd>{skill.strengths}</dd></div>
                <div><dt>Partial</dt><dd>{skill.partial}</dd></div>
                <div><dt>Incorrect</dt><dd>{skill.incorrect}</dd></div>
                <div><dt>Unanswered</dt><dd>{skill.unanswered}</dd></div>
                <div><dt>No submitted evidence</dt><dd>{skill.unassessedPoints}</dd></div>
              </dl>
              {skill.latestEvidenceAt ? <p className="metadata">Latest submitted evidence {new Date(skill.latestEvidenceAt).toLocaleString()}</p> : <p className="muted">No submitted recall evidence yet. All {skill.totalPoints} mapped points remain unassessed.</p>}
            </>}
            <div className="actions readiness-actions">
              <Link className="btn btn-primary" to={`/study/new?topic=${encodeURIComponent(skill.name)}`}><BookOpen size={15}/> Study this focus area</Link>
              <Link className="btn" to="/review"><RotateCcw size={15}/> Review &amp; Improve</Link>
              <Link to="/knowledge">Explore the knowledge map <ArrowRight size={14}/></Link>
            </div>
          </article>)}
        </section>
        {!data.skills.length ? <section className="card"><h2>No focus skills on this goal yet</h2><p className="muted">Readiness is limited to skills you have attached to this goal. Add a focus area from the goal page to see its canonical evidence and gaps.</p><Link className="btn" to={`/goals/${data.goal.id}`}>Open this goal</Link></section> : null}
        <p className="metadata">Evidence source: {data.evidenceSource}. No confidence or aggregate readiness score is estimated.</p>
      </>}
    </>}
  </div>;
}
