import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { PageHeader } from "../components/Ui";

export function ReadinessPage() {
  const { id } = useParams();
  const [data, setData] = useState<Awaited<ReturnType<typeof api.goalReadiness>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    void api.goalReadiness(id).then(setData).catch(() => setError("We couldn’t load readiness evidence. Please try again."));
  }, [id]);

  if (error) return <p className="error" role="alert">{error}</p>;
  if (!data) return <p className="muted">Loading readiness evidence…</p>;
  return <div>
    <PageHeader eyebrow="Evidence for your goal" title="My Readiness" description={data.goal.title} />
    <p className="muted">Goal relevance follows your skill priorities. Demonstrated evidence counts only submitted recall points mapped to the canonical knowledge map. No overall readiness score is calculated.</p>
    <section className="grid grid-2">
      {data.skills.map((skill) => <article className="card readiness-skill" key={skill.skillId}>
        <div className="section-heading"><h2>{skill.name}</h2><span className="status-chip recommended">Priority {skill.priority}</span></div>
        {skill.status === "unmapped" ? <p className="muted">Not assessed: this goal skill has no exact canonical skill mapping yet.</p> : <>
          <p>{skill.canonicalSkill?.name} · {skill.assessedPoints} of {skill.totalPoints} knowledge points assessed</p>
          <p><strong>{skill.strengths}</strong> demonstrated strength{skill.strengths === 1 ? "" : "s"} · <strong>{skill.weaknesses}</strong> needs practice · <strong>{skill.unassessedPoints}</strong> not assessed</p>
          {skill.latestEvidenceAt ? <p className="metadata">Latest evidence {new Date(skill.latestEvidenceAt).toLocaleString()}</p> : <p className="muted">No submitted recall evidence yet.</p>}
          <Link to={`/knowledge`}>Explore the knowledge map</Link>
        </>}
      </article>)}
    </section>
    {!data.skills.length ? <p className="muted">Add goal skills to see their relevance and available evidence.</p> : null}
    <p className="metadata">{data.evidenceSource} Confidence is not estimated by this view.</p>
  </div>;
}
